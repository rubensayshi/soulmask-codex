"""
Parse BP_KJS tech tree nodes from UAssetGUI JSON exports.

Input:  uasset_export/Blueprints/KeJiShu/**/*.json.gz
Output: Game/Parsed/tech_tree.json

Extracts node hierarchy, prerequisites, mask level requirements, and
for subnodes the list of recipes they unlock.
"""

import gzip
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
KEJISHU_DIR = REPO_ROOT / "uasset_export" / "Blueprints" / "KeJiShu"
OUTPUT_DIR = REPO_ROOT / "Game" / "Parsed"

# Folder → node category
FOLDER_CATEGORY = {
    "Node": "main",
    "Node_Action": "main_action",
    "Node_Management": "main_management",
    "SubNode": "sub",
    "SubNode_Action": "sub_action",
    "SubNode_Management": "sub_management",
}


def resolve_import_path(imports, ref):
    if ref is None or ref >= 0:
        return None
    idx = -ref - 1
    if idx >= len(imports):
        return None
    imp = imports[idx]
    outer = imp.get("OuterIndex", 0)
    if outer == 0:
        return imp.get("ObjectName")
    pkg_idx = -outer - 1
    if pkg_idx < 0 or pkg_idx >= len(imports):
        return None
    return imports[pkg_idx].get("ObjectName")


def find_props(exports):
    for exp in exports or []:
        if not isinstance(exp, dict):
            continue
        for prop in exp.get("Data") or []:
            if isinstance(prop, dict):
                yield prop.get("Name"), prop


def get_prop(exports, name):
    for n, p in find_props(exports):
        if n == name:
            return p
    return None


def text_zh(prop):
    return prop.get("CultureInvariantString") if prop else None


def resolve_refs(array_prop, imports):
    """Object ref array → list of /Game/... asset paths."""
    out = []
    if not array_prop:
        return out
    for item in array_prop.get("Value") or []:
        if isinstance(item, dict):
            path = resolve_import_path(imports, item.get("Value"))
            if path:
                out.append(path.split("/")[-1])
    return out


_SOFT_PATH_C_SUFFIX = re.compile(r"\.([^.]+)_C$")


def resolve_soft_refs(array_prop):
    """KeJiPeiFangSoftList → list of recipe IDs from SoftObjectPath AssetName.

    AssetName format: /Game/Blueprints/PeiFang/.../BP_PeiFang_X.BP_PeiFang_X_C
    We strip the .Class_C suffix and take the final segment.
    """
    out = []
    if not array_prop:
        return out
    for item in array_prop.get("Value") or []:
        if not isinstance(item, dict):
            continue
        val = item.get("Value")
        if not isinstance(val, dict):
            continue
        asset_path = val.get("AssetPath") or {}
        name = asset_path.get("AssetName")
        if not name:
            continue
        m = _SOFT_PATH_C_SUFFIX.search(name)
        if m:
            out.append(m.group(1))
        else:
            out.append(name.split("/")[-1])
    return out


def folder_category(rel_path):
    parts = rel_path.parts
    if not parts:
        return None
    return FOLDER_CATEGORY.get(parts[0], parts[0])


def parse_node(filepath, rel_path):
    with gzip.open(filepath, "rt", encoding="utf-8") as f:
        data = json.load(f)

    imports = data.get("Imports") or []
    exports = data.get("Exports") or []

    filename = filepath.name.replace(".json.gz", "")

    # Description is mis-spelled as "Desciption" on main nodes; subnodes use "Description"
    name_zh = text_zh(get_prop(exports, "Name"))
    desc_prop = get_prop(exports, "Description") or get_prop(exports, "Desciption")
    desc_zh = text_zh(desc_prop)

    mask_level = (get_prop(exports, "NeedMaskLevel") or {}).get("Value")
    consume_points = (get_prop(exports, "ConsumePoints") or {}).get("Value")

    # Main-node-only
    pre_nodes = resolve_refs(get_prop(exports, "PreNodeList"), imports)
    sub_nodes = resolve_refs(get_prop(exports, "SubNodeList"), imports)
    auto_learn_sub = resolve_refs(get_prop(exports, "AutoLearnSubNodeList"), imports)

    # Sub-node-only
    pre_main = resolve_refs(get_prop(exports, "PreMainNodeList"), imports)
    pre_sub = resolve_refs(get_prop(exports, "PreSubNodeList"), imports)
    unlocks_recipes = resolve_soft_refs(get_prop(exports, "KeJiPeiFangSoftList"))

    icon_ref = (get_prop(exports, "Icon") or {}).get("Value")
    icon_path = resolve_import_path(imports, icon_ref) if icon_ref else None

    cat = folder_category(rel_path.parent)
    is_sub = cat and cat.startswith("sub")

    return {
        "id": filename,
        "category": cat,
        "is_sub": bool(is_sub),
        "name_zh": name_zh,
        "description_zh": desc_zh,
        "required_mask_level": mask_level,
        "consume_points": consume_points,
        "prerequisite_main_nodes": (pre_main if is_sub else pre_nodes) or None,
        "prerequisite_sub_nodes": pre_sub or None,
        "child_sub_nodes": sub_nodes or None,
        "auto_learn_sub_nodes": auto_learn_sub or None,
        "unlocks_recipes": unlocks_recipes or None,
        "icon_path": icon_path,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(KEJISHU_DIR.rglob("BP_KJS_*.json.gz"))
    print(f"Found {len(files)} tech nodes")

    nodes = []
    errors = []

    for fp in files:
        try:
            rel = fp.relative_to(KEJISHU_DIR)
            nodes.append(parse_node(fp, rel))
        except Exception as e:
            errors.append({"file": str(fp), "error": str(e)})

    nodes.sort(key=lambda n: n["id"])

    out_path = OUTPUT_DIR / "tech_tree.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(nodes, f, ensure_ascii=False, indent=2)

    print(f"\nResults:")
    print(f"  Parsed: {len(nodes)}")
    print(f"  Errors: {len(errors)}")

    cats = {}
    for n in nodes:
        c = n["category"] or "unknown"
        cats[c] = cats.get(c, 0) + 1
    print(f"\nBy category:")
    for c, num in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {c}: {num}")

    main_nodes = [n for n in nodes if not n["is_sub"]]
    sub_nodes = [n for n in nodes if n["is_sub"]]
    with_unlocks = sum(1 for n in sub_nodes if n["unlocks_recipes"])
    total_recipes = sum(len(n["unlocks_recipes"] or []) for n in sub_nodes)
    print(f"\nMain nodes: {len(main_nodes)}")
    print(f"Sub nodes:  {len(sub_nodes)}")
    print(f"Subnodes that unlock recipes: {with_unlocks}")
    print(f"Total recipe unlocks: {total_recipes}")

    print(f"\nSample subnodes with unlocks:")
    for n in sub_nodes[:3]:
        if not n["unlocks_recipes"]:
            continue
        print(f"  {n['id']} ({n['name_zh']}) lvl={n['required_mask_level']} cost={n['consume_points']}")
        print(f"    unlocks: {n['unlocks_recipes']}")

    print(f"\nOutput: {out_path}")

    if errors:
        err_path = OUTPUT_DIR / "tech_tree_errors.json"
        with open(err_path, "w") as f:
            json.dump(errors, f, indent=2)
        print(f"Errors: {err_path}")


if __name__ == "__main__":
    main()
