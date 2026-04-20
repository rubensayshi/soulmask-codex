# SoulmaskDB

Extracts item drop tables and crafting recipes from the Soulmask game using the UE4 developer modkit,
producing a structured JSON database with English item names.

## Output

- `Game/Parsed/drops.json` — 1292 drop entries, 1250 unique items
- `Game/Parsed/recipes.json` — 1103 crafting recipes with inputs, outputs, stations

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

Each recipe specifies the output item, required inputs, crafting station, and skill type.

```json
{
  "id": "BP_PeiFang_Bark",
  "output": {
    "item_id": "Daoju_Item_Bark",
    "item_path": "/Game/Blueprints/DaoJu/DaojuCaiLiao/ZhiWu/Daoju_Item_Bark",
    "type": "material"
  },
  "inputs": [
    { "item_id": "Daoju_Item_HardWood", "item_path": "/Game/..." },
    { "item_id": "Daoju_Item_Wood", "item_path": "/Game/..." }
  ],
  "station_id": "BP_GongZuoTai_MuJiangXi",
  "station_name": "Carpentry Workbench",
  "proficiency": "Carpentry",
  "quality_levels": null
}
```

**Note:** Input quantities are not extractable without full UE4 property parsing.

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
- Python 3.x for running `parse_exports.py` and `parse_localization.py`

## Pipeline

```
[Modkit .uasset files]
        │
        ├─────────────────────────────────────┐
        ▼                                     ▼
export_tables.py                    parse_recipes.py
  (runs in UE4Editor-Cmd)            (runs with Python 3.x)
  • reads DataTable .uasset           • pattern-matches BP_PeiFang .uasset
  • exports to JSON                   • extracts asset paths & property names
        │                                     │
        ▼                                     ▼
parse_exports.py                    Game/Parsed/recipes.json
  (runs with Python 3.x)
  • parses DaoJuBaoContent
  • resolves item names
        │
        ▼
Game/Parsed/drops.json
```

### Running the export

```bash
# Step 1: export DataTables (takes ~5 min, shaders already cached)
"C:\Program Files\Epic Games\SoulMaskModkit\Engine\Binaries\Win64\UE4Editor-Cmd.exe" \
  "C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS\WS.uproject" \
  -ExecutePythonScript="<path>\export_tables.py" \
  -stdout -FullStdOutLogOutput -unattended -nopause

# Step 2: parse exports
python parse_exports.py
```

### Localization

`parse_localization.py` reads `Content/Localization/Game/en/Game.po` from the modkit
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
