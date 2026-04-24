"""
parse_spawns.py — Extract spawn coordinates from Soulmask .umap level files.

Pipeline:
  1. Binary-scan all .umap files for spawner class name strings.
  2. Export each matching .umap to JSON via UAssetGUI CLI.
  3. Parse the JSON: find spawner actor exports, resolve their RootComponent,
     read RelativeLocation X/Y/Z from the SceneComponent.
  4. Emit Game/Parsed/spawns.json

Usage:
    python3 pipeline/parse_spawns.py

Requires UAssetGUI.exe at D:\UAssetGUI.exe (or set UASSET_GUI env var).
Output: Game/Parsed/spawns.json
"""

import json
import os
import subprocess
import sys
import tempfile

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAPS_DIR   = r"C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS\Content\Maps"
UASSET_GUI = os.environ.get("UASSET_GUI", r"D:\UAssetGUI.exe")
ENGINE_VER = "VER_UE4_27"
OUT_FILE   = os.path.join(os.path.dirname(__file__), "..", "Game", "Parsed", "spawns.json")

# Strings that appear in the FName table of any .umap containing spawner actors
SPAWNER_MARKERS = [b"ShuaGuaiQi", b"BP_SGQ"]

# Class name patterns that indicate a spawner actor (matched against resolved import name)
SPAWNER_CLASS_PATTERNS = ["ShuaGuaiQi", "SGQ", "ShuaGuai"]

# ---------------------------------------------------------------------------
# Step 1: Scan .umap files for spawner markers (fast binary search)
# ---------------------------------------------------------------------------

def scan_for_spawner_umaps(maps_dir):
    """Return list of .umap paths that contain spawner class name bytes."""
    hits = []
    all_umaps = []
    for root, dirs, files in os.walk(maps_dir):
        for f in files:
            if f.endswith(".umap"):
                all_umaps.append(os.path.join(root, f))

    print(f"Scanning {len(all_umaps)} .umap files for spawner refs...")
    for i, path in enumerate(all_umaps):
        size_mb = os.path.getsize(path) / 1e6
        try:
            with open(path, "rb") as fh:
                data = fh.read()
            found = any(marker in data for marker in SPAWNER_MARKERS)
            if found:
                rel = os.path.relpath(path, maps_dir)
                print(f"  FOUND ({size_mb:.1f} MB): {rel}")
                hits.append(path)
        except Exception as e:
            print(f"  ERROR reading {path}: {e}", file=sys.stderr)
        if (i + 1) % 50 == 0:
            print(f"  ... {i+1}/{len(all_umaps)}")

    print(f"Found {len(hits)} matching .umap files.\n")
    return hits


# ---------------------------------------------------------------------------
# Step 2: Export a single .umap to JSON via UAssetGUI CLI
# ---------------------------------------------------------------------------

def export_umap_to_json(umap_path, out_json_path):
    """Call UAssetGUI tojson. Returns True on success."""
    proc = subprocess.run(
        [UASSET_GUI, "tojson", umap_path, out_json_path, ENGINE_VER],
        capture_output=True,
    )
    return os.path.exists(out_json_path)


# ---------------------------------------------------------------------------
# Step 3: Parse the JSON — extract spawner transforms
# ---------------------------------------------------------------------------

def get_prop(data_list, name):
    """Find a property by Name in a UAssetAPI Data array."""
    for p in data_list:
        if p.get("Name") == name:
            return p
    return None


def resolve_vector(vec_struct):
    """
    Pull X/Y/Z floats out of a UAssetAPI Vector struct.
    The Value is a list of sub-properties (X, Y, Z as FloatPropertyData).
    Returns (x, y, z) or None.
    """
    if not vec_struct or not isinstance(vec_struct.get("Value"), list):
        return None
    vals = {}
    for sub in vec_struct["Value"]:
        n = sub.get("Name")
        v = sub.get("Value")
        if n in ("X", "Y", "Z") and v is not None:
            try:
                vals[n] = float(v)
            except (TypeError, ValueError):
                pass
    if "X" in vals and "Y" in vals and "Z" in vals:
        return vals["X"], vals["Y"], vals["Z"]
    return None


def resolve_import(imports, idx):
    """Negative idx → 1-based into imports list. Returns the import dict or None."""
    if idx < 0:
        pos = (-idx) - 1
        if 0 <= pos < len(imports):
            return imports[pos]
    return None


def parse_spawns_from_json(json_path, map_name, map_rel_path):
    """
    Parse a UAssetGUI-exported .umap JSON and return a list of spawn dicts.

    Each spawn dict:
      {
        "map": "Level01_Main",
        "map_path": "Maps/Level01/Level01_Main.umap",
        "spawner_class": "BP_SGQ_T2_Eyu_C",
        "actor_name": "BP_SGQ_T2_Eyu_3",
        "pos_x": 226432.0,
        "pos_y": 45839.0,
        "pos_z": 37233.0,
        "rotation_yaw": 0.0   # may be absent
      }
    """
    with open(json_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    imports = data.get("Imports", [])
    exports = data.get("Exports", [])

    # Build export index map (1-based positive index → export dict)
    export_by_idx = {i + 1: exp for i, exp in enumerate(exports)}

    # Resolve import name for a ClassIndex
    def class_name(idx):
        imp = resolve_import(imports, idx)
        return imp["ObjectName"] if imp else None

    results = []

    for exp in exports:
        cls_idx = exp.get("ClassIndex", 0)
        cls = class_name(cls_idx) or ""
        if not any(pat in cls for pat in SPAWNER_CLASS_PATTERNS):
            continue

        actor_name = exp.get("ObjectName", "")
        exp_data = exp.get("Data", [])

        # --- Find the world position ---
        # Strategy A: actor has a RootComponent → look at that export's RelativeLocation
        pos = None
        yaw = None

        root_comp_prop = get_prop(exp_data, "RootComponent")
        if root_comp_prop:
            root_exp_idx = root_comp_prop.get("Value")
            if isinstance(root_exp_idx, int) and root_exp_idx > 0:
                root_exp = export_by_idx.get(root_exp_idx)
                if root_exp:
                    root_data = root_exp.get("Data", [])
                    loc_prop = get_prop(root_data, "RelativeLocation")
                    if loc_prop and isinstance(loc_prop.get("Value"), list):
                        pos = resolve_vector(loc_prop)
                    # Try rotation yaw
                    rot_prop = get_prop(root_data, "RelativeRotation")
                    if rot_prop and isinstance(rot_prop.get("Value"), list):
                        for sub in rot_prop["Value"]:
                            if sub.get("Name") == "Yaw":
                                try:
                                    yaw = float(sub["Value"])
                                except (TypeError, ValueError):
                                    pass

        # Strategy B: spawner itself stores location in GuDingDianSCGTransList (fixed-point list)
        if pos is None:
            gd = get_prop(exp_data, "GuDingDianSCGTransList")
            if gd and isinstance(gd.get("Value"), list) and len(gd["Value"]) > 0:
                first_transform = gd["Value"][0]
                for sub in (first_transform.get("Value") or []):
                    if sub.get("Name") == "Translation":
                        pos = resolve_vector(sub)
                        break

        if pos is None:
            # No coords found — still emit without coords for completeness
            pos = (None, None, None)

        spawn = {
            "map": map_name,
            "map_path": map_rel_path,
            "spawner_class": cls,
            "actor_name": actor_name,
            "pos_x": pos[0],
            "pos_y": pos[1],
            "pos_z": pos[2],
        }
        if yaw is not None:
            spawn["rotation_yaw"] = yaw

        results.append(spawn)

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not os.path.exists(UASSET_GUI):
        print(f"ERROR: UAssetGUI not found at {UASSET_GUI}")
        print("Set UASSET_GUI env var to its path.")
        sys.exit(1)

    # Step 1: find all matching .umap files
    umap_paths = scan_for_spawner_umaps(MAPS_DIR)

    if not umap_paths:
        print("No spawner .umap files found. Check MAPS_DIR path.")
        sys.exit(1)

    # Step 2+3: export each and parse
    all_spawns = []
    errors = []

    with tempfile.TemporaryDirectory() as tmpdir:
        for i, umap_path in enumerate(umap_paths):
            rel = os.path.relpath(umap_path, MAPS_DIR)
            map_name = os.path.splitext(os.path.basename(umap_path))[0]
            size_mb = os.path.getsize(umap_path) / 1e6
            print(f"[{i+1}/{len(umap_paths)}] Exporting {map_name} ({size_mb:.1f} MB)...")

            json_path = os.path.join(tmpdir, map_name + ".json")
            ok = export_umap_to_json(umap_path, json_path)
            if not ok:
                print(f"  SKIP: export failed for {rel}")
                errors.append(rel)
                continue

            spawns = parse_spawns_from_json(json_path, map_name, rel)
            print(f"  → {len(spawns)} spawner actors")
            all_spawns.extend(spawns)

    # Write output
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(all_spawns, fh, indent=2, ensure_ascii=False)

    # Summary
    print(f"\n{'='*60}")
    print(f"Total spawns extracted : {len(all_spawns)}")
    print(f"Maps processed         : {len(umap_paths) - len(errors)}/{len(umap_paths)}")
    if errors:
        print(f"Export failures        : {len(errors)}")
        for e in errors:
            print(f"  {e}")

    # Per-class breakdown (top 20)
    from collections import Counter
    cls_counts = Counter(s["spawner_class"] for s in all_spawns)
    print(f"\nTop spawner classes:")
    for cls, cnt in cls_counts.most_common(20):
        print(f"  {cnt:5d}  {cls}")

    # Per-map breakdown
    map_counts = Counter(s["map"] for s in all_spawns)
    print(f"\nPer-map breakdown:")
    for m, cnt in map_counts.most_common():
        print(f"  {cnt:5d}  {m}")

    # Coords coverage
    with_coords = sum(1 for s in all_spawns if s["pos_x"] is not None)
    print(f"\nWith coordinates: {with_coords}/{len(all_spawns)}")
    print(f"\nOutput: {OUT_FILE}")


if __name__ == "__main__":
    main()
