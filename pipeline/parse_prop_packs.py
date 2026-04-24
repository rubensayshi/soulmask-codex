"""
Parse DT_ZhuangBeiPropTable from UAssetGUI JSON export.

Input:  uasset_export/Blueprints/DataTable/DaoJu/DT_ZhuangBeiPropTable.json.gz
Output: Game/Parsed/prop_packs.json

Each row maps a PropPack ID to an array of {attr, value, op} stat entries.
Items reference these IDs via PropPackID (base stats) and ExtraPropPackID (bonus stats).
"""

import gzip
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT = REPO_ROOT / "uasset_export" / "Blueprints" / "DataTable" / "DaoJu" / "DT_ZhuangBeiPropTable.json.gz"
OUTPUT_DIR = REPO_ROOT / "Game" / "Parsed"


def parse_attr_entry(entry):
    attr_name = None
    value = None
    op = None
    for sub in entry.get("Value", []):
        sn = sub.get("Name")
        if sn == "Attr":
            for inner in sub.get("Value", []):
                if inner.get("Name") == "AttributeName":
                    attr_name = inner.get("Value")
        elif sn == "AttrValue":
            value = sub.get("Value")
        elif sn == "CaoZuoFu":
            op = sub.get("EnumValue")
    if attr_name is None:
        return None
    if op and "::" in op:
        op = op.split("::", 1)[1]
    return {"attr": attr_name, "value": value, "op": op}


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with gzip.open(INPUT, "rt", encoding="utf-8") as f:
        data = json.load(f)

    rows = data["Exports"][1]["Table"]["Data"]
    print(f"Found {len(rows)} PropPack rows")

    packs = {}
    for row in rows:
        pack_id = int(row["Name"])
        attrs = []
        for prop in row["Value"]:
            if prop.get("Name") == "AttrList":
                for entry in prop.get("Value", []):
                    parsed = parse_attr_entry(entry)
                    if parsed:
                        attrs.append(parsed)
        packs[str(pack_id)] = attrs

    out_path = OUTPUT_DIR / "prop_packs.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(packs, f, ensure_ascii=False, indent=2)

    with_attrs = sum(1 for v in packs.values() if v)
    print(f"\nResults:")
    print(f"  Total packs: {len(packs)}")
    print(f"  With attributes: {with_attrs}")

    from collections import Counter
    attr_counts = Counter()
    for attrs in packs.values():
        for a in attrs:
            attr_counts[a["attr"]] += 1
    print(f"\nAttribute frequency:")
    for attr, count in attr_counts.most_common():
        print(f"  {attr}: {count}")

    print(f"\nOutput: {out_path}")


if __name__ == "__main__":
    main()
