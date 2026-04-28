"""
parse_spawns.py — Build spawn_locations.json from our own .umap extraction + spawner blueprints.

Joins two data sources:
  1. Game/Parsed/spawns.json — actor coordinates extracted from .umap level files
     (produced by parse_spawns_run.ps1 on Windows, committed on docs/spawn-extraction branch)
  2. uasset_export/Blueprints/ShuaGuaiQi/**/*.json.gz — spawner blueprint configs
     (creature class, level range, spawn count)

Output: Game/Parsed/spawn_locations.json (same schema build_db.py expects)
"""
import gzip
import json
import re
import glob
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPAWNS_JSON = ROOT / "Game" / "Parsed" / "spawns.json"
BP_DIR = ROOT / "uasset_export" / "Blueprints" / "ShuaGuaiQi"
NAMES_JSON = ROOT / "data" / "translations" / "creature_names.json"
OUT = ROOT / "Game" / "Parsed" / "spawn_locations.json"

SCALE_LON = 0.0050178419
OFFSET_LON = 2048.206056
SCALE_LAT = -0.0050222678
OFFSET_LAT = -2048.404771

OPEN_WORLD_MAPS = {"Level01_GamePlay", "Level01_GamePlay2", "Level01_GamePlay3"}

ANIMAL_SPAWNER_CLASS = "HShuaGuaiQiBase"

CONTEXT_PREFIXES = {"YiJi", "Kuang", "DongWu", "ChaoXue", "ShiJian", "DiXiaCheng"}

RUINS_SPAWNER_CLASS = "BP_HShuaGuaiQiRandNPC_C"

RUINS_LOCATIONS = {"DongKu", "TianKeng", "HeiSenLin", "HuoShan", "BingGu", "ZhaoZe"}

SKIP_ACTOR_PATTERNS = {
    "ShouWei", "ChiHou", "XinShou", "KuangYeYuan", "Kurma",
    "TuoNiaoDan", "Event_Shop", "Event_EnemyMount", "LDZ_Event",
    "Patrol_", "RuQin_",
}

SKIP_GENERIC_MINE = re.compile(r"SGQ_Kuang_T\d+_(?:DongWu|Dongwu|YeShou)")
SKIP_GENERIC_YIJI = re.compile(r"SGQ_YiJi_T\d+_(?:YeShou|LFZ|JiXie|Ren)")

TIER_RE = re.compile(r"^T(\d{1,2})$")


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


def load_all_blueprints():
    bp_files = glob.glob(str(BP_DIR / "**" / "*.json.gz"), recursive=True)
    bp_lookup = {}
    for f in bp_files:
        name = re.sub(r"\.json\.gz$", "", Path(f).name)
        bp_lookup[name] = f
    return bp_lookup


def parse_blueprint(path):
    with gzip.open(path) as f:
        data = json.load(f)

    imports = data.get("Imports", [])
    cdo = None
    for exp in data.get("Exports", []):
        if "Default__" in exp.get("ObjectName", ""):
            cdo = exp
            break
    if not cdo:
        return None

    scg_list = None
    for prop in cdo.get("Data", []):
        if prop.get("Name") == "SCGInfoList":
            scg_list = prop
            break
    if not scg_list:
        return None

    entries = []
    for info in scg_list.get("Value", []):
        for sgb_prop in info.get("Value", []):
            if sgb_prop.get("Name") != "SGBList":
                continue
            for config in sgb_prop.get("Value", []):
                creature_ref = None
                level_min = level_max = None
                for p in config.get("Value", []):
                    if p.get("Name") == "GuaiWuClass":
                        ref = p.get("Value", 0)
                        if isinstance(ref, int) and ref < 0:
                            idx = (-ref) - 1
                            if idx < len(imports):
                                creature_ref = imports[idx]["ObjectName"]
                    elif p.get("Name") == "SCGZuiXiaoDengJi":
                        level_min = p.get("Value")
                    elif p.get("Name") == "SCGZuiDaDengJi":
                        level_max = p.get("Value")
                if creature_ref:
                    entries.append({
                        "creature_class": creature_ref,
                        "level_min": level_min,
                        "level_max": level_max,
                    })
    return entries if entries else None


def find_blueprint(prefix, bp_lookup):
    if f"BP_{prefix}" in bp_lookup:
        return f"BP_{prefix}"
    parts = prefix.split("_")
    if len(parts) >= 3:
        for i in range(1, len(parts)):
            for j in range(i + 1, len(parts)):
                swapped = parts[:]
                swapped[i], swapped[j] = swapped[j], swapped[i]
                candidate = "BP_" + "_".join(swapped)
                if candidate in bp_lookup:
                    return candidate
    return None


def extract_creature_pinyin(actor_prefix):
    """Extract creature Pinyin name and elite flag from actor_name prefix."""
    parts = actor_prefix.split("_")
    if not parts or parts[0] != "SGQ":
        return None, False

    tokens = parts[1:]
    is_elite = "Elite" in tokens
    tokens = [t for t in tokens if t != "Elite"]
    tokens = [t for t in tokens if t not in CONTEXT_PREFIXES]
    tokens = [t for t in tokens if not TIER_RE.match(t)]
    # Remove sub-type suffixes like Mu, Xiao, Egg, Dan, etc.
    tokens = [t for t in tokens if t not in {"Mu", "Xiao", "Dan", "Egg", "Event", "Boss",
                                              "ShenMi", "YeMan", "ZhiHui", "BuLuo", "LFZ",
                                              "LDZ", "Guard", "Hunter", "Warrior", "Artisan",
                                              "YeShou", "DongWu", "JiXie", "Ren", "JingYing",
                                              "HuWei", "Nv", "BuLuoRuQin"}]

    if not tokens:
        return None, is_elite

    creature = tokens[0]
    return creature, is_elite


CLASS_SUFFIXES = {
    "JY", "JingYing", "YiJi", "Mu", "Xiao", "Egg", "Special",
    "EnemyMount", "ShopMount", "ZhuDong", "BuLuo", "C",
}

def creature_class_to_pinyin(class_name):
    """BP_DongWu_EYu_C → EYu, BP_DongWu_EYu_YiJi_C → EYu"""
    if not class_name.startswith("BP_DongWu_") or not class_name.endswith("_C"):
        return None
    inner = class_name[len("BP_DongWu_"):-2]
    parts = inner.split("_")
    creature_parts = [p for p in parts if p not in CLASS_SUFFIXES]
    return "_".join(creature_parts) if creature_parts else None


def format_level(level_min, level_max):
    if level_min is None or level_max is None:
        return ""
    if level_min == level_max:
        return str(level_min)
    return f"{level_min} - {level_max}"


def main():
    print("Loading spawns.json ...")
    spawns = load_spawns()
    print(f"  {len(spawns)} total actors")

    print("Loading creature names ...")
    creature_names = load_creature_names()
    creature_names_lower = {k.lower(): v for k, v in creature_names.items()}

    print("Loading spawner blueprints ...")
    bp_lookup = load_all_blueprints()
    print(f"  {len(bp_lookup)} blueprints")

    # Pre-parse all relevant blueprints
    bp_cache = {}

    # Filter to open-world animal spawners
    animals = [s for s in spawns
               if s.get("spawner_class") == ANIMAL_SPAWNER_CLASS
               and s.get("map") in OPEN_WORLD_MAPS]
    print(f"  {len(animals)} open-world animal spawners")

    results = []
    unresolved = Counter()
    skipped = Counter()

    for spawn in animals:
        actor_name = spawn["actor_name"]
        prefix = re.sub(r"_?\d+$", "", actor_name)

        if any(pat in prefix for pat in SKIP_ACTOR_PATTERNS):
            skipped[prefix] += 1
            continue
        if SKIP_GENERIC_MINE.match(prefix) or SKIP_GENERIC_YIJI.match(prefix):
            skipped[prefix] += 1
            continue

        # Try blueprint match for level range
        bp_name = find_blueprint(prefix, bp_lookup)
        bp_data = None
        if bp_name:
            if bp_name not in bp_cache:
                bp_cache[bp_name] = parse_blueprint(bp_lookup[bp_name])
            bp_data = bp_cache[bp_name]

        # Get creature name + elite flag from actor_name (primary source)
        creature_pinyin, is_elite = extract_creature_pinyin(prefix)

        # Use blueprint for level range and elite detection; only use blueprint's
        # creature class as fallback when actor_name didn't yield a creature.
        level_min = level_max = None
        if bp_data:
            entry = bp_data[0]
            level_min = entry["level_min"]
            level_max = entry["level_max"]
            if not creature_pinyin:
                bp_creature = creature_class_to_pinyin(entry["creature_class"])
                if bp_creature:
                    creature_pinyin = bp_creature
            cls = entry["creature_class"]
            if "_JY_" in cls or cls.endswith("_JY_C") or "_JingYing" in cls:
                is_elite = True

        if not creature_pinyin:
            unresolved[prefix] += 1
            continue

        # Translate to English
        english = creature_names.get(creature_pinyin) or creature_names_lower.get(creature_pinyin.lower())
        if not english:
            unresolved[f"{prefix} (no translation: {creature_pinyin})"] += 1
            continue

        if is_elite:
            english = f"{english} (Elite)"

        # Convert coordinates
        lon, lat = ue4_to_map(spawn["pos_x"], spawn["pos_y"])
        level_str = format_level(level_min, level_max)

        results.append({
            "creature": english,
            "group": "Animal Spawn",
            "level": level_str,
            "lat": lat,
            "lon": lon,
            "map": "base",
        })

    # --- Ruins spawns (location-specific YeShou from BP_HShuaGuaiQiRandNPC_C) ---
    ruins_actors = [s for s in spawns
                    if s.get("spawner_class") == RUINS_SPAWNER_CLASS
                    and s.get("map") in OPEN_WORLD_MAPS]
    ruins_count = 0

    for spawn in ruins_actors:
        actor_name = spawn["actor_name"]
        prefix = re.sub(r"_?\d+$", "", actor_name)
        parts = prefix.split("_")

        if "YiJi" not in parts or "YeShou" not in prefix:
            continue
        location = None
        for p in parts:
            if p in RUINS_LOCATIONS:
                location = p
                break
        if not location:
            continue

        is_elite = "Elite" in parts
        stripped = prefix.replace("YiJi_", "")
        bp_base = f"BP_{stripped}"

        matched_bps = []
        if bp_base in bp_lookup:
            matched_bps.append(bp_base)
        for suffix_n in range(1, 4):
            for variant in [f"{bp_base}{suffix_n}", f"{bp_base}_{suffix_n}"]:
                if variant in bp_lookup:
                    matched_bps.append(variant)

        if not matched_bps:
            unresolved[f"{prefix} (ruins)"] += 1
            continue

        lon, lat = ue4_to_map(spawn["pos_x"], spawn["pos_y"])

        for bp_name in matched_bps:
            if bp_name not in bp_cache:
                bp_cache[bp_name] = parse_blueprint(bp_lookup[bp_name])
            bp_data = bp_cache[bp_name]
            if not bp_data:
                continue

            entry = bp_data[0]
            bp_creature = creature_class_to_pinyin(entry["creature_class"])
            if not bp_creature:
                continue

            english = creature_names.get(bp_creature) or creature_names_lower.get(bp_creature.lower())
            if not english:
                unresolved[f"{prefix} (no translation: {bp_creature})"] += 1
                continue

            level_str = format_level(entry["level_min"], entry["level_max"])
            cls = entry["creature_class"]
            entry_elite = is_elite or "_JY_" in cls or cls.endswith("_JY_C") or "_JingYing" in cls

            if entry_elite:
                label = f"{english} (Elite) (Ruins)"
            else:
                label = f"{english} (Ruins)"

            results.append({
                "creature": label,
                "group": "Animal Spawn",
                "level": level_str,
                "lat": lat,
                "lon": lon,
                "map": "base",
            })
            ruins_count += 1

    print(f"  {ruins_count} ruins spawn points added")

    # Write output
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")

    # Summary
    creatures = Counter(r["creature"] for r in results)
    print(f"\nOutput: {OUT}")
    print(f"  {len(results)} spawn points, {len(creatures)} creature types")
    print(f"\nTop creatures:")
    for c, n in creatures.most_common(25):
        print(f"  {n:5d}  {c}")

    if unresolved:
        print(f"\nUnresolved ({sum(unresolved.values())} spawns):")
        for p, n in unresolved.most_common(20):
            print(f"  {n:5d}  {p}")

    if skipped:
        print(f"\nSkipped ({sum(skipped.values())} spawns):")
        for p, n in skipped.most_common(10):
            print(f"  {n:5d}  {p}")


if __name__ == "__main__":
    main()
