# Spawn Extraction — Results & Implementation Notes

## What was built

`pipeline/parse_spawns_run.ps1` — PowerShell pipeline that extracts spawn coordinates from
Soulmask `.umap` level files using UAssetGUI CLI, producing `Game/Parsed/spawns.json`.

## Output: `Game/Parsed/spawns.json`

**6,832 spawn points, 6,832/6,832 with X/Y/Z world coordinates.**

Each entry:
```json
{
  "map": "Level01_GamePlay",
  "map_path": "Level01\\Level01_Hub\\Level01_GamePlay.umap",
  "spawner_class": "HShuaGuaiQiBase",
  "actor_name": "SGQ_BaoZi_ShenMi_Event",
  "pos_x": 239190.0,
  "pos_y": -43900.0,
  "pos_z": 43720.0,
  "rotation_yaw": 0.0
}
```

Coordinates are UE4 world-space (centimeters from origin). `rotation_yaw` present when non-default.

### By map

| Map | Spawners | Notes |
|---|---|---|
| `Level01_GamePlay` | 5,364 | Main open-world spawners (Cloud Mist Forest) |
| `Level01_GamePlay2` | 768 | Second open-world gameplay layer |
| `Level01_GamePlay3` | 470 | Third open-world gameplay layer |
| DiXiaCheng dungeon rooms | 201 | Underground city (checkpoints, boss rooms, corridors) |
| ZhanChang01 battlefield | 26 | PvE battlefield arena |
| Level01 ruins / YiJi | 3 | Open-world dungeon entrances |

### By spawner class

| Class | Count | Description |
|---|---|---|
| `HShuaGuaiQiBase` | 3,631 | Standard animal/creature spawner |
| `BP_HShuaGuaiQiRandNPC_C` | 2,763 | Random NPC group spawner |
| `HShuaGuaiQiDiXiaCheng` | 227 | Underground city encounter spawner |
| `BP_HShuaGuaiQi_ShouLong_C` | 90 | Dragon spawner |
| `BP_HShuaGuaiQi_JuanShe_C` | 46 | Boa constrictor spawner |
| `HShuaGuaiVolumeChuFaQi` | 25 | Volume trigger spawner |
| `BP_RuQinSGQ_C` | 23 | Invasion/event spawner |
| `BP_HShuaGuaiQi_TuoNiao_C` | 10 | Ostrich spawner |
| `BP_HShuaGuaiQi_JiaoDiao_Egg_C` | 7 | Eagle egg spawner |

## How it works

### Step 1 — Binary scan
All 286 `.umap` files in `Content/Maps/` are scanned for the byte strings `ShuaGuaiQi`
and `BP_SGQ` to identify which files contain spawner actors (FName table hit).
50 files matched; dev/test maps and `Level01_Main` are excluded from processing (see below).

### Step 2 — Export to JSON
Each matching `.umap` is exported to JSON using:
```
UAssetGUI.exe tojson <file.umap> <out.json> VER_UE4_27
```

### Step 3 — Parse spawner actors
For each export in the JSON:
1. Resolve `ClassIndex` → Import table → check if class name contains `ShuaGuaiQi`/`SGQ`
2. Follow `RootComponent` property → export index → read `RelativeLocation`
3. `RelativeLocation` in UAssetAPI JSON: `Value[0].Value` = `FVector { X, Y, Z }`

Key non-obvious detail: `RelativeLocation` is a `StructProperty(Vector)` whose `Value` array
contains a single `VectorPropertyData` whose own `Value` is an `FVector` object. Not a
flat `{X, Y, Z}` struct — there's one extra level of wrapping.

## Known gaps

### Level01_Main.umap (998 MB) — OOM on export
UAssetGUI loads the entire file into a .NET object tree before writing JSON. The estimated
JSON output (~14 GB, based on the 14× expansion ratio from smaller files) exceeds available
RAM even on 32 GB systems.

**What it probably contains:** Landscape heightmaps, terrain components, foliage instances,
lighting — not spawner actors. The spawner actors for the open world appear to be in the
`Level01_GamePlay*.umap` sublevels (confirmed: 6,602 spawners extracted from those alone).

**Fix options if needed:**
- Write a custom UE4 binary parser that reads only the FName/Import/Export tables + seeks
  to individual export data blocks (avoiding loading the full file). The export table has
  `SerialOffset` + `SerialSize` per export, enabling surgical reads.
- Use UAssetAPI as a .NET assembly loaded directly into PowerShell, with streaming output.
- Cross-validate the extracted count against saraserenity.net's reference data (52 MB JSON
  with spawn coordinates). If counts match, the Main gap is not material.

### Level02 (Shifting Sands DLC) — 0 spawners found
`Level02_Main.umap` (498 MB) exported successfully to 700 MB JSON but contained 0 spawner
actors. The DLC spawners are likely in separate GamePlay sublevels not yet identified.
Worth running the binary scan on `Level02/` specifically to find the right sublevels.

### `spawner_class` → creature mapping not yet done
`spawner_class` (e.g. `HShuaGuaiQiBase`) is a generic base class. The actual creature type
comes from the spawner's `SCGClass` property → resolves to a blueprint like `BP_DongWu_Eyu_C`.
That join hasn't been wired up yet — `SCGClass` is captured in the blueprint blueprints under
`uasset_export/Blueprints/ShuaGuaiQi/` but not yet parsed.

## World map texture

`Content/UI/Map/Level01_Map.uasset` — **29.8 MB** — the full world map texture used in-game.
Single file, no tiles to stitch. Also in that folder:

| File | Size | Notes |
|---|---|---|
| `UI/Map/Level01_Map.uasset` | 29.8 MB | World map texture (Cloud Mist Forest) |
| `UI/Map/DATA_Level01Height.uasset` | 8 MB | Heightmap data |
| `UI/Map/RT_WorldMapHeight.uasset` | ~0 | Render target (no content) |
| `UI/Map/BP_WorldMapDepth_Capture.uasset` | 0.07 MB | Capture blueprint |

**Extraction:** UAssetGUI cannot export textures (it only handles blueprints/datatables).
Use **FModel** to extract the texture as PNG:
1. Open FModel, point at the game's `.pak` files or the modkit content
2. Navigate to `Game/UI/Map/Level01_Map`
3. Export as PNG

No Level02 (Shifting Sands) equivalent was found under a similar name — may be stored
differently or not yet in the modkit.

## Files

| File | Purpose |
|---|---|
| `pipeline/parse_spawns_run.ps1` | Main extraction script (uses pre-scanned map list) |
| `pipeline/parse_spawns.ps1` | Same script with binary scan phase included |
| `pipeline/parse_spawns.py` | Python version (requires Python 3, not currently installed) |
| `Game/Parsed/spawns.json` | Output — 6,832 spawn points with coordinates |

## Remaining gaps (April 2026)

After joining spawns.json with spawner blueprints via `pipeline/parse_spawns.py` (on master),
we compared resolved creature locations against saraserenity.net's reference data. Two
categories of gaps remain.

### Missing creatures — 0 actors in spawns.json

These creatures exist in sara's data but have zero matching actors in our extraction. They
likely live in `.umap` sublevels we didn't process.

| Creature       | Sara count          | Pinyin      | Notes                                   |
|----------------|---------------------|-------------|-----------------------------------------|
| Bat            | 101 (82 + 19 elite) | BianFu      | Common creature, must be in an unprocessed sublevel |
| Mutant Rat     | 74 (65 + 9 elite)   | LaoShu      | Found in sinkhole areas per sara        |
| Armadillo Lizard | 34 (28 + 6 elite) | ?           | Not in our translation map either       |
| Pangolin       | 26                  | ChaJiaoLin  |                                         |
| Large Boar     | 15                  | XiaoYeZhu   | Small boar variant                      |

### Partially missing — tier-based ruins spawners (471 actors)

471 actors use the `BP_HShuaGuaiQiRandNPC_C` class with generic tier-based names like
`SGQ_YiJi_T3_YeShou`. No corresponding blueprint files exist for these, so `parse_spawns.py`
cannot resolve which creature they spawn. Sara lists these as "(Ruins)" variants:

| Creature                           | Sara count |
|------------------------------------|------------|
| Wolf / Grey Wolf (Ruins)           | 68         |
| Wasteland Wolf / Alpha Wolf (Ruins)| 66         |
| Arctic Wolf (Ruins)                | 77         |
| Monitor Lizard (Ruins)             | 17         |
| Snow Leopard (Ruins)               | 13         |
| Alligator (Ruins)                  | 10         |
| Bear (Ruins)                       | 6          |

We DID resolve 160 location-specific ruins spawns (DongKu, TianKeng, HeiSenLin, HuoShan,
BingGu, ZhaoZe) because those have dedicated blueprints. The gap is the ~471 generic
tier-based ones only.

### Extraction instructions for Windows operator

#### 1. Find missing sublevel .umap files

Run the binary scan phase from `parse_spawns.ps1` against ALL `.umap` files to find sublevels
we missed. Specifically:

- Look for any `.umap` files in `Level01/` or `Level02/` not in the `$KnownSpawnerMaps` list
- Check if `Level02` (Shifting Sands DLC) has GamePlay sublevels similar to `Level01` — the
  0-spawner result from `Level02_Main.umap` suggests they exist separately

Use this scan to find maps containing references to the missing creatures:

```powershell
$MapsDir = "C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS\Content\Maps"
$patterns = @("ShuaGuaiQi", "SGQ", "ShuaGuai", "BianFu", "LaoShu", "ChaJiaoLin")
Get-ChildItem -Path $MapsDir -Recurse -Filter "*.umap" | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $text = [System.Text.Encoding]::ASCII.GetString($bytes)
    $hits = @()
    foreach ($p in $patterns) {
        if ($text.Contains($p)) { $hits += $p }
    }
    if ($hits.Count -gt 0) {
        $rel = $_.FullName.Substring($MapsDir.Length + 1)
        Write-Output "$rel : $($hits -join ', ')"
    }
}
```

Any new maps found should be added to `$KnownSpawnerMaps` in `parse_spawns_run.ps1` and
re-exported with UAssetGUI.

#### 2. Resolve tier-based ruins spawners

The `BP_HShuaGuaiQiRandNPC_C` spawners use a randomized creature class defined either in
the C++ base class (not accessible via blueprint export) or in a parent blueprint we haven't
exported.

Check if a `BP_HShuaGuaiQiRandNPC` blueprint exists in `Content/Blueprints/ShuaGuaiQi/`.
If it does, export it with UAssetGUI — the creature class for each tier may be defined there
as a DataTable reference or in the `SuiJi` (random) configs.
