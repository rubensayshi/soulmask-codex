"""
Parse tribesmen trait (NaturalGift/天赋) data from UAssetGUI JSON exports.

Input:  uasset_export/Blueprints/DataTable/NaturalGift/DT_GiftZongBiao.json.gz
Output: Game/Parsed/traits.json

Extracts trait properties: name, description, star level, effect type/value,
upgrade chains, DLC flag, proficiency/weapon restrictions, activation conditions.
"""

import gzip
import json
import os
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GIFT_DIR = REPO_ROOT / "uasset_export" / "Blueprints" / "DataTable" / "NaturalGift"
TRAITS_FILE = GIFT_DIR / "DT_GiftZongBiao.json.gz"
OUTPUT_DIR = REPO_ROOT / "Game" / "Parsed"

CLAN_CONDS = {
    "BP_Gift_IsZDZhiYe_LiZhua_C": "claw",
    "BP_Gift_IsZDZhiYe_HuoShi_C": "flint",
    "BP_Gift_IsSHZhiYeJiangRen_HuoShi_C": "flint",
    "BP_Gift_IsZDZhiYe_DuYa_C": "fang",
    "BP_Gift_IsSHZhiYe_DuYa_C": "fang",
    "BP_Gift_IsWolf_ZD_C": "wolf",
    "BP_Gift_IsWolf_JR_C": "wolf",
    "BP_Gift_IsHorn_ZD_C": "horn",
    "BP_Gift_IsHorn_JR_C": "horn",
    "BP_Gift_IsDLCNpc_ZD_C": "dlc",
    "BP_Gift_IsDLCNpc_C": "dlc",
    "BP_Gift_IsDLC_JR_C": "dlc",
    "BP_Gift_IsDLC_ZS_C": "dlc",
    "BP_Gift_IsDLC_WS_C": "dlc",
    "BP_Gift_IsDLC_LS_C": "dlc",
}

GENERIC_CONDS = {
    "BP_Gift_IsZDZhiYe_C", "BP_Gift_IsSHZhiYe_C",
    "BP_Gift_IsZDZhiYeLieShou_C", "BP_Gift_IsZDZhiYeZhanShi_C",
    "BP_Gift_IsZDZhiYeWeiShi_C", "BP_Gift_IsSHZhiYeJiangRen_C",
    "BP_Gift_IsSHZhiYeZaGong_C", "BP_Gift_IsZDZhiYe_PinZhi_C",
    "BP_Gift_IsPinZhi_4+_C", "BP_Gift_IsRandom_C",
    "BP_Gift_IsYuFenPeiDengJi_C", "BP_Gift_Is45TiXing_C",
    "BP_Gift_Is123TiXing_C", "BP_Gift_IsDengJi80_C",
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


def resolve_import_name(imports, ref):
    """Resolve a negative import ref to the import's ObjectName."""
    if ref is None or ref >= 0:
        return None
    idx = -ref - 1
    if idx >= len(imports):
        return None
    return imports[idx].get("ObjectName")


def strip_enum(val):
    """'ENaturalGiftEffect::AttrInc' → 'AttrInc'"""
    if isinstance(val, str) and "::" in val:
        return val.split("::", 1)[1]
    return val


def get_field(props, name):
    for p in props:
        if p.get("Name") == name:
            return p
    return None


def parse_pool_file(path):
    """Extract (trait_id, condition_set) pairs from a trait pool file."""
    with gzip.open(path, "rt", encoding="utf-8") as f:
        raw = json.load(f)
    imports = raw.get("Imports") or []
    data = None
    for exp in raw.get("Exports", []):
        if "Table" in exp and "Data" in exp["Table"]:
            data = exp["Table"]["Data"]
            break
    if not data:
        return []
    results = []
    for row in data:
        props = row.get("Value", [])
        cond_field = get_field(props, "TiaoJianBaoList")
        conds = set()
        if cond_field:
            for c in cond_field.get("Value", []):
                ref = c.get("Value", 0) if isinstance(c, dict) else c
                name = resolve_import_name(imports, ref)
                if name:
                    conds.add(name)
        detail_field = get_field(props, "NGDetailList")
        if detail_field:
            for detail in detail_field.get("Value", []):
                detail_props = detail.get("Value", [])
                id_field = get_field(detail_props, "ID")
                if id_field:
                    tid = str(id_field.get("Value", ""))
                    if tid and tid != "0":
                        results.append((tid, conds))
    return results


def build_clan_map():
    """Parse all trait pool tables and return trait_id → clan string.

    A trait is tagged with a clan only if it appears exclusively in
    clan-specific pool rows (not in any generic/unconditioned row).
    """
    # trait_id → list of (filename, condition_set) per pool row
    trait_rows = defaultdict(list)

    pool_files = [f for f in sorted(os.listdir(GIFT_DIR))
                  if f.startswith("DT_Gift") and f.endswith(".json.gz")
                  and f != "DT_GiftZongBiao.json.gz"
                  and f != "DT_GiftLengLuoBiao.json.gz"]

    for fname in pool_files:
        try:
            for tid, conds in parse_pool_file(GIFT_DIR / fname):
                trait_rows[tid].append((fname, conds))
        except Exception:
            pass

    clan_map = {}
    for tid, rows in trait_rows.items():
        clans_found = set()
        has_generic = False
        for fname, conds in rows:
            row_clans = {CLAN_CONDS[c] for c in conds if c in CLAN_CONDS}
            if row_clans:
                clans_found.update(row_clans)
            elif not conds or conds.issubset(GENERIC_CONDS):
                has_generic = True
            # Boss files as fallback clan source
            if "XieDuZhe" in fname:
                clans_found.add("heretic")

        # Only tag if exclusively one clan (not also in generic pools)
        if clans_found and not has_generic and len(clans_found) == 1:
            clan_map[tid] = next(iter(clans_found))

    return clan_map


def derive_clan_from_name(name_zh, source):
    """Derive clan from Chinese name patterns for BornBuLuoCiTiao traits."""
    if source != "BornBuLuoCiTiao" or not name_zh:
        return None
    if "荒狼" in name_zh:
        return "wolf"
    if "蛮角" in name_zh:
        return "horn"
    if name_zh.startswith("流放者"):
        return "exile"
    return None


def parse_traits():
    with gzip.open(TRAITS_FILE, "rt", encoding="utf-8") as f:
        data = json.load(f)

    imports = data.get("Imports") or []

    dt_export = None
    for exp in data.get("Exports", []):
        if "DataTable" in exp.get("$type", ""):
            dt_export = exp
            break
    if not dt_export:
        raise SystemExit("No DataTableExport found in DT_GiftZongBiao")

    rows = dt_export["Table"]["Data"]
    traits = []

    for row in rows:
        tid = row.get("Name", "")
        props = row.get("Value", [])

        star = (get_field(props, "Star") or {}).get("Value")
        name_zh = (get_field(props, "Title") or {}).get("CultureInvariantString")
        desc_zh = (get_field(props, "Desc") or {}).get("CultureInvariantString")
        vague_zh = (get_field(props, "MoHuDesc") or {}).get("CultureInvariantString")

        source_raw = (get_field(props, "NGEffectSource") or {}).get("EnumValue")
        effect_raw = (get_field(props, "NGEffect") or {}).get("EnumValue")
        attr_raw = (get_field(props, "NGEffectAttrType") or {}).get("Value")
        effect_val = (get_field(props, "NGEffectVal") or {}).get("Value")
        is_pct = (get_field(props, "NGEffectAttrValOrPer") or {}).get("Value")
        prob = (get_field(props, "NGEffectPr") or {}).get("Value")
        cooldown = (get_field(props, "NGEffectCD") or {}).get("Value")

        learned = (get_field(props, "LearnedNGID") or {}).get("Value", 0)
        upgrade = (get_field(props, "UpgradeNGID") or {}).get("Value", 0)
        weight = (get_field(props, "BaseWeight") or {}).get("Value")
        icon_ref = (get_field(props, "Pic") or {}).get("Value")

        # Negative trait detection: game uses "_2" suffix on icon textures for negative traits
        icon_name = resolve_import_name(imports, icon_ref) if icon_ref else None
        is_negative = bool(icon_name and icon_name.endswith("_2"))

        # DLC detection: check if any GE class name contains "DLC"
        ge_list = (get_field(props, "NGGEClassList") or {}).get("Value", [])
        is_dlc = False
        for ge in ge_list:
            ref = ge.get("Value", 0)
            if ref < 0:
                name = resolve_import_name(imports, ref)
                if name and "DLC" in name:
                    is_dlc = True
                    break

        # Proficiency restrictions
        prof_list = (get_field(props, "NGProfTypeList") or {}).get("Value", [])
        profs = []
        for p in prof_list:
            ev = p.get("EnumValue")
            if ev:
                profs.append(strip_enum(ev))

        # Weapon restrictions (MapProperty: list of [key, value] pairs)
        weapon_field = get_field(props, "WeaponDemand")
        weapons = []
        if weapon_field:
            for pair in weapon_field.get("Value", []):
                if isinstance(pair, list) and len(pair) >= 1:
                    ev = pair[0].get("Value")
                    if ev:
                        weapons.append(strip_enum(ev))

        # Activation conditions
        cond_list = (get_field(props, "TiaoJianBaoList") or {}).get("Value", [])
        conditions = []
        for c in cond_list:
            ref = c.get("Value", 0)
            if ref < 0:
                name = resolve_import_name(imports, ref)
                if name:
                    conditions.append(name)

        # Normalize cooldown: "+0" string → 0.0
        if isinstance(cooldown, str):
            try:
                cooldown = float(cooldown)
            except ValueError:
                cooldown = 0.0

        trait = {
            "id": tid,
            "star": star,
            "name_zh": name_zh,
            "description_zh": desc_zh,
            "description_vague_zh": vague_zh,
            "source": strip_enum(source_raw),
            "effect": strip_enum(effect_raw),
            "effect_attr": strip_enum(attr_raw) if attr_raw else None,
            "effect_value": effect_val,
            "effect_is_percentage": is_pct if is_pct is not None else False,
            "effect_probability": prob,
            "effect_cooldown": cooldown if cooldown else None,
            "learned_id": str(learned) if learned else None,
            "upgrade_id": str(upgrade) if upgrade else None,
            "base_weight": weight,
            "is_dlc": is_dlc,
            "is_negative": is_negative,
            "proficiency_requirements": profs if profs else None,
            "weapon_requirements": weapons if weapons else None,
            "conditions": conditions if conditions else None,
            "icon_ref": icon_ref,
        }
        traits.append(trait)

    traits.sort(key=lambda t: (t.get("learned_id") or t["id"], t["star"]))
    return traits


def enrich_clans(traits):
    """Add clan field from pool table conditions + name patterns."""
    clan_map = build_clan_map()
    name_derived = 0
    pool_derived = 0
    for t in traits:
        # Name pattern takes priority (more specific)
        clan = derive_clan_from_name(t.get("name_zh"), t.get("source"))
        if clan:
            name_derived += 1
        else:
            clan = clan_map.get(t["id"])
            if clan:
                pool_derived += 1
        t["clan"] = clan
    print(f"  Clan tags: {name_derived} from name, {pool_derived} from pool tables")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    traits = parse_traits()
    enrich_clans(traits)

    out_path = OUTPUT_DIR / "traits.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(traits, f, ensure_ascii=False, indent=2)

    # Stats
    print(f"Results:")
    print(f"  Parsed: {len(traits)}")

    # Unique trait families (by learned_id)
    families = set()
    for t in traits:
        families.add(t.get("learned_id") or t["id"])
    print(f"  Unique families: {len(families)}")

    # By source
    sources = {}
    for t in traits:
        s = t["source"] or "unknown"
        sources[s] = sources.get(s, 0) + 1
    print(f"\nBy source:")
    for s, n in sorted(sources.items(), key=lambda x: -x[1]):
        print(f"  {s}: {n}")

    # DLC count
    dlc = sum(1 for t in traits if t["is_dlc"])
    print(f"\nDLC traits: {dlc}")
    print(f"Base traits: {len(traits) - dlc}")

    # With proficiency restrictions
    with_prof = sum(1 for t in traits if t["proficiency_requirements"])
    print(f"With proficiency restrictions: {with_prof}")

    # With conditions
    with_cond = sum(1 for t in traits if t["conditions"])
    print(f"With activation conditions: {with_cond}")

    # Clan breakdown
    clans = {}
    for t in traits:
        c = t.get("clan") or "(none)"
        clans[c] = clans.get(c, 0) + 1
    print(f"\nBy clan:")
    for c, n in sorted(clans.items(), key=lambda x: -x[1]):
        print(f"  {c}: {n}")

    # Sample
    print(f"\nSample traits:")
    for t in traits[:3]:
        print(f"  {t['id']} star={t['star']} \"{t['name_zh']}\" ({t['source']})")

    print(f"\nOutput: {out_path}")


if __name__ == "__main__":
    main()
