"""
parse_spawns.py — Build spawn_locations.json + spawn_locations_dlc.json from spawns.json.

Uses the scg_class field (creature blueprint path) to resolve creature types.
No dependency on uasset_export/ blueprint files.

Input:  Game/Parsed/spawns.json  (extracted from .umap level files on Windows)
Output: Game/Parsed/spawn_locations.json      (base map, same schema build_db.py expects)
        Game/Parsed/spawn_locations_dlc.json   (DLC map)
"""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPAWNS_JSON = ROOT / "Game" / "Parsed" / "spawns.json"
NAMES_JSON = ROOT / "data" / "translations" / "creature_names.json"
OUT_BASE = ROOT / "Game" / "Parsed" / "spawn_locations.json"
OUT_DLC = ROOT / "Game" / "Parsed" / "spawn_locations_dlc.json"

SCALE_LON = 0.0050178419
OFFSET_LON = 2048.206056
SCALE_LAT = -0.0050222678
OFFSET_LAT = -2048.404771

BASE_MAPS = {"Level01_GamePlay", "Level01_GamePlay2", "Level01_GamePlay3"}
DLC_MAPS = {"DLC_Level01_GamePlay", "DLC_Level01_GamePlay2", "DLC_Level01_GamePlay3"}

ANIMAL_SPAWNER_CLASS = "HShuaGuaiQiBase"

SPECIAL_SPAWNERS = {
    "BP_HShuaGuaiQi_ShouLong_C": "ShouLong",
    "BP_HShuaGuaiQi_JuanShe_C": "JuanShe",
    "BP_HShuaGuaiQi_TuoNiao_C": "TuoNiao",
}

SGQ_STRIP = {"Elite", "Kuang", "Kurma", "ChaoXue", "DongWu", "Boss"}
SGQ_TIER_RE = re.compile(r"^T\d+$")

DLC_NAME_MAP = {
    "Piranhas": "Piranha",
    "WildBoar": "Boar",
    "WildBoarL": "Large Boar",
    "SacredLbis": "Sacred Ibis",
    "Crocodile": "Alligator",
    "Ammotragus": "Barbary Sheep",
    "Hyenas": "Hyena",
    "Ass": "Donkey",
    "Bass": "Perch",
    "PharaohHound": "Pharaoh Hound",
    "Varanid": "Giant Lizard",
    "WildLion": "Lion",
    "WildWolf": "Alpha Wolf",
    "ArmadilloLizard": "Pangolin",
    "Liones": "Lion",
    "SangaCattle": "Longhorn",
    "Antelope": "Stag",
    "Hydrocynus": "Tigerfish",
    "ScorpionMAX": "Giant Scorpion",
    "ElectricEel": "Electric Eel",
    "HoneyBadger": "Honey Badger",
    "Elephant_Kurma": "Elephant",
    "Ostrich_Combat": "Combat Ostrich",
    "CobraMAX": "Giant Cobra",
    "Mouse": "Rat",
    "Crab": "Lobster",
    "Fennec": "Fennec Fox",
}


def ue4_to_map(pos_x, pos_y):
    lon = round(pos_x * SCALE_LON + OFFSET_LON)
    lat = round(pos_y * SCALE_LAT + OFFSET_LAT)
    return lon, lat


def load_spawns():
    raw = SPAWNS_JSON.read_bytes()
    text = raw.decode("utf-8-sig")
    return json.loads(text)


def load_creature_names():
    return json.loads(NAMES_JSON.read_text(encoding="utf-8"))


BASE_ANIMAL_PATHS = {"SGQ_DongWu", "SGQ_ChaoXue"}


def parse_base_scg_class(scg_class):
    """Extract creature Pinyin + elite flag from a BP_SGQ_* blueprint name."""
    if not any(p in scg_class for p in BASE_ANIMAL_PATHS):
        return None, False
    name = scg_class.rsplit("/", 1)[-1].split(".")[0]
    if not name.startswith("BP_SGQ_"):
        return None, False
    inner = name[7:]
    parts = inner.split("_")
    is_elite = "Elite" in parts
    filtered = [p for p in parts
                if p not in SGQ_STRIP and not SGQ_TIER_RE.match(p)]
    # Strip trailing digits from creature name (e.g. BaoZi1 → BaoZi)
    if filtered:
        filtered[-1] = re.sub(r"\d+$", "", filtered[-1])
        filtered = [p for p in filtered if p]
    creature = "_".join(filtered) if filtered else None
    return creature, is_elite


def parse_dlc_scg_class(scg_class):
    """Extract creature English name + elite flag from a BP_Beast_* blueprint name."""
    name = scg_class.rsplit("/", 1)[-1].split(".")[0]
    if not name.startswith("BP_Beast_"):
        return None, False
    inner = name[9:]
    parts = inner.split("_")
    is_elite = "Elite" in parts
    stripped = [p for p in parts
                if p not in ("Elite", "Boss") and not re.match(r"^NO\d+$", p)]
    # Rejoin — handles multi-word like Ostrich_Combat, Elephant_Kurma
    raw_name = "_".join(stripped) if stripped else None
    if not raw_name:
        return None, is_elite
    # MAX suffix → separate creature variant (Giant Scorpion, Giant Cobra)
    english = DLC_NAME_MAP.get(raw_name, raw_name)
    return english, is_elite


def main():
    print("Loading spawns.json ...")
    spawns = load_spawns()
    print(f"  {len(spawns)} total actors")

    print("Loading creature names ...")
    creature_names = load_creature_names()
    creature_names_lower = {k.lower(): v for k, v in creature_names.items()}

    base_results = []
    dlc_results = []
    unresolved = Counter()

    # --- Process base + DLC open-world animal spawners ---
    for spawn in spawns:
        map_name = spawn["map"]
        spawner_class = spawn["spawner_class"]
        scg_class = spawn.get("scg_class")

        is_base = map_name in BASE_MAPS
        is_dlc = map_name in DLC_MAPS
        if not is_base and not is_dlc:
            continue

        # Determine creature name
        creature = None
        is_elite = False

        if spawner_class in SPECIAL_SPAWNERS:
            pinyin = SPECIAL_SPAWNERS[spawner_class]
            creature = creature_names.get(pinyin) or creature_names_lower.get(pinyin.lower())
            if not creature:
                unresolved[f"special:{spawner_class}"] += 1
                continue

        elif scg_class:
            if is_base:
                pinyin, is_elite = parse_base_scg_class(scg_class)
                if not pinyin:
                    continue
                creature = creature_names.get(pinyin) or creature_names_lower.get(pinyin.lower())
                if not creature:
                    unresolved[f"no-translation:{pinyin}"] += 1
                    continue
            elif is_dlc:
                creature, is_elite = parse_dlc_scg_class(scg_class)
                if not creature:
                    continue
        else:
            continue

        if is_elite:
            creature = f"{creature} (Elite)"

        lon, lat = ue4_to_map(spawn["pos_x"], spawn["pos_y"])
        entry = {
            "creature": creature,
            "group": "Animal Spawn",
            "level": "",
            "lat": lat,
            "lon": lon,
            "map": "dlc" if is_dlc else "base",
        }

        if is_dlc:
            dlc_results.append(entry)
        else:
            base_results.append(entry)

    # Write outputs
    OUT_BASE.write_text(json.dumps(base_results, indent=2), encoding="utf-8")
    OUT_DLC.write_text(json.dumps(dlc_results, indent=2), encoding="utf-8")

    # Summary
    base_creatures = Counter(r["creature"] for r in base_results)
    dlc_creatures = Counter(r["creature"] for r in dlc_results)

    print(f"\nBase map: {OUT_BASE}")
    print(f"  {len(base_results)} spawn points, {len(base_creatures)} creature types")
    print(f"\nDLC map: {OUT_DLC}")
    print(f"  {len(dlc_results)} spawn points, {len(dlc_creatures)} creature types")

    print(f"\nBase creatures:")
    for c, n in base_creatures.most_common():
        print(f"  {n:5d}  {c}")

    print(f"\nDLC creatures:")
    for c, n in dlc_creatures.most_common():
        print(f"  {n:5d}  {c}")

    if unresolved:
        print(f"\nUnresolved ({sum(unresolved.values())} spawns):")
        for p, n in unresolved.most_common(20):
            print(f"  {n:5d}  {p}")


if __name__ == "__main__":
    main()
