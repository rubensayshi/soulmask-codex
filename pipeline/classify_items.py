"""
Annotate items.json with a `role` field derived from the recipe graph.

Roles:
  final        — appears as a recipe output, never as an input
  intermediate — appears as both output and input
  raw          — appears as input only (never crafted)
  standalone   — not referenced by any recipe (drops, cosmetics, NPC gear, ...)

Run after parse_items.py and parse_recipes.py. Rewrites Game/Parsed/items.json
in place.
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PARSED_DIR = REPO_ROOT / "Game" / "Parsed"
ITEMS_PATH = PARSED_DIR / "items.json"
RECIPES_PATH = PARSED_DIR / "recipes.json"


def classify(inputs: set[str], outputs: set[str], item_id: str) -> str:
    is_in, is_out = item_id in inputs, item_id in outputs
    if is_out and not is_in:
        return "final"
    if is_out and is_in:
        return "intermediate"
    if is_in and not is_out:
        return "raw"
    return "standalone"


def main():
    items = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    recipes = json.loads(RECIPES_PATH.read_text(encoding="utf-8"))

    outputs: set[str] = set()
    inputs: set[str] = set()
    for r in recipes:
        out = r.get("output")
        if out and out.get("item_id"):
            outputs.add(out["item_id"])
        for slot in r.get("input_slots") or []:
            for it in slot.get("items") or []:
                if it.get("item_id"):
                    inputs.add(it["item_id"])

    counts = {"final": 0, "intermediate": 0, "raw": 0, "standalone": 0}
    for item in items:
        role = classify(inputs, outputs, item["id"])
        item["role"] = role
        counts[role] += 1

    ITEMS_PATH.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Annotated {len(items)} items using {len(recipes)} recipes")
    for role, n in counts.items():
        print(f"  {role:12} {n}")

    orphans = (inputs | outputs) - {i["id"] for i in items}
    if orphans:
        print(f"\n{len(orphans)} item_ids referenced by recipes but missing from items.json")


if __name__ == "__main__":
    main()
