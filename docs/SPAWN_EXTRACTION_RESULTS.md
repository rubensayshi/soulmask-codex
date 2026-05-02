# Spawn Extraction — Results & Implementation Notes

## What was built

`pipeline/parse_spawns_run.ps1` — PowerShell pipeline that extracts spawn coordinates from
Soulmask `.umap` level files using UAssetGUI CLI, producing `Game/Parsed/spawns.json`.

## Output: `Game/Parsed/spawns.json`

**12,555 spawn points, 12,555/12,555 with X/Y/Z world coordinates.**

Each entry:
```json
{
  "map": "Level01_GamePlay",
  "map_path": "Level01\\Level01_Hub\\Level01_GamePlay.umap",
  "spawner_class": "HShuaGuaiQiBase",
  "scg_class": "/Game/Blueprints/ShuaGuaiQi/.../BP_SGQ_T3_Eyu.BP_SGQ_T3_Eyu_C",
  "actor_name": "SGQ_BaoZi_ShenMi_Event",
  "pos_x": 239190.0,
  "pos_y": -43900.0,
  "pos_z": 43720.0
}
```

Coordinates are UE4 world-space (centimeters from origin). `scg_class` is the creature blueprint
path, present on 12,454/12,555 entries (99.2%).

### By map

| Map              | Spawners | Notes                                          |
| ---------------- | -------- | ---------------------------------------------- |
| Level01 (base)   | 6,605    | Cloud Mist Forest open world (3 GamePlay maps) |
| DLC_Level01      | 5,594    | Shifting Sands DLC open world (3 GamePlay maps)|
| DiXiaCheng       | 201      | Underground city dungeon rooms                 |
| DLC_Egypt        | 129      | Egypt DLC dungeon rooms (14 rooms)             |
| ZhanChang01      | 26       | PvE battlefield arena                          |

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

### ~~Level01_Main.umap — OOM on export~~ (resolved)
Not needed. All spawner actors live in the GamePlay sublevels (6,605 extracted).

### ~~Level02 (Shifting Sands DLC) — 0 spawners~~ (resolved)
DLC spawners found in `DLC_Level01_GamePlay{1,2,3}.umap` + Egypt dungeon rooms.
5,723 DLC spawners now extracted.

### ~~`spawner_class` → creature mapping~~ (resolved)
`scg_class` field now captured directly from each spawner actor's `SCGClass` property.
Covers 99.2% of entries. Resolves to the full creature blueprint path.

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

---

## Still needed from Windows box (May 2026)

Inventory of remaining data gaps that require the Windows modkit machine. Everything else
(PO files, spawns, map textures, traits, items, recipes, tech tree) is already extracted.

### 1. DLC equipment blueprints (blocking — 57 unresolved drop items)

57 items appear in DLC drop tables but were never exported via UAssetGUI. They all live under
`AdditionMap01/BluePrints/Prop/Equip/` — a directory we didn't include in the original export.

| Subdirectory | Count | Examples                              |
| ------------ | ----- | ------------------------------------- |
| Wolf         | 20    | `BP_EG_TribeF_ZD_Arm_Lv_{1-4}` etc.  |
| Dungeon      | 18    | `BP_Equip_Arm_Dungeon_{1-3}` etc.     |
| Horn         | 16    | `BP_EG_TribeE_ZD_Body_Lv_{1-4}` etc.  |
| Saddle       | 3     | `BP_An_Ass`, `BP_An_Camel`, `BP_An_Rhinoceros` |

**Export command:**
```powershell
$ExportDir = "D:\uasset_export\AdditionMap01\BluePrints\Prop\Equip"
$SourceDir = "C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS\Content\AdditionMap01\BluePrints\Prop\Equip"
Get-ChildItem -Path $SourceDir -Recurse -Filter "*.uasset" | ForEach-Object {
    $rel = $_.FullName.Substring($SourceDir.Length + 1)
    $outPath = Join-Path $ExportDir ($rel -replace '\.uasset$', '.json')
    $outDir = Split-Path $outPath -Parent
    if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
    & "D:\UAssetGUI.exe" tojson $_.FullName $outPath VER_UE4_27
}
```
Then gzip and commit to `uasset_export/AdditionMap01/BluePrints/Prop/Equip/`.

### 2. Missing creature sublevels (low priority — 250 creatures)

Some creatures (Bat, Mutant Rat, Armadillo Lizard, Pangolin, Small Boar) have 0 actors in
spawns.json despite existing in the game. They likely live in `.umap` sublevels not yet scanned.
Run the binary scan from `parse_spawns.ps1` against all `.umap` files to find them. See
"Extraction instructions" section above.

### 3. Tier-based ruins spawners (low priority — 471 actors)

471 `BP_HShuaGuaiQiRandNPC_C` actors have generic names like `SGQ_YiJi_T3_YeShou` and no
blueprint to resolve. Would need to find the parent BP or DataTable that defines the creature
pool per tier.

### NOT needed (already have it)

| Data                      | Status                                                    |
| ------------------------- | --------------------------------------------------------- |
| PO localization files     | Already in `localization/Game/en/Game.po` (266K lines)    |
| Trait EN translations     | Extracted from PO files on this branch                    |
| DT_GiftZongBiao export    | On this branch (`Game/Exports/`)                          |
| Spawn coordinates         | 12,555 entries with `scg_class` on this branch            |
| Map textures              | Extracted via FModel on this branch (`Game/Maps/`)        |
| Base-game items           | 2,015 BPs exported and parsed                             |
| DLC items                 | 339 BPs exported and parsed (under `AdditionMap01/.../Item/`) |
| Recipes                   | 1,109 parsed                                              |
| Tech tree                 | 777 nodes parsed                                          |
| Drop tables               | 11 DataTables exported via UE4Editor                      |
| Spawner blueprints        | 1,982 BPs in `uasset_export/Blueprints/ShuaGuaiQi/`      |
