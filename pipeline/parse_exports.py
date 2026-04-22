"""
Parse exported DataTable JSON files and build structured drop database.

Data format (all tables):
  DaoJuBaoContent = UE4 export text, an array of "groups":
    ((SelectedRandomProbability=N, ConditionAndCheckData=...,
      BaoNeiDaoJuInfos=(
        (DaoJuQuanZhong=N, DaoJuMagnitude=(LowerBound=(Type=X,Value=F),UpperBound=(Type=X,Value=F)),
         DaoJuPinZhi=EDJPZ_LevelN, ..., DaoJuClass=BlueprintGeneratedClass'"/Game/..."', ...),
        ...
      )
    ), ...)

Input:  Game/Exports/*.json  (produced by export_tables.py)
Output: Game/Parsed/drops.json

Run:    <modkit_python> parse_exports.py
"""

import json
import os
import re
from pathlib import Path
from parse_localization import load_names, normalize_path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXPORTS_DIR = REPO_ROOT / "Game" / "Exports"
OUTPUT_DIR  = REPO_ROOT / "Game" / "Parsed"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(filename):
    path = EXPORTS_DIR / filename
    if not path.exists():
        print("  [WARN] Not found: {}".format(path))
        return []
    with open(str(path), encoding="utf-8") as f:
        return json.load(f)


def asset_ref_to_path(ref):
    """
    Convert UE asset reference to normalized path key.
    E.g.:  BlueprintGeneratedClass'"/Game/Blueprints/DaoJu/Foo/BP_Bar.BP_Bar_C"'
        -> blueprints/daoju/foo/bp_bar
    """
    if not ref:
        return ""
    m = re.search(r"'\"(/Game/[^\"]+)\"'", ref)
    if not m:
        m = re.search(r"'(/Game/[^']+)'", ref)
    if m:
        path = m.group(1)
        # Strip .ClassName_C suffix (e.g. .BP_Bar_C)
        path = re.sub(r"\.\w+_C$", "", path)
        return normalize_path(path)
    return ref.lower().strip()


def resolve_name(ref, names):
    key = asset_ref_to_path(ref)
    if key in names:
        return names[key]
    parts = key.split("/") if key else []
    # Try progressively shorter suffix matches
    for i in range(1, len(parts) + 1):
        sub = "/".join(parts[-i:])
        if sub in names:
            return names[sub]
    # Prettify asset filename as fallback
    raw = parts[-1] if parts else key
    raw = re.sub(r"^(bp_daoju_|bp_|daoju_item_)", "", raw, flags=re.IGNORECASE)
    return raw.replace("_", " ").title()


# ---------------------------------------------------------------------------
# UE4 export-text parser for DaoJuBaoContent
# ---------------------------------------------------------------------------

def split_top_level_parens(s):
    """
    Split a string like '((a=1),(b=2),(c=3))' into ['(a=1)', '(b=2)', '(c=3)']
    respecting nesting.  The outer wrapping parens are stripped first.
    """
    # Strip one layer of outer parens
    s = s.strip()
    if s.startswith("(") and s.endswith(")"):
        s = s[1:-1]
    results = []
    depth = 0
    start = None
    for i, ch in enumerate(s):
        if ch == "(":
            if depth == 0:
                start = i
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0 and start is not None:
                results.append(s[start:i+1])
                start = None
    return results


def parse_daoju_bag_content(content_str):
    """
    Parse DaoJuBaoContent into a list of groups.
    Each group: {probability, items: [{item_ref, qty_min, qty_max, weight, quality}]}
    """
    groups = []
    group_strs = split_top_level_parens(content_str)
    for g in group_strs:
        # Extract SelectedRandomProbability
        m_prob = re.search(r"SelectedRandomProbability=(\d+)", g)
        prob = int(m_prob.group(1)) if m_prob else 100

        # Extract BaoNeiDaoJuInfos array
        m_infos = re.search(r"BaoNeiDaoJuInfos=(\(.*)", g, re.DOTALL)
        if not m_infos:
            continue
        infos_raw = m_infos.group(1)
        # Trim to just the outer parens block
        # Find matching close paren
        depth = 0
        end = 0
        for i, ch in enumerate(infos_raw):
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        infos_str = infos_raw[:end]

        items = []
        for entry in split_top_level_parens(infos_str):
            # DaoJuClass
            m_cls = re.search(r"DaoJuClass=([^,)]+(?:'\"[^\"]+\"')?)", entry)
            item_ref = m_cls.group(1).strip() if m_cls else ""
            if not item_ref or item_ref == "None":
                continue

            # DaoJuMagnitude: quantity range
            m_min = re.search(r"LowerBound=\(Type=\w+,Value=([\d.]+)\)", entry)
            m_max = re.search(r"UpperBound=\(Type=\w+,Value=([\d.]+)\)", entry)
            qty_min = float(m_min.group(1)) if m_min else 1.0
            qty_max = float(m_max.group(1)) if m_max else qty_min

            # DaoJuQuanZhong: weight for weighted-random selection
            m_wt = re.search(r"DaoJuQuanZhong=(\d+)", entry)
            weight = int(m_wt.group(1)) if m_wt else 1

            # DaoJuPinZhi: quality level (EDJPZ_Level1 .. Level6)
            m_pz = re.search(r"DaoJuPinZhi=(\w+)", entry)
            quality = m_pz.group(1) if m_pz else ""
            # Normalize: EDJPZ_Level1 -> 1
            q_num = re.search(r"Level(\d+)", quality)
            quality_level = int(q_num.group(1)) if q_num else 0

            items.append({
                "item_ref": item_ref,
                "qty_min": int(qty_min),
                "qty_max": int(qty_max),
                "weight": weight,
                "quality": quality_level,
            })

        if items:
            groups.append({"probability": prob, "items": items})

    return groups


# ---------------------------------------------------------------------------
# Drop parsers
# ---------------------------------------------------------------------------

DROP_SOURCES = [
    ("DT_NPCDrop.json",               "npc"),
    ("DT_ShengWuCaiJiBao.json",       "creature_body"),
    ("DT_BuLuoDiaoLuoBao.json",       "tribe"),
    ("DT_ZhiBeiCaiJiBao.json",        "plant"),
    ("DT_YiJi.json",                  "ruins"),
    ("DT_DiXiaCheng.json",            "underground_city"),
    ("DT_ZhiZuo.json",                "item_bag"),
    ("DT_NpcDrop_AdditionMap01.json", "npc_dlc"),
    ("DT_Dungeon.json",               "dungeon_dlc"),
    ("DT_Relic.json",                 "relic_dlc"),
    ("DT_Tribe.json",                 "tribe_dlc"),
]


def parse_drops(names):
    all_drops = []

    for filename, source_type in DROP_SOURCES:
        rows = load_json(filename)
        count_before = len(all_drops)

        for row in rows:
            row_name  = row.get("Name", "")
            bag_name  = row.get("DaoJuBaoName", row_name)
            content   = row.get("DaoJuBaoContent", "")

            if not content or content == "()":
                continue

            groups = parse_daoju_bag_content(content)
            if not groups:
                continue

            # Flatten groups into resolved drops
            resolved_groups = []
            for g in groups:
                resolved_items = []
                for it in g["items"]:
                    resolved_items.append({
                        "item": resolve_name(it["item_ref"], names),
                        "item_ref": it["item_ref"],
                        "qty_min": it["qty_min"],
                        "qty_max": it["qty_max"],
                        "weight": it["weight"],
                        "quality": it["quality"],
                    })
                if resolved_items:
                    resolved_groups.append({
                        "probability": g["probability"],
                        "items": resolved_items,
                    })

            if resolved_groups:
                all_drops.append({
                    "row_key":     row_name,
                    "bag_name":    bag_name,
                    "source_type": source_type,
                    "groups":      resolved_groups,
                })

        added = len(all_drops) - count_before
        print("  {} entries from {}".format(added, filename))

    return all_drops


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading localization names...")
    names = load_names()
    print("  {} names loaded".format(len(names)))

    print("\nParsing drops...")
    drops = parse_drops(names)

    drops_path = OUTPUT_DIR / "drops.json"
    with open(str(drops_path), "w", encoding="utf-8") as f:
        json.dump(drops, f, ensure_ascii=False, indent=2)

    print("\nOutput:")
    print("  {}  ({} drop entries)".format(drops_path, len(drops)))

    # Print a few samples
    print("\nSample drops:")
    for entry in drops[:3]:
        print("  [{}] {} ({}):".format(
            entry["source_type"], entry["row_key"], entry["bag_name"]))
        for g in entry["groups"][:1]:
            print("    probability={}%".format(g["probability"]))
            for it in g["items"][:3]:
                print("      {} x{}-{} (wt={} q={})".format(
                    it["item"], it["qty_min"], it["qty_max"],
                    it["weight"], it["quality"]))


if __name__ == "__main__":
    main()
