# Extracting Spawn Point Coordinates

Spawn coordinates (X/Y/Z world positions) live in `.umap` sublevel files, not in the blueprint exports we already have. The blueprints define *what* spawns; the `.umap` levels define *where* each spawner actor is placed.

## What we already have

- **Spawner blueprints** (`uasset_export/Blueprints/ShuaGuaiQi/`): config for each spawner type — creature class, level range, spawn count, loot. No coordinates.
- **Reference data** from saraserenity.net: 52MB JSON with coordinates for all spawn types on both maps. Likely extracted from the same `.umap` files we need to parse. Good for cross-referencing.

## What we need

Actor transforms (position, rotation) for every placed spawner in the world. In UE4 these are stored as `FTransform` properties on actors in sublevel `.umap` files.

## Modkit paths

```
C:\Program Files\Epic Games\SoulMaskModkit\
  Engine\Binaries\Win64\UE4Editor-Cmd.exe
  Projects\WS\WS.uproject
  Projects\WS\Content\
    Maps\                          <-- .umap level files should be here
    Blueprints\ShuaGuaiQi\         <-- spawner blueprint classes
```

## Extraction approaches (try in order)

### Approach 1: UE4 Editor Python script (preferred)

We already run Python inside UE4Editor-Cmd via `run_export.bat`. If we can iterate world actors after loading a map, this is the cleanest path.

```python
import unreal

# Step 1: Find all .umap files
# Look in Content/Maps/ for the main level and sublevels
# The main map is probably Level01_Main (Cloud Mist Forest)
# DLC map is DLC_Level01_Main (Shifting Sands)

# Step 2: Try loading the level and iterating actors
editor = unreal.EditorLevelLibrary
world = unreal.EditorLevelLibrary.get_editor_world()

# Get all actors in the level
actors = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.Actor)

# Filter for spawner actors (class names contain "ShuaGuaiQi" or "SGQ")
for actor in actors:
    class_name = actor.get_class().get_name()
    if 'ShuaGuaiQi' in class_name or 'SGQ' in class_name:
        loc = actor.get_actor_location()  # FVector
        rot = actor.get_actor_rotation()  # FRotator
        print(f"{class_name}: X={loc.x}, Y={loc.y}, Z={loc.z}")
```

**Caveats:**
- The UE4.27 Python API in this modkit is buggy (see CLAUDE.md). Many "obvious" APIs don't work.
- The level may not load sublevels automatically — you may need to find and load streaming sublevels explicitly.
- If `get_all_actors_of_class` returns nothing, the sublevels aren't loaded.

**Fallback — iterate sublevels explicitly:**

```python
import unreal, os

content_dir = unreal.Paths.project_content_dir()
maps_dir = os.path.join(content_dir, "Maps")

# List .umap files to find sublevel naming pattern
for root, dirs, files in os.walk(maps_dir):
    for f in files:
        if f.endswith('.umap'):
            print(os.path.relpath(os.path.join(root, f), content_dir))
```

Start by just listing what `.umap` files exist and their sizes. The main persistent level will be small; the sublevels (which contain the actual actors) will be larger.

### Approach 2: UAssetGUI / UAssetAPI (manual but reliable)

We already use UAssetGUI to export blueprint `.uasset` files. It can also open `.umap` files.

1. Open UAssetGUI
2. Navigate to `Content/Maps/` and find sublevel `.umap` files
3. Look for exports of type `ShuaGuaiQi` or `SGQ` — these are the placed spawner actors
4. Each placed actor has a `RelativeLocation` / `RelativeRotation` / `RelativeScale3D` property, or a `RootComponent` with those transforms

**Problem:** `.umap` files can be 100MB+. UAssetGUI may choke. If so, use UAssetAPI (the C# library) in a script:

```csharp
// dotnet script using UAssetAPI NuGet package
using UAssetAPI;
using UAssetAPI.ExportTypes;

var asset = new UAsset("path/to/sublevel.umap", EngineVersion.VER_UE4_27);
foreach (var export in asset.Exports) {
    var name = export.ObjectName.ToString();
    if (name.Contains("SGQ") || name.Contains("ShuaGuaiQi")) {
        // This is a placed spawner actor
        // Look for transform properties in its property data
        if (export is NormalExport ne) {
            foreach (var prop in ne.Data) {
                Console.WriteLine($"  {prop.Name}: {prop}");
            }
        }
    }
}
```

### Approach 3: FModel (visual exploration)

[FModel](https://fmodel.app/) is a UE4/5 asset viewer that can read `.pak` files and display map data including actor placements.

1. Download FModel
2. Point it at the modkit's `.pak` files (look in `Content/Paks/` or the root)
3. Navigate to the Maps directory
4. FModel can export map actors as JSON with full transform data

This is useful for **exploration** — figuring out the sublevel structure and actor naming before writing an automated script.

## Key class names to search for

From our existing blueprint exports:

| Class pattern | Meaning |
| --- | --- |
| `BP_SGQ_T{n}_*` | Animal spawner, tier n (T1=easy, T12=hard) |
| `BP_SGQ_BaoZi_*` | Jaguar spawner |
| `BP_SGQ_XueBao_*` | Snow Leopard spawner |
| `BP_HShuaGuaiQi_*` | Special spawners (eggs, mounts) |
| `BP_BuLuoGLQ` | Tribe management spawner |
| `SGQ_BuLuo/` | Human/tribe spawners |
| `SGQ_YiJi/` | Ruin/POI spawners |
| `SGQ_ChaoXue/` | Beast lair spawners |
| `SGQ_DongWu/` | Animal spawners (main category) |

Chinese glossary:
- ShuaGuaiQi (刷怪器) = monster spawner
- DongWu (动物) = animal
- EYu (鳄鱼) = alligator/crocodile
- BuLuo (部落) = tribe
- YiJi (遗迹) = ruins
- ChaoXue (巢穴) = lair/nest

## Expected output

Each spawn point should produce:

```json
{
  "spawner_class": "BP_SGQ_T2_Eyu",
  "pos_x": 226432,
  "pos_y": 45839,
  "pos_z": 37233,
  "rotation_yaw": 0
}
```

We can then join `spawner_class` back to our existing blueprint data to get what creature it spawns, level range, loot tables, etc.

## Step-by-step plan

1. **Recon**: List all `.umap` files in the modkit `Content/Maps/` directory. Note sizes and naming patterns.
2. **Identify sublevels**: The persistent level likely references streaming sublevels. Find which ones contain spawner actors. Look for filenames containing `DongWu`, `SGQ`, `ShuaGuai`, `NPC`, or similar.
3. **Small test**: Pick one small sublevel `.umap`, open in UAssetGUI, and find a spawner actor to understand the property structure.
4. **Automate**: Write a script (Python in UE4Editor or C# with UAssetAPI) to extract all spawner transforms from all sublevels.
5. **Validate**: Compare extracted coordinates against the saraserenity.net reference data. Count should be in the same ballpark (e.g. ~173 Giant Alligator spawns).

## Reference data for validation

Saraserenity.net `data.php?map=Level01_Main` returns spawn data with UE4 world coords. Sample Giant Alligator entry:

```json
{
  "posX": 226432, "posY": 45839, "posZ": 37233,
  "title": "Giant Alligator",
  "desc": "Level 11 - 20",
  "num": 1, "max": 1,
  "intr": 600
}
```

If our extracted coords match these values (within rounding), we've confirmed the extraction is correct.
