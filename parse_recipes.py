"""
Parse BP_PeiFang uasset files to extract recipe data.

Input:  Game/Blueprints/PeiFang/*.uasset
Output: Game/Parsed/recipes.json

The parser extracts:
- Output item (what the recipe produces)
- Input items (materials required)
- Crafting station
- Proficiency type (skill)
- Quality levels (if applicable)

Note: Quantities are not reliably extractable without full UE4 property parsing.
This parser uses pattern matching on asset references.
"""

import re
import json
import os
from pathlib import Path

PEIFANG_DIR = Path(__file__).parent / "Game" / "Blueprints" / "PeiFang"
OUTPUT_DIR = Path(__file__).parent / "Game" / "Parsed"

# Proficiency type translations (Chinese pinyin -> English)
PROFICIENCY_MAP = {
    "PaoMu": "Carpentry",
    "WuQi": "Weapon Smithing",
    "FangJu": "Armor Smithing",
    "LianJin": "Alchemy",
    "QiJu": "Mount Equipment",
    "PengRen": "Cooking",
    "YeLian": "Smelting",
    "ZhiZao": "Crafting",
    "CaiKuang": "Mining",
    "FaMu": "Logging",
    "ZhongZhi": "Farming",
    "BuLie": "Hunting",
    "JiaZhou": "Armor Crafting",
    "RouPi": "Leatherworking",
    "RongLian": "Metal Smelting",
    "FangZhi": "Weaving",
    "ZhiTao": "Pottery",
    "Max": "None",  # Special recipes (teleports, etc.)
}

# Station name translations (Chinese pinyin -> English)
STATION_MAP = {
    # Main crafting stations
    "BP_GongZuoTai_MuJiangXi": "Carpentry Workbench",
    "BP_GongZuoTai_ZhuZaoTai": "Smithing Station",
    "BP_GongZuoTai_ZhiYaoTai": "Alchemy Table",
    "BP_GongZuoTai_JianZaoFang": "Construction Workshop",
    "BP_GongZuoTai_GongJiangTai": "Craftsman Table",
    "BP_GongZuoTai_ShuiLiFangChe": "Water Mill",
    "BP_GongZuoTai_FangZhiJi": "Loom",
    "BP_GongZuoTai_RongLianLu": "Furnace",
    "BP_GongZuoTai_PengRenTai": "Cooking Station",
    "BP_GongZuoTai_ZhiGeTai": "Leather Workbench",
    "BP_GongZuoTai_YanMo": "Grindstone",
    "BP_GongZuoTai_GaoLu": "Blast Furnace",
    "BP_GongZuoTai_JiaoYouTong": "Oil Press",
    "BP_GongZuoTai_TaoYaoLu": "Kiln",
    "BP_GongZuoTai_ZhiJiaTai": "Armor Workbench",
    "BP_GongZuoTai_JingDuan": "Forging Station",
    "BP_GongZuoTai_GaoKeJi": "High-Tech Workbench",
    "BP_GongZuoTai_TuZaiZhuo": "Butcher Table",
    "BP_GongZuoTai_ZaoTai": "Bath/Trough",
    "BP_GongZuoTai_RanGang": "Dyeing Vat",
    "BP_GongZuoTai_YanMoQi": "Grinding Machine",
    "BP_GongZuoTai_LiaoLiTai": "Cooking Table",
    "BP_GongZuoTai_ZhiGeJia": "Tanning Rack",
    "BP_GongZuoTai_NianMoJi": "Milling Machine",
    "BP_GongZuoTai_GouHuo": "Campfire",
    "BP_GongZuoTai_ZhiFeiTong": "Soap Barrel",
    "BP_GongZuoTai_NiangZaoGang": "Brewing Vat",
    "BP_GongZuoTai_JingLianLu": "Refining Furnace",
    "BP_GongZuoTai_TuYao": "Clay Kiln",
    "BP_GongZuoTai_ZhiTaoTai": "Pottery Wheel",
    "BP_GongZuoTai_FengGanXiang": "Drying Box",
    "BP_GongZuoTai_CheChuang": "Lathe",
    "BP_GongZuoTai_ZhengLiuQi": "Distiller",
    "BP_GongZuoTai_QieGeJi": "Cutting Machine",
    "BP_GongZuoTai_ZhaYouJi": "Oil Press Machine",
    "BP_GongZuoTai_ZhiBuJi": "Weaving Machine",
}


def parse_recipe(filepath):
    """Parse a single BP_PeiFang uasset file."""
    with open(filepath, "rb") as f:
        data = f.read()

    filename = Path(filepath).stem

    # Extract all /Game/ paths
    paths = []
    for m in re.finditer(rb'/Game/([A-Za-z0-9_/]+)', data):
        path = m.group(0).decode('ascii')
        paths.append({"path": path, "pos": m.start()})

    # Categorize paths
    items = []
    stations = []

    for p in paths:
        path = p["path"]
        name = path.split('/')[-1]

        # Skip recipe self-references and scripts
        if "/PeiFang/" in path or "/Script/" in path:
            continue

        # Crafting stations
        if "/GongZuoTai/" in path:
            if name not in stations:
                stations.append(name)
            continue

        # Skip UI/icons
        if "/Icon/" in path or "/UI/" in path:
            continue

        # Items (DaoJu folder structure)
        if "/DaoJu/" in path or "/Blueprints/DaoJu" in path:
            item_type = "material"
            if "/DaoJuWuQi/" in path or "/WuQi/" in path:
                item_type = "weapon"
            elif "/DaoJuFangJu/" in path or "/FangJu/" in path:
                item_type = "armor"
            elif "/DaoJuGongJu/" in path or "/GongJu/" in path:
                item_type = "tool"
            elif "/DaoJuShiWu/" in path or "/ShiWu/" in path:
                item_type = "food"
            elif "/DaoJuJianZhu/" in path or "/JianZhu/" in path:
                item_type = "building"
            elif "/DaojuCaiLiao/" in path or "/CaiLiao/" in path:
                item_type = "material"

            if not any(i['name'] == name for i in items):
                items.append({"name": name, "type": item_type, "path": path})

    # Also check for weapon/tool/armor references outside DaoJu folder
    for p in paths:
        path = p["path"]
        name = path.split('/')[-1]

        if any(i['name'] == name for i in items):
            continue

        # Direct weapon/armor/tool blueprints (BP_WuQi_, BP_FangJu_, etc.)
        if name.startswith("BP_WuQi_"):
            items.append({"name": name, "type": "weapon", "path": path})
        elif name.startswith("BP_FangJu_"):
            items.append({"name": name, "type": "armor", "path": path})
        elif name.startswith("BP_GongJu_") or name.startswith("BP_GZ_"):
            items.append({"name": name, "type": "tool", "path": path})

    # Determine output vs inputs
    output = None
    inputs = []

    recipe_suffix = filename.replace("BP_PeiFang_", "").lower()

    for item in items:
        name_lower = item['name'].lower()

        # Output heuristics
        is_output = (
            item['type'] in ('weapon', 'armor', 'tool') or
            recipe_suffix.split('_')[-1] in name_lower or
            item['type'] == 'building'
        )

        if is_output and not output:
            output = item
        else:
            inputs.append(item)

    # Fallback: first item is output
    if not output and items:
        output = items[0]
        inputs = items[1:]

    # Extract proficiency
    prof_match = re.search(rb'EProficiency::(\w+)', data)
    proficiency_raw = prof_match.group(1).decode('ascii') if prof_match else None
    proficiency = PROFICIENCY_MAP.get(proficiency_raw, proficiency_raw)

    # Extract quality levels
    qualities = sorted(set(int(q) for q in re.findall(rb'EDJPZ_Level(\d+)', data)))

    # Get station name
    station_raw = stations[0] if stations else None
    station = STATION_MAP.get(station_raw, station_raw)

    return {
        "id": filename,
        "output": {
            "item_id": output['name'] if output else None,
            "item_path": output['path'] if output else None,
            "type": output['type'] if output else None,
        } if output else None,
        "inputs": [
            {"item_id": i['name'], "item_path": i['path']}
            for i in inputs
        ],
        "station_id": station_raw,
        "station_name": station,
        "proficiency": proficiency,
        "quality_levels": qualities if qualities else None,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Find all uasset files
    uasset_files = list(PEIFANG_DIR.glob("*.uasset"))
    print(f"Found {len(uasset_files)} recipe files")

    recipes = []
    errors = []
    empty_count = 0

    for filepath in uasset_files:
        try:
            recipe = parse_recipe(filepath)

            # Skip empty/special recipes (teleports, reading, etc.)
            if not recipe['output'] and not recipe['inputs']:
                empty_count += 1
                continue

            recipes.append(recipe)
        except Exception as e:
            errors.append({"file": str(filepath), "error": str(e)})

    # Sort by recipe ID
    recipes.sort(key=lambda r: r['id'])

    # Write output
    output_path = OUTPUT_DIR / "recipes.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(recipes, f, ensure_ascii=False, indent=2)

    # Statistics
    print(f"\nResults:")
    print(f"  Parsed: {len(recipes)} recipes")
    print(f"  Skipped (empty/special): {empty_count}")
    print(f"  Errors: {len(errors)}")

    # Count by station
    stations = {}
    for r in recipes:
        s = r['station_name'] or 'Hand/None'
        stations[s] = stations.get(s, 0) + 1

    print(f"\nBy station:")
    for s, count in sorted(stations.items(), key=lambda x: -x[1]):
        print(f"  {s}: {count}")

    # Count by proficiency
    profs = {}
    for r in recipes:
        p = r['proficiency'] or 'Unknown'
        profs[p] = profs.get(p, 0) + 1

    print(f"\nBy proficiency:")
    for p, count in sorted(profs.items(), key=lambda x: -x[1]):
        print(f"  {p}: {count}")

    # Sample output
    print(f"\nSample recipes:")
    for r in recipes[:5]:
        print(f"  {r['id']}")
        print(f"    Output: {r['output']['item_id'] if r['output'] else 'None'}")
        print(f"    Inputs: {[i['item_id'] for i in r['inputs']]}")
        print(f"    Station: {r['station_name']}")

    print(f"\nOutput: {output_path}")

    if errors:
        error_path = OUTPUT_DIR / "recipe_errors.json"
        with open(error_path, "w") as f:
            json.dump(errors, f, indent=2)
        print(f"Errors: {error_path}")


if __name__ == "__main__":
    main()
