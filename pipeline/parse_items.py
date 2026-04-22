"""
Parse BP_DaoJu item data from UAssetGUI JSON exports.

Input:  uasset_export/Blueprints/DaoJu/**/*.json.gz  (UAssetAPI JSON)
Output: Game/Parsed/items.json

Extracts common item properties (name, description, weight, stack size, icon)
and type-specific stats (durability, damage, armor, food effects).
"""

import gzip
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ITEMS_DIR = REPO_ROOT / "uasset_export" / "Blueprints" / "DaoJu"
OUTPUT_DIR = REPO_ROOT / "Game" / "Parsed"

# Top-level DaoJu subfolder -> category label
CATEGORY_MAP = {
    "DaojuCaiLiao": "material",
    "DaoJuShiWu": "food",
    "DaoJuWuQi": "weapon",
    "DaoJuZhuangBei": "equipment",
    "DaoJuGongJu": "tool",
    "DaoJuJianZhu": "building",
    "DaoJuYaoPin": "potion",
    "DaoJuMianJu": "mask",
    "DaoJuMask": "mask",
    "DaoJuFashion": "fashion",
    "DaoJuFunction": "function",
    "DaoJuJiaGong": "processed",
    "DaoJuKey": "key",
    "DaoJuShuJuKu": "data",
    "DaoJuZhaoMingMoKuai": "lighting",
    "Tips": "tip",
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
    """Extract Chinese text from a TextProperty."""
    if not prop:
        return None
    return prop.get("CultureInvariantString")


def extract_stats(array_prop):
    """DefaultZhuangBeiProp → [{attr, value, op}]"""
    stats = []
    if not array_prop:
        return stats
    for struct in array_prop.get("Value") or []:
        attr_name = None
        value = None
        op = None
        for sub in struct.get("Value") or []:
            if not isinstance(sub, dict):
                continue
            if sub.get("Name") == "ShuXing":
                for inner in sub.get("Value") or []:
                    if isinstance(inner, dict) and inner.get("Name") == "AttributeName":
                        attr_name = inner.get("Value")
            elif sub.get("Name") == "ShuXingValue":
                value = sub.get("Value")
            elif sub.get("Name") == "ModOp":
                op = sub.get("EnumValue")
        if attr_name is not None:
            stats.append({"attr": attr_name, "value": value, "op": op})
    return stats


def category_from_path(rel_path):
    """Derive category from first path segment under DaoJu/."""
    parts = rel_path.parts
    if not parts:
        return None
    top = parts[0]
    return CATEGORY_MAP.get(top, top)


def parse_item(filepath, rel_path):
    with gzip.open(filepath, "rt", encoding="utf-8") as f:
        data = json.load(f)

    imports = data.get("Imports") or []
    exports = data.get("Exports") or []

    filename = filepath.name.replace(".json.gz", "")

    # Common properties
    name_zh = text_zh(get_prop(exports, "Name"))
    desc_zh = text_zh(get_prop(exports, "Description"))
    weight = (get_prop(exports, "Weight") or {}).get("Value")
    max_stack = (get_prop(exports, "MaxAmount") or {}).get("Value")
    icon_ref = (get_prop(exports, "Icon") or {}).get("Value")
    icon_path = resolve_import_path(imports, icon_ref) if icon_ref else None

    # Weapon/equipment fields
    durability = (get_prop(exports, "DefaultNaiJiuDu") or {}).get("Value")
    durability_decay = (get_prop(exports, "NaiJiuXiShu") or {}).get("Value")
    stats = extract_stats(get_prop(exports, "DefaultZhuangBeiProp"))

    # Material type (e.g. wood, metal)
    cailiao_type_prop = get_prop(exports, "CaiLiaoType")
    material_type = None
    if cailiao_type_prop:
        ev = cailiao_type_prop.get("EnumValue") or cailiao_type_prop.get("Value")
        if isinstance(ev, str) and "::" in ev:
            material_type = ev.split("::", 1)[1]
        else:
            material_type = ev

    # Food: spoil time, gameplay effects
    spoil_time = (get_prop(exports, "DaoJuFuLanTime") or {}).get("Value")

    # Storage level / rarity enum
    cundang_prop = get_prop(exports, "DJCunDangDengJi")
    storage_level = None
    if cundang_prop:
        v = cundang_prop.get("Value")
        if isinstance(v, str) and "::" in v:
            storage_level = v.split("::", 1)[1]

    # Category
    category = category_from_path(rel_path.parent)
    subcategory = None
    if len(rel_path.parent.parts) > 1:
        subcategory = rel_path.parent.parts[1]

    return {
        "id": filename,
        "category": category,
        "subcategory": subcategory,
        "name_zh": name_zh,
        "description_zh": desc_zh,
        "weight": weight,
        "max_stack": max_stack,
        "durability": durability,
        "durability_decay": durability_decay,
        "material_type": material_type,
        "spoil_time_seconds": spoil_time,
        "storage_level": storage_level,
        "stats": stats if stats else None,
        "icon_path": icon_path,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(ITEMS_DIR.rglob("*.json.gz"))
    print(f"Found {len(files)} item files")

    items = []
    errors = []

    for fp in files:
        try:
            rel = fp.relative_to(ITEMS_DIR)
            item = parse_item(fp, rel)
            items.append(item)
        except Exception as e:
            errors.append({"file": str(fp), "error": str(e)})

    items.sort(key=lambda i: i["id"])

    out_path = OUTPUT_DIR / "items.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    # Stats
    print(f"\nResults:")
    print(f"  Parsed: {len(items)}")
    print(f"  Errors: {len(errors)}")

    cats = {}
    for i in items:
        c = i["category"] or "unknown"
        cats[c] = cats.get(c, 0) + 1
    print(f"\nBy category:")
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {c}: {n}")

    print(f"\nWith name_zh: {sum(1 for i in items if i['name_zh'])}")
    print(f"With weight: {sum(1 for i in items if i['weight'] is not None)}")
    print(f"With durability: {sum(1 for i in items if i['durability'] is not None)}")
    print(f"With stats: {sum(1 for i in items if i['stats'])}")

    print(f"\nSample items:")
    for i in items[:3]:
        print(f"  {i['id']} [{i['category']}] {i['name_zh']}")
        print(f"    weight={i['weight']}, max_stack={i['max_stack']}, durability={i['durability']}")

    print(f"\nOutput: {out_path}")

    if errors:
        err_path = OUTPUT_DIR / "item_errors.json"
        with open(err_path, "w") as f:
            json.dump(errors, f, indent=2)
        print(f"Errors written: {err_path}")


if __name__ == "__main__":
    main()
