"""
Parse BP_PeiFang recipe data from UAssetGUI JSON exports.

Input:  uasset_export/Blueprints/PeiFang/**/*.json.gz  (UAssetAPI JSON format)
Output: Game/Parsed/recipes.json

Extracts full property data: inputs with quantities, output, station, craft time,
proficiency + XP, recipe level, quality levels.
"""

import gzip
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PEIFANG_DIR = REPO_ROOT / "uasset_export" / "Blueprints" / "PeiFang"
OUTPUT_DIR = REPO_ROOT / "Game" / "Parsed"

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
    "Max": "None",
}

STATION_MAP = {
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


def resolve_import_path(imports, ref):
    """Resolve an ObjectProperty ref (negative int) to its /Game/... asset path.

    Class imports (DaoJu_Item_Bone_C) have OuterIndex pointing to their Package
    import, which holds the full path.
    """
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


def extract_inputs(demand_array, imports):
    """DemandDaoJu = array of ZhiZuoDemandDaoJu structs, each with inner
    DemandDaoJu (object array) + DemandCount (int)."""
    result = []
    for struct in demand_array.get("Value") or []:
        item_path = None
        quantity = None
        for sub in struct.get("Value") or []:
            if not isinstance(sub, dict):
                continue
            if sub.get("Name") == "DemandDaoJu":
                objs = sub.get("Value") or []
                if objs:
                    item_path = resolve_import_path(imports, objs[0].get("Value"))
            elif sub.get("Name") == "DemandCount":
                quantity = sub.get("Value")
        if item_path:
            result.append({
                "item_id": item_path.split("/")[-1],
                "item_path": item_path,
                "quantity": quantity if quantity is not None else 1,
            })
    return result


def extract_stations(match_data, imports):
    """MatchGongZuoTaiData → [{MustMatchGongZuoTaiList, NeedGongZuoTaiLevel, ...}]"""
    stations = []
    required_level = 0
    for struct in match_data.get("Value") or []:
        for sub in struct.get("Value") or []:
            if not isinstance(sub, dict):
                continue
            if sub.get("Name") == "MustMatchGongZuoTaiList":
                for obj in sub.get("Value") or []:
                    path = resolve_import_path(imports, obj.get("Value"))
                    if path:
                        stations.append(path)
            elif sub.get("Name") == "NeedGongZuoTaiLevel":
                required_level = max(required_level, sub.get("Value") or 0)
    return stations, required_level


def extract_quality_levels(rand_data):
    levels = set()
    if not rand_data:
        return []
    stack = [rand_data]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            v = node.get("EnumValue")
            if isinstance(v, str) and v.startswith("EDaoJuPinZhi::EDJPZ_Level"):
                try:
                    levels.add(int(v.rsplit("Level", 1)[1]))
                except ValueError:
                    pass
            if "Value" in node:
                stack.append(node["Value"])
        elif isinstance(node, list):
            stack.extend(node)
    return sorted(levels)


def parse_recipe(filepath):
    with gzip.open(filepath, "rt", encoding="utf-8") as f:
        data = json.load(f)

    imports = data.get("Imports") or []
    exports = data.get("Exports") or []

    filename = Path(filepath).name.replace(".json.gz", "")

    unique_id = (get_prop(exports, "PeiFangUniqueID") or {}).get("Value")
    brief = (get_prop(exports, "PeiFangBrief") or {}).get("Value")
    recipe_level = (get_prop(exports, "PeiFangDengJi") or {}).get("Value")
    make_time = (get_prop(exports, "PeiFangMakeTime") or {}).get("Value")
    xp = (get_prop(exports, "MakeAddProficiencyExp") or {}).get("Value")
    by_hand = (get_prop(exports, "ExtraSupportMakeByHand") or {}).get("Value")

    prof_prop = get_prop(exports, "MakeProficiencyType")
    prof_raw = None
    if prof_prop:
        ev = prof_prop.get("EnumValue")
        if ev and "::" in ev:
            prof_raw = ev.split("::", 1)[1]
    proficiency = PROFICIENCY_MAP.get(prof_raw, prof_raw)

    produce_prop = get_prop(exports, "ProduceDaoJu")
    output_path = resolve_import_path(imports, produce_prop.get("Value")) if produce_prop else None
    output = None
    if output_path:
        output = {
            "item_id": output_path.split("/")[-1],
            "item_path": output_path,
        }

    demand_prop = get_prop(exports, "DemandDaoJu")
    inputs = extract_inputs(demand_prop, imports) if demand_prop else []

    match_prop = get_prop(exports, "MatchGongZuoTaiData")
    station_paths, station_level = extract_stations(match_prop, imports) if match_prop else ([], 0)
    primary_station = station_paths[0] if station_paths else None
    station_id = primary_station.split("/")[-1] if primary_station else None
    station_name = STATION_MAP.get(station_id, station_id)

    rand_prop = get_prop(exports, "MakeRandPinZhiData")
    qualities = extract_quality_levels(rand_prop)

    return {
        "id": filename,
        "unique_id": unique_id,
        "brief_zh": brief,
        "recipe_level": recipe_level,
        "output": output,
        "inputs": inputs,
        "station_id": station_id,
        "station_name": station_name,
        "station_paths": station_paths if len(station_paths) > 1 else None,
        "station_required_level": station_level or None,
        "can_make_by_hand": by_hand,
        "craft_time_seconds": make_time,
        "proficiency": proficiency,
        "proficiency_xp": xp,
        "quality_levels": qualities if qualities else None,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(PEIFANG_DIR.rglob("BP_PeiFang_*.json.gz"))
    print(f"Found {len(files)} recipe files")

    recipes = []
    errors = []
    empty = 0

    for fp in files:
        try:
            r = parse_recipe(fp)
            if not r["output"] and not r["inputs"]:
                empty += 1
                continue
            recipes.append(r)
        except Exception as e:
            errors.append({"file": str(fp), "error": str(e)})

    recipes.sort(key=lambda r: r["id"])

    out_path = OUTPUT_DIR / "recipes.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(recipes, f, ensure_ascii=False, indent=2)

    with_qty = sum(1 for r in recipes if r["inputs"] and all(i["quantity"] is not None for i in r["inputs"]))
    print(f"\nResults:")
    print(f"  Parsed: {len(recipes)}")
    print(f"  Skipped (empty): {empty}")
    print(f"  Errors: {len(errors)}")
    print(f"  With full quantities: {with_qty} ({100*with_qty/max(1,len(recipes)):.1f}%)")

    stations = {}
    for r in recipes:
        s = r["station_name"] or "Hand/None"
        stations[s] = stations.get(s, 0) + 1
    print(f"\nBy station:")
    for s, c in sorted(stations.items(), key=lambda x: -x[1])[:15]:
        print(f"  {s}: {c}")

    profs = {}
    for r in recipes:
        p = r["proficiency"] or "Unknown"
        profs[p] = profs.get(p, 0) + 1
    print(f"\nBy proficiency:")
    for p, c in sorted(profs.items(), key=lambda x: -x[1]):
        print(f"  {p}: {c}")

    print(f"\nSample recipes:")
    for r in recipes[:3]:
        print(f"  {r['id']} (lvl {r['recipe_level']}, {r['craft_time_seconds']}s)")
        print(f"    Output: {r['output']['item_id'] if r['output'] else 'None'}")
        for i in r["inputs"]:
            print(f"    Input: {i['quantity']}x {i['item_id']}")
        print(f"    Station: {r['station_name']}  hand={r['can_make_by_hand']}")

    print(f"\nOutput: {out_path}")

    if errors:
        err_path = OUTPUT_DIR / "recipe_errors.json"
        with open(err_path, "w") as f:
            json.dump(errors, f, indent=2)
        print(f"Errors: {err_path}")


if __name__ == "__main__":
    main()
