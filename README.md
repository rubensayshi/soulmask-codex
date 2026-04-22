# SoulmaskDB

Extracts item drop tables and crafting recipes from the Soulmask game using the UE4 developer modkit,
producing a structured JSON database with English item names.

## Output

- `Game/Parsed/drops.json` — 1292 drop entries, 1250 unique items
- `Game/Parsed/recipes.json` — 1109 crafting recipes with full metadata (inputs + quantities, output, station, craft time, proficiency, XP)
- `Game/Parsed/items.json` — 2015 items (materials, weapons, equipment, food, etc.) with weight, stack, durability, stats
- `Game/Parsed/tech_tree.json` — 777 tech nodes (180 main + 597 sub) with prerequisites and 2162 recipe unlocks

### Drops

Each entry covers one drop source (NPC tier, creature, plant, tribe, ruins, DLC dungeon, etc.)
and lists the items it can drop with quantities, weights, and quality levels.

```json
{
  "row_key": "YeZhu",
  "bag_name": "DL_YeZhu",
  "source_type": "creature_body",
  "groups": [
    {
      "probability": 100,
      "items": [
        { "item": "Beast Hide", "item_ref": "...", "qty_min": 1, "qty_max": 2, "weight": 30, "quality": 1 },
        { "item": "Fresh Meat", "item_ref": "...", "qty_min": 2, "qty_max": 3, "weight": 70, "quality": 1 }
      ]
    },
    { "probability": 10, "items": [{ "item": "Beast Bone", ... }] }
  ]
}
```

### Recipes

Each recipe specifies the output item, required inputs with quantities, crafting
station, craft time, skill (proficiency) type, XP awarded, and quality levels.

```json
{
  "id": "BP_PeiFang_WQ_ChangGong_1",
  "unique_id": "WuQI_ChangGong_1",
  "recipe_level": 1,
  "output": {
    "item_id": "BP_WuQi_ChangGong_1",
    "item_path": "/Game/Blueprints/DaoJu/DaoJuWuQi/Gong/BP_WuQi_ChangGong_1"
  },
  "inputs": [
    { "item_id": "Daoju_Item_Bone",   "item_path": "/Game/...", "quantity": 4 },
    { "item_id": "DaoJu_Item_Sheng",  "item_path": "/Game/...", "quantity": 3 },
    { "item_id": "Daoju_Item_Branch", "item_path": "/Game/...", "quantity": 5 }
  ],
  "station_id": "BP_GongZuoTai_ZhuZaoTai",
  "station_name": "Smithing Station",
  "station_required_level": null,
  "can_make_by_hand": true,
  "craft_time_seconds": 60.0,
  "proficiency": "Weapon Smithing",
  "proficiency_xp": 90.0,
  "quality_levels": null
}
```

## Drop sources

| source_type          | Table                       | Entries |
|----------------------|-----------------------------|---------|
| `npc`                | DT_NPCDrop                  | 280     |
| `creature_body`      | DT_ShengWuCaiJiBao          | 252     |
| `npc_dlc`            | DT_NpcDrop_AdditionMap01    | 184     |
| `ruins`              | DT_YiJi                     | 116     |
| `plant`              | DT_ZhiBeiCaiJiBao           | 100     |
| `tribe`              | DT_BuLuoDiaoLuoBao          | 70      |
| `item_bag`           | DT_ZhiZuo                   | 43      |
| `relic_dlc`          | DT_Relic                    | 161     |
| `tribe_dlc`          | DT_Tribe                    | 53      |
| `dungeon_dlc`        | DT_Dungeon                  | 14      |
| `underground_city`   | DT_DiXiaCheng               | 19      |

## Crafting stations (top 15)

| Station               | Recipes |
|-----------------------|---------|
| Construction Workshop | 208     |
| Armor Workbench       | 127     |
| Forging Station       | 98      |
| Hand/None             | 89      |
| Smithing Station      | 86      |
| Craftsman Table       | 85      |
| High-Tech Workbench   | 48      |
| Butcher Table         | 46      |
| Bath/Trough           | 31      |
| Alchemy Table         | 27      |
| Dyeing Vat            | 25      |
| Grinding Machine      | 21      |
| Cooking Table         | 14      |
| Carpentry Workbench   | 13      |
| Water Mill            | 12      |

## Requirements

- Soulmask modkit installed at `C:\Program Files\Epic Games\SoulMaskModkit`
  (UE4.27.2, includes Python 3.7 and all DataTable assets)
- Python 3.x for running `pipeline/parse_*.py`

## Pipeline

All extraction and parsing code lives in `pipeline/`.

```
[Modkit .uasset files]
        │
        ├───────────────────────────────────────────────────────┐
        ▼                                                       ▼
pipeline/export_tables.py                         [UAssetGUI on Windows]
  (runs in UE4Editor-Cmd)                          • opens BP_* .uasset
  • reads DataTable .uasset                        • File → Save As → .json
  • writes Game/Exports/*.json                     • gzipped into uasset_export/
        │                                                       │
        ▼                                                       ▼
pipeline/parse_exports.py                         pipeline/parse_{recipes,items,tech_tree}.py
  • parses DaoJuBaoContent                          • walk UAssetAPI JSON exports
  • resolves item names via parse_localization      • resolve Import table refs
        │                                           • extract full property trees
        ▼                                                       │
Game/Parsed/drops.json                                          ▼
                                                  Game/Parsed/{recipes,items,tech_tree}.json
```

### Running the export

```bash
# Step 1 (on Windows): export DataTables (takes ~5 min, shaders already cached)
pipeline\run_export.bat

# Step 2 (on Windows): export blueprints via UAssetGUI → uasset_export/

# Step 3 (any platform): parse everything
python3 pipeline/parse_exports.py
python3 pipeline/parse_recipes.py
python3 pipeline/parse_items.py
python3 pipeline/parse_tech_tree.py
```

### Localization

`pipeline/parse_localization.py` reads `Content/Localization/Game/en/Game.po` from the modkit
and builds a `{normalized_asset_path → English_name}` dictionary (5203 entries).
The `.po` file uses GNU gettext format with `#. SourceLocation` comments pointing to
the Blueprint asset that owns each string.

## Data format: DaoJuBaoContent

All 11 DataTables share the same row struct (`CaiJiDaoJuBaoDataTable`) with the same columns:
- `DaoJuBaoName` — identifier for this drop bag (referenced by NPC blueprints)
- `DaoJuBaoContent` — serialized array of drop groups (see below)
- `ExtraDropContentData` — supplemental drops (usually empty)
- `AssginMeshData` — mesh assignment, not relevant for drops

`DaoJuBaoContent` is UE4 property-export text:

```
((SelectedRandomProbability=30, ConditionAndCheckData=,
  BaoNeiDaoJuInfos=(
    (DaoJuQuanZhong=10,                                        ← weight
     DaoJuMagnitude=(LowerBound=(Type=Inclusive,Value=1),
                     UpperBound=(Type=Inclusive,Value=3)),      ← qty range
     DaoJuPinZhi=EDJPZ_Level1,                                 ← quality 1-6
     DaoJuClass=BlueprintGeneratedClass'"/Game/..."',           ← item class
     ShuLiangBuShouXiShuYingXiang=False),
    ...
  )
), ...)
```

## Technical notes

### UE4 Python API limitations (UE4.27.2)

The following were tried and **do not work** in this version:

| Attempt | Result |
|---------|--------|
| `unreal.FieldIterator(struct)` | `AttributeError` — not in UE4.27 |
| `EditorAssetLibrary.export_asset()` | method doesn't exist |
| `table.call_method('GetTableAsJSON')` | only UFunctions accessible, not C++ methods |
| `dir()` / `vars()` on struct CDO | no UPROPERTY fields exposed |
| `AssetExportTask` with .csv/.json | returned False silently |

**What works:** Read the `.uasset` binary directly to extract FName strings (property names
live in the package name table), then probe each name with
`DataTableFunctionLibrary.get_data_table_column_as_string(table, name)`.
