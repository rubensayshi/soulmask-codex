"""
Probe a BP_PeiFang (recipe) Blueprint to see what properties are accessible via UE4 Python API.

Run inside modkit:
  "C:\Program Files\Epic Games\SoulMaskModkit\Engine\Binaries\Win64\UE4Editor-Cmd.exe" ^
    "C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS\WS.uproject" ^
    -ExecutePythonScript="<path>\probe_recipe.py" ^
    -stdout -FullStdOutLogOutput -unattended -nopause

Output: prints discovered properties to stdout
"""

import unreal
import json

# Pick a few recipe paths to probe (adjust if these don't exist)
TEST_RECIPES = [
    "/Game/Blueprints/PeiFang/JianZhu/JuShi/BP_PeiFang_JZ_JuShi_DiJi",
    "/Game/Blueprints/PeiFang/WuQi/BP_PeiFang_WQ_ShiTou_FuZi",
    "/Game/Blueprints/PeiFang/ShiWu/BP_PeiFang_SW_ShuRou",
]

# Alternative: find some recipes dynamically
PEIFANG_ROOT = "/Game/Blueprints/PeiFang"


def find_recipe_assets(limit=5):
    """Find BP_PeiFang assets in the content browser."""
    registry = unreal.AssetRegistryHelpers.get_asset_registry()

    # Try to list assets under PeiFang folder
    assets = []
    try:
        # UE4.27 method
        ar_filter = unreal.ARFilter(
            package_paths=[PEIFANG_ROOT],
            recursive_paths=True,
            class_names=["Blueprint"]
        )
        found = registry.get_assets(ar_filter)
        for asset_data in found[:limit]:
            assets.append(str(asset_data.package_name))
    except Exception as e:
        print("[WARN] AssetRegistry scan failed: {}".format(e))

    # Fallback to hardcoded list
    if not assets:
        assets = TEST_RECIPES

    return assets


def probe_object(obj, name="obj", depth=0, max_depth=3):
    """Recursively probe object properties."""
    indent = "  " * depth
    results = {}

    if depth > max_depth:
        return "<max depth>"

    if obj is None:
        return None

    # Get type info
    obj_type = type(obj).__name__
    results["__type__"] = obj_type

    # Handle basic types
    if isinstance(obj, (bool, int, float, str)):
        return obj

    # Handle lists/tuples
    if isinstance(obj, (list, tuple)):
        return [probe_object(item, "item", depth + 1, max_depth) for item in obj[:10]]

    # Handle dicts
    if isinstance(obj, dict):
        return {k: probe_object(v, k, depth + 1, max_depth) for k, v in list(obj.items())[:20]}

    # Try to get properties via dir()
    try:
        attrs = [a for a in dir(obj) if not a.startswith('_')]
        for attr in attrs[:50]:  # Limit to avoid spam
            try:
                val = getattr(obj, attr)
                # Skip methods
                if callable(val):
                    continue
                results[attr] = probe_object(val, attr, depth + 1, max_depth)
            except Exception as e:
                results[attr] = "<error: {}>".format(str(e)[:50])
    except Exception as e:
        results["__dir_error__"] = str(e)

    return results


def probe_blueprint(asset_path):
    """Load a Blueprint and probe its default object (CDO) properties."""
    print("\n" + "=" * 80)
    print("PROBING: {}".format(asset_path))
    print("=" * 80)

    result = {
        "asset_path": asset_path,
        "success": False,
        "properties": {},
        "errors": []
    }

    # Method 1: Load as Blueprint
    try:
        bp = unreal.load_asset(asset_path)
        if bp:
            result["asset_type"] = type(bp).__name__
            print("  Loaded as: {}".format(type(bp).__name__))

            # Try to get generated class
            if hasattr(bp, 'generated_class'):
                gen_class = bp.generated_class()
                if gen_class:
                    print("  Generated class: {}".format(gen_class))
                    result["generated_class"] = str(gen_class)

            # Try to get CDO (Class Default Object)
            if hasattr(bp, 'get_default_object'):
                try:
                    cdo = bp.get_default_object()
                    if cdo:
                        print("  CDO type: {}".format(type(cdo).__name__))
                        result["cdo_type"] = type(cdo).__name__
                        result["properties"]["cdo"] = probe_object(cdo, "cdo")
                except Exception as e:
                    result["errors"].append("get_default_object: {}".format(e))

            # Probe Blueprint object itself
            result["properties"]["blueprint"] = probe_object(bp, "blueprint", max_depth=2)
            result["success"] = True
        else:
            result["errors"].append("load_asset returned None")
    except Exception as e:
        result["errors"].append("load_asset failed: {}".format(e))

    # Method 2: Try loading as object directly
    try:
        obj_path = asset_path + ".Default__" + asset_path.split("/")[-1] + "_C"
        obj = unreal.load_object(None, obj_path)
        if obj:
            print("  Direct CDO load: {}".format(type(obj).__name__))
            result["properties"]["direct_cdo"] = probe_object(obj, "direct_cdo")
    except Exception as e:
        result["errors"].append("direct CDO load: {}".format(e))

    # Method 3: Try EditorAssetLibrary
    try:
        if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
            metadata = unreal.EditorAssetLibrary.get_metadata_tag_values(asset_path)
            if metadata:
                result["properties"]["metadata"] = dict(metadata)
                print("  Metadata tags: {}".format(list(metadata.keys())))
    except Exception as e:
        result["errors"].append("metadata: {}".format(e))

    return result


def try_datatable_approach():
    """Check if there's a recipe DataTable we missed."""
    print("\n" + "=" * 80)
    print("SEARCHING FOR RECIPE-RELATED DATATABLES")
    print("=" * 80)

    registry = unreal.AssetRegistryHelpers.get_asset_registry()

    try:
        ar_filter = unreal.ARFilter(
            class_names=["DataTable"],
            recursive_paths=True
        )
        tables = registry.get_assets(ar_filter)

        recipe_tables = []
        for asset_data in tables:
            name = str(asset_data.asset_name).lower()
            pkg = str(asset_data.package_name)
            if any(kw in name for kw in ["peifang", "recipe", "craft", "zhizuo", "input", "output"]):
                recipe_tables.append(pkg)
                print("  Found: {}".format(pkg))

        return recipe_tables
    except Exception as e:
        print("  Error scanning DataTables: {}".format(e))
        return []


def main():
    print("=" * 80)
    print("SOULMASK RECIPE BLUEPRINT PROBE")
    print("=" * 80)

    # First check for recipe DataTables we might have missed
    recipe_tables = try_datatable_approach()

    # Find and probe recipe Blueprints
    recipes = find_recipe_assets(limit=3)
    print("\nFound {} recipe assets to probe".format(len(recipes)))

    all_results = []
    for recipe_path in recipes:
        result = probe_blueprint(recipe_path)
        all_results.append(result)

        # Print summary
        if result["success"]:
            props = result.get("properties", {})
            print("\n  Properties found:")
            for key, val in props.items():
                if isinstance(val, dict):
                    print("    {}: {} keys".format(key, len(val)))
                else:
                    print("    {}: {}".format(key, type(val).__name__))

        if result["errors"]:
            print("\n  Errors:")
            for err in result["errors"]:
                print("    - {}".format(err))

    # Write full results to file
    output_path = unreal.Paths.project_dir() + "/../../../probe_results.json"
    try:
        # Serialize with custom handler for unserializable objects
        def default_handler(o):
            return "<{}: {}>".format(type(o).__name__, str(o)[:100])

        with open(output_path, "w") as f:
            json.dump({
                "recipe_datatables": recipe_tables,
                "blueprint_probes": all_results
            }, f, indent=2, default=default_handler)
        print("\n\nFull results written to: {}".format(output_path))
    except Exception as e:
        print("\nFailed to write results: {}".format(e))

    print("\n" + "=" * 80)
    print("PROBE COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    main()
