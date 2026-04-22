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
    write_json(tmp / "Game" / "Parsed" / "items.json", [
        {"id": "Daoju_Iron_Ore",   "category": "material", "subcategory": "ore",
         "name_zh": "铁矿石", "description_zh": "...", "weight": 0.5, "max_stack": 100,
         "durability": None, "icon_path": "/Game/...", "material_type": "EDJCL_KuangWu",
         "storage_level": "EDJCD_LiJiCunDang", "spoil_time_seconds": None,
         "stats": None, "durability_decay": None},
        {"id": "Daoju_Iron_Ingot", "category": "processed", "subcategory": None,
         "name_zh": "铁锭", "description_zh": None, "weight": 0.3, "max_stack": 50,
         "durability": None, "icon_path": None, "material_type": None,
         "storage_level": None, "spoil_time_seconds": None, "stats": None,
         "durability_decay": None},
    ])
    write_json(tmp / "Game" / "Parsed" / "recipes.json", [
        {"id": "BP_PeiFang_Iron_Ingot", "unique_id": "II_1", "brief_zh": "炼铁",
         "recipe_level": 1,
         "output":   {"item_id": "Daoju_Iron_Ingot", "item_path": "/Game/..."},
         "inputs":   [{"item_id": "Daoju_Iron_Ore", "item_path": "/Game/...", "quantity": 2}],
         "station_id": "BP_GongZuoTai_GaoLu", "station_name": "Blast Furnace",
         "station_paths": None, "station_required_level": 1,
         "can_make_by_hand": False, "craft_time_seconds": 20.0,
         "proficiency": "Smelting", "proficiency_xp": 5.0, "quality_levels": None},
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
        assert db.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 2
        assert db.execute("SELECT COUNT(*) FROM recipes").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM stations").fetchone()[0] == 1

        # Iron Ore is raw (nothing outputs it); Iron Ingot is not
        assert db.execute("SELECT is_raw FROM items WHERE id='Daoju_Iron_Ore'").fetchone()[0] == 1
        assert db.execute("SELECT is_raw FROM items WHERE id='Daoju_Iron_Ingot'").fetchone()[0] == 0

        # English names applied
        assert db.execute("SELECT name_en FROM items WHERE id='Daoju_Iron_Ore'").fetchone()[0] == "Iron Ore"

        # Recipe has one 'all' group with one input
        group = db.execute(
            "SELECT kind FROM recipe_input_groups WHERE recipe_id='BP_PeiFang_Iron_Ingot'"
        ).fetchone()
        assert group[0] == "all"
        row = db.execute(
            "SELECT item_id, quantity FROM recipe_input_group_items rigi "
            "JOIN recipe_input_groups rig ON rig.id=rigi.group_id "
            "WHERE rig.recipe_id='BP_PeiFang_Iron_Ingot'"
        ).fetchone()
        assert row == ("Daoju_Iron_Ore", 2)
