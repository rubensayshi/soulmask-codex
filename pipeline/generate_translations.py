"""
Emit tasks/translate_batch.yaml — a list of keys that appear in recipes
(or otherwise need English) but aren't yet translated in manual.json / po.json.

A Claude session then fills in translations and merges into data/translations/manual.json.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARSED = ROOT / "Game" / "Parsed"
TRANSLATIONS = ROOT / "data" / "translations"
OUT = ROOT / "tasks" / "translate_batch.yaml"


def main():
    items = {i["id"]: i for i in json.loads((PARSED / "items.json").read_text(encoding="utf-8"))}
    recipes = json.loads((PARSED / "recipes.json").read_text(encoding="utf-8"))
    manual = json.loads((TRANSLATIONS / "manual.json").read_text(encoding="utf-8")).get("entries", {})
    po     = json.loads((TRANSLATIONS / "po.json").read_text(encoding="utf-8")).get("entries", {})
    known = set(manual) | set(po)

    # Items: any item that appears as recipe input or output
    needed_items = set()
    for r in recipes:
        out = r.get("output") or {}
        if out.get("item_id"):
            needed_items.add(out["item_id"])
        for inp in r.get("inputs") or []:
            needed_items.add(inp["item_id"])

    # Stations + proficiencies
    stations = {}
    profs = set()
    for r in recipes:
        if r.get("station_id"):
            stations.setdefault(r["station_id"], r.get("station_name"))
        if r.get("proficiency"):
            profs.add(r["proficiency"])

    lines = ["# Translation batch. Fill `en` values and merge into data/translations/manual.json.\n"]

    lines.append("items:\n")
    for item_id in sorted(needed_items):
        key = f"item:{item_id}"
        if key in known:
            continue
        it = items.get(item_id, {})
        name_zh = it.get("name_zh") or ""
        cat = it.get("category") or ""
        lines.append(f"  - key: {key}\n")
        lines.append(f"    zh: {json.dumps(name_zh, ensure_ascii=False)}\n")
        lines.append(f"    category: {cat}\n")
        lines.append(f"    en: \"\"\n")

    lines.append("\nstations:\n")
    for sid, sname in sorted(stations.items()):
        key = f"station:{sid}"
        if key in known:
            continue
        lines.append(f"  - key: {key}\n")
        lines.append(f"    current: {json.dumps(sname or '', ensure_ascii=False)}\n")
        lines.append(f"    en: \"\"\n")

    lines.append("\nproficiencies:\n")
    for p in sorted(profs):
        key = f"proficiency:{p}"
        if key in known:
            continue
        lines.append(f"  - key: {key}\n")
        lines.append(f"    current: {json.dumps(p, ensure_ascii=False)}\n")
        lines.append(f"    en: \"\"\n")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
