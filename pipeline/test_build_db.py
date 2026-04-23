"""
Integration test for pipeline/build_db.py. Uses fixture JSON files to
build a tiny app.db and asserts structure.
"""
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def make_fixture(tmp: Path):
    """Build a minimal Game/Parsed/ + data/translations/ under tmp."""
    def item(i, cat="material", nz="?", role="raw"):
        return {"id": i, "category": cat, "subcategory": None, "name_zh": nz,
                "description_zh": None, "weight": None, "max_stack": None,
                "durability": None, "icon_path": None, "material_type": None,
                "storage_level": None, "spoil_time_seconds": None, "stats": None,
                "durability_decay": None, "role": role}

    write_json(tmp / "Game" / "Parsed" / "items.json", [
        item("Daoju_Iron_Ore",   "material",  "铁矿石", "raw"),
        item("Daoju_Iron_Ingot", "processed", "铁锭",   "final"),
        item("Daoju_Hide_A",     "material",  "皮A",    "raw"),
        item("Daoju_Hide_B",     "material",  "皮B",    "raw"),
        item("Daoju_Leather",    "processed", "皮革",   "final"),
    ])
    write_json(tmp / "Game" / "Parsed" / "recipes.json", [
        {"id": "BP_PeiFang_Iron_Ingot", "unique_id": "II_1", "brief_zh": "炼铁",
         "recipe_level": 1,
         "output": {"item_id": "Daoju_Iron_Ingot", "item_path": "/Game/..."},
         "input_slots": [
             {"kind": "all", "quantity": 2,
              "items": [{"item_id": "Daoju_Iron_Ore", "item_path": "/Game/..."}]},
         ],
         "station_id": "BP_GongZuoTai_GaoLu", "station_name": "Blast Furnace",
         "station_paths": None, "station_required_level": 1,
         "can_make_by_hand": False, "craft_time_seconds": 20.0,
         "proficiency": "Smelting", "proficiency_xp": 5.0, "quality_levels": None},
        {"id": "BP_PeiFang_Leather", "unique_id": "L_1", "brief_zh": "制革",
         "recipe_level": 1,
         "output": {"item_id": "Daoju_Leather", "item_path": "/Game/..."},
         "input_slots": [
             {"kind": "one_of", "quantity": 1,
              "items": [
                  {"item_id": "Daoju_Hide_A", "item_path": "/Game/..."},
                  {"item_id": "Daoju_Hide_B", "item_path": "/Game/..."},
              ]},
         ],
         "station_id": "BP_GongZuoTai_GaoLu", "station_name": "Blast Furnace",
         "station_paths": None, "station_required_level": None,
         "can_make_by_hand": False, "craft_time_seconds": 10.0,
         "proficiency": "Leatherworking", "proficiency_xp": 3.0, "quality_levels": None},
    ])
    write_json(tmp / "Game" / "Parsed" / "tech_tree.json", [])
    write_json(tmp / "data" / "translations" / "manual.json", {
        "source": "claude-manual", "generated_at": "2026-04-22",
        "entries": {
            "item:Daoju_Iron_Ore":   "Iron Ore",
            "item:Daoju_Iron_Ingot": "Iron Ingot",
            "station:BP_GongZuoTai_GaoLu": "Blast Furnace",
        },
    })
    write_json(tmp / "data" / "translations" / "po.json", {"source": "po", "entries": {}})


def test_build_db_produces_expected_rows():
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        make_fixture(tmp)
        # Copy schema.sql into place expected by build_db
        schema_src = REPO / "backend" / "internal" / "db" / "schema.sql"
        schema_dst = tmp / "backend" / "internal" / "db" / "schema.sql"
        schema_dst.parent.mkdir(parents=True, exist_ok=True)
        schema_dst.write_bytes(schema_src.read_bytes())

        env = {**os.environ, "SOULDB_ROOT": str(tmp)}
        subprocess.run(
            [sys.executable, str(REPO / "pipeline" / "build_db.py")],
            check=True, env=env,
        )

        db = sqlite3.connect(tmp / "data" / "app.db")
        assert db.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 5
        assert db.execute("SELECT COUNT(*) FROM recipes").fetchone()[0] == 2
        assert db.execute("SELECT COUNT(*) FROM stations").fetchone()[0] == 1

        # role passes through from items.json
        assert db.execute("SELECT role FROM items WHERE id='Daoju_Iron_Ore'").fetchone()[0] == "raw"
        assert db.execute("SELECT role FROM items WHERE id='Daoju_Iron_Ingot'").fetchone()[0] == "final"

        # English names applied
        assert db.execute("SELECT name_en FROM items WHERE id='Daoju_Iron_Ore'").fetchone()[0] == "Iron Ore"

        # Iron Ingot recipe: one 'all' group with Iron Ore x2
        ingot_group = db.execute(
            "SELECT kind FROM recipe_input_groups WHERE recipe_id='BP_PeiFang_Iron_Ingot'"
        ).fetchone()
        assert ingot_group == ("all",)
        row = db.execute(
            "SELECT item_id, quantity FROM recipe_input_group_items rigi "
            "JOIN recipe_input_groups rig ON rig.id=rigi.group_id "
            "WHERE rig.recipe_id='BP_PeiFang_Iron_Ingot'"
        ).fetchone()
        assert row == ("Daoju_Iron_Ore", 2)

        # Leather recipe: one 'one_of' group with both hides at qty 1
        leather_group = db.execute(
            "SELECT kind FROM recipe_input_groups WHERE recipe_id='BP_PeiFang_Leather'"
        ).fetchone()
        assert leather_group == ("one_of",)
        leather_items = db.execute(
            "SELECT item_id, quantity FROM recipe_input_group_items rigi "
            "JOIN recipe_input_groups rig ON rig.id=rigi.group_id "
            "WHERE rig.recipe_id='BP_PeiFang_Leather' ORDER BY item_id"
        ).fetchall()
        assert leather_items == [("Daoju_Hide_A", 1), ("Daoju_Hide_B", 1)]
