"""
Download DLC (Shifting Sands) creature spawn locations from saraserenity.net.

Temporary bridge until we have our own .umap extraction for the DLC map.
Outputs Game/Parsed/spawn_locations_dlc.json, loaded by build_db.py alongside
the base-map spawn_locations.json from parse_spawns.py.
"""
import json
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "Game" / "Parsed" / "spawn_locations_dlc.json"

URL = "https://saraserenity.net/soulmask/map/data.php?map=DLC_Level01_Main"

SPAWN_GROUPS = {"Animal Spawn"}

# saraserenity name → our internal creature_type (must match drop_sources after
# SQL normalization in GetSpawnLocationsForItem)
NAME_MAP = {
    "Giant Alligator": "Alligator",
    "Elite Alligator": "Alligator (Elite)",
    "Giant Elephant": "Elephant",
    "Elite Giant Elephant": "Elephant (Elite)",
    "Monitor Lizard": "Giant Lizard",
    "Elite Monitor Lizard": "Giant Lizard (Elite)",
    "Coconut Crab": "Lobster",
    "Rhino": "Rhinoceros",
    "Elite Rhino": "Rhinoceros (Elite)",
    "Wasteland Wolf": "Alpha Wolf",
    "Elite Wasteland Wolf": "Alpha Wolf (Elite)",
    "Wild Lion": "Lion",
    "Elite Wild Lion": "Lion (Elite)",
    "Mutant Rat": "Rat",
    "Elite Mutant Rat": "Rat (Elite)",
    "Large Boar": "Boar",
    "Lioness": "Lion",
    "Pronghorn": "Stag",
    "Armadillo Lizard": "Pangolin",
    "Elite Scorpion": "Scorpion (Elite)",
    "Black Beetle": "Scarab",
}

SKIP = {
    "(Multiple)", "Sand Bandit Patrol Fleet", "Tribe Transport Boat",
    "Fireflies", "Mutant Rat King",
}


def normalize_name(raw):
    if raw in SKIP:
        return None
    if raw in NAME_MAP:
        return NAME_MAP[raw]
    # "Elite X" → "X (Elite)"
    if raw.startswith("Elite ") and not raw.startswith("Elite Elite"):
        base = raw[6:]
        if base in NAME_MAP:
            return f"{NAME_MAP[base]} (Elite)"
        return f"{base} (Elite)"
    # "X (Ruins)" — keep as-is after mapping the base name
    if raw.endswith(" (Ruins)"):
        base = raw[:-8]
        mapped = NAME_MAP.get(base, base)
        return f"{mapped} (Ruins)"
    return raw


def main():
    print(f"Fetching DLC spawns from saraserenity.net ...")
    req = urllib.request.Request(URL, headers={"User-Agent": "SoulmaskCodex/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = json.loads(resp.read())
    print(f"  {len(raw)} categories")

    results = []
    skipped = Counter()

    for category in raw:
        if category.get("gpName") not in SPAWN_GROUPS:
            continue
        raw_name = category.get("type", "")
        creature = normalize_name(raw_name)
        if not creature:
            skipped[raw_name] += len(category.get("items", []))
            continue

        for item in category.get("items", []):
            pos = item.get("pos", {})
            data = item.get("data", {})
            lat = pos.get("lat")
            lon = pos.get("lon")
            if lat is None or lon is None:
                continue
            level = ""
            desc = data.get("desc", "")
            if desc.startswith("Level "):
                level = desc.replace("Level ", "")
            results.append({
                "creature": creature,
                "group": "Animal Spawn",
                "level": level,
                "lat": lat,
                "lon": lon,
                "map": "dlc",
            })

    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")

    creatures = Counter(r["creature"] for r in results)
    print(f"\nOutput: {OUT}")
    print(f"  {len(results)} spawn points, {len(creatures)} creature types")
    print(f"\nCreatures:")
    for c, n in creatures.most_common():
        print(f"  {n:5d}  {c}")

    if skipped:
        print(f"\nSkipped ({sum(skipped.values())} spawns):")
        for name, n in skipped.most_common():
            print(f"  {n:5d}  {name}")


if __name__ == "__main__":
    main()
