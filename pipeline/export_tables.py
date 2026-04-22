"""
Soulmask DataTable Exporter - attempt 8
Reads property names directly from .uasset binary (FName table),
then uses get_data_table_column_as_string with those real names.
"""

import unreal
import json
import os
import re
import struct

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(REPO_ROOT, "Game", "Exports")
os.makedirs(OUTPUT_DIR, exist_ok=True)

MODKIT_CONTENT = r"C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS\Content"

TABLES = [
    ("/Game/Blueprints/DataTable/CaiJiBao/DT_ZhiZuo",
     r"Blueprints\DataTable\CaiJiBao\DT_ZhiZuo.uasset"),
    ("/Game/Blueprints/DataTable/CaiJiBao/DT_NPCDrop",
     r"Blueprints\DataTable\CaiJiBao\DT_NPCDrop.uasset"),
    ("/Game/Blueprints/DataTable/CaiJiBao/DT_ShengWuCaiJiBao",
     r"Blueprints\DataTable\CaiJiBao\DT_ShengWuCaiJiBao.uasset"),
    ("/Game/Blueprints/DataTable/CaiJiBao/DT_BuLuoDiaoLuoBao",
     r"Blueprints\DataTable\CaiJiBao\DT_BuLuoDiaoLuoBao.uasset"),
    ("/Game/Blueprints/DataTable/CaiJiBao/DT_ZhiBeiCaiJiBao",
     r"Blueprints\DataTable\CaiJiBao\DT_ZhiBeiCaiJiBao.uasset"),
    ("/Game/Blueprints/DataTable/CaiJiBao/DT_YiJi",
     r"Blueprints\DataTable\CaiJiBao\DT_YiJi.uasset"),
    ("/Game/Blueprints/DataTable/CaiJiBao/DT_DiXiaCheng",
     r"Blueprints\DataTable\CaiJiBao\DT_DiXiaCheng.uasset"),
    ("/Game/AdditionMap01/BluePrints/DataTable/Drop/DT_NpcDrop_AdditionMap01",
     r"AdditionMap01\BluePrints\DataTable\Drop\DT_NpcDrop_AdditionMap01.uasset"),
    ("/Game/AdditionMap01/BluePrints/DataTable/Drop/DT_Dungeon",
     r"AdditionMap01\BluePrints\DataTable\Drop\DT_Dungeon.uasset"),
    ("/Game/AdditionMap01/BluePrints/DataTable/Drop/DT_Relic",
     r"AdditionMap01\BluePrints\DataTable\Drop\DT_Relic.uasset"),
    ("/Game/AdditionMap01/BluePrints/DataTable/Drop/DT_Tribe",
     r"AdditionMap01\BluePrints\DataTable\Drop\DT_Tribe.uasset"),
]


def extract_candidate_columns(uasset_path):
    """
    Parse the .uasset binary to find FName strings that look like
    struct property names (CamelCase, no BP_ / DL_ prefix noise).
    """
    full_path = os.path.join(MODKIT_CONTENT, uasset_path)
    if not os.path.exists(full_path):
        unreal.log_warning("  uasset not found: {}".format(full_path))
        return []
    try:
        with open(full_path, 'rb') as f:
            data = f.read()
    except Exception as e:
        unreal.log_warning("  uasset read error: {}".format(e))
        return []

    # Extract all printable ASCII runs >= 4 chars
    names = set()
    i = 0
    while i < len(data) - 1:
        if 32 <= data[i] < 127:
            j = i
            while j < len(data) and 32 <= data[j] < 127:
                j += 1
            s = data[i:j].decode('ascii', errors='ignore')
            if len(s) >= 4:
                names.add(s)
            i = j
        else:
            i += 1

    # Keep names that look like struct properties:
    #  - Start with uppercase letter or 'b' followed by uppercase
    #  - No path separators, spaces, colons, etc.
    #  - Exclude obvious non-property patterns
    exclude_prefixes = ('BP_', 'DL_', 'DaoJu_', 'DT_', 'ABP_', 'WBP_', 'GA_',
                        'GE_', 'NPC_', 'BL_', 'MI_', 'SM_', 'SK_', 'T_', 'PS_',
                        'Sound', 'Cue_', 'Map_', 'Level_')
    exclude_exact = {
        'None', 'Class', 'Package', 'Type', 'Value', 'Vector', 'MetaData',
        'DataTable', 'ScriptStruct', 'StructProperty', 'ArrayProperty',
        'ObjectProperty', 'FloatProperty', 'BoolProperty', 'IntProperty',
        'ByteProperty', 'NameProperty', 'RowStruct', 'RowStructName',
        'RowStructure', 'BlueprintGeneratedClass', 'AssetImportData',
        'PackageMetaData', 'PackageLocalizationNamespace',
    }
    props = []
    for n in sorted(names):
        if n in exclude_exact:
            continue
        if any(n.startswith(p) for p in exclude_prefixes):
            continue
        # Must start with uppercase or b+uppercase
        if not re.match(r'^[bB]?[A-Z][a-zA-Z0-9_]{2,59}$', n):
            continue
        # Skip enum values (contain ::)
        if '::' in n:
            continue
        props.append(n)
    return props


def export_table(table, name, candidates):
    """Try each candidate as a column name; keep those that return data."""
    row_names = unreal.DataTableFunctionLibrary.get_data_table_row_names(table)
    row_names_str = [str(r) for r in row_names]
    n_rows = len(row_names_str)

    rows = [{"Name": rn} for rn in row_names_str]
    working_cols = []

    for col in candidates:
        try:
            vals = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(table, col)
            if vals and len(vals) == n_rows:
                for i, v in enumerate(vals):
                    rows[i][col] = str(v)
                working_cols.append(col)
        except Exception:
            pass

    unreal.log("  Working columns ({}): {}".format(len(working_cols), working_cols))
    return rows, working_cols


success = 0
failed = 0

for asset_path, uasset_rel in TABLES:
    name = asset_path.split("/")[-1]
    table = unreal.load_asset(asset_path)

    if table is None:
        unreal.log_warning("Could not load: {}".format(asset_path))
        failed += 1
        continue

    row_names = unreal.DataTableFunctionLibrary.get_data_table_row_names(table)
    unreal.log("Processing {} ({} rows)".format(name, len(row_names)))

    candidates = extract_candidate_columns(uasset_rel)
    unreal.log("  Candidates from binary ({}): {}".format(len(candidates), candidates[:20]))

    rows, working_cols = export_table(table, name, candidates)

    out_file = os.path.join(OUTPUT_DIR, name + ".json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    col_count = len(rows[0]) - 1 if rows else 0
    if rows and col_count > 0:
        sample = {k: v for k, v in list(rows[0].items())[:6]}
        unreal.log("  Sample: {}".format(sample))
    unreal.log("Exported {} -> {} rows, {} columns".format(name, len(rows), col_count))
    success += 1

unreal.log("\nDone: {} exported, {} failed.".format(success, failed))
