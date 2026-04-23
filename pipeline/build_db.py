"""
Rebuild data/app.db from Game/Parsed/*.json and data/translations/*.json.

Reads backend/internal/db/schema.sql as the single source of truth for
table structure. Idempotent: deletes any existing db and recreates.

Env:
  SOULDB_ROOT   Override repo root (used by tests).
"""
import json
import os
import re
import sqlite3
from pathlib import Path

ROOT = Path(os.environ.get("SOULDB_ROOT", Path(__file__).resolve().parent.parent))
PARSED = ROOT / "Game" / "Parsed"
TRANSLATIONS = ROOT / "data" / "translations"
DB_PATH = ROOT / "data" / "app.db"
SCHEMA = ROOT / "backend" / "internal" / "db" / "schema.sql"


def load_json(p):
    return json.loads(p.read_text(encoding="utf-8"))


def prettify_bp_id(raw: str) -> str:
    """Daoju_Item_Iron_Ore → 'Iron Ore'; BP_GongZuoTai_GaoLu → 'Gong Zuo Tai Gao Lu'."""
    s = re.sub(r"^(BP_|Daoju_Item_|DaoJu_Item_|Daoju_|DaoJu_)", "", raw)
    s = s.replace("_", " ")
    return " ".join(w.capitalize() for w in s.split())


def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def main():
    if DB_PATH.exists():
        DB_PATH.unlink()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA.read_text(encoding="utf-8"))

    items = load_json(PARSED / "items.json")
    recipes = load_json(PARSED / "recipes.json")
    tech_nodes = load_json(PARSED / "tech_tree.json")

    # items — `role` is set by classify_items.py. Reject if missing so
    # we never silently fall back to a meaningless default.
    for it in items:
        role = it.get("role")
        if role is None:
            raise SystemExit(
                f"item {it['id']} has no role — run pipeline/classify_items.py "
                "after parse_items.py + parse_recipes.py"
            )
        db.execute(
            "INSERT INTO items (id, category, subcategory, name_zh, name_en, "
            "description_zh, weight, max_stack, durability, icon_path, role, stats_json, buffs_json) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                it["id"], it.get("category"), it.get("subcategory"),
                it.get("name_zh"), None,
                it.get("description_zh"), it.get("weight"), it.get("max_stack"),
                it.get("durability"), it.get("icon_path"),
                role,
                json.dumps(it.get("stats")) if it.get("stats") else None,
                json.dumps(it.get("buffs")) if it.get("buffs") else None,
            ),
        )

    # stations — distinct (station_id, station_name) pairs seen in recipes.
    stations = {}
    for r in recipes:
        sid = r.get("station_id")
        if sid:
            stations.setdefault(sid, r.get("station_name"))
    for sid, name_en in stations.items():
        db.execute(
            "INSERT INTO stations (id, name_zh, name_en) VALUES (?,?,?)",
            (sid, None, name_en),
        )

    # Auto-insert placeholder rows for item IDs that appear in recipes but not
    # in items.json (mostly DLC boss keys / unexported subfolder items — 33 total
    # as of this writing). Without these, FK constraints would force us to drop
    # entire recipes just because one OR alternative is missing. Placeholders
    # keep the recipes searchable; when parse_items.py later covers those folders,
    # the placeholders get overwritten.
    item_ids = {it["id"] for it in items}
    referenced = set()
    for r in recipes:
        for slot in r.get("input_slots") or []:
            for opt in slot.get("items") or []:
                referenced.add(opt["item_id"])
        if (r.get("output") or {}).get("item_id"):
            referenced.add(r["output"]["item_id"])
    missing = referenced - item_ids
    for mid in sorted(missing):
        db.execute(
            "INSERT INTO items (id, category, subcategory, name_zh, name_en, "
            "description_zh, weight, max_stack, durability, icon_path, role, stats_json, buffs_json) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (mid, "unknown", None, None, None, None, None, None, None, None, "raw", None, None),
        )
        item_ids.add(mid)
    if missing:
        print(f"  [placeholders] inserted {len(missing)} unknown item refs")

    # recipes + one input group per slot (kind='all' for fixed, 'one_of' for OR)
    inserted_recipe_ids = set()
    skipped = 0
    for r in recipes:
        out = r.get("output") or {}
        if not out.get("item_id") or out["item_id"] not in item_ids:
            skipped += 1
            continue
        input_slots = r.get("input_slots") or []
        # Validate every referenced item exists
        missing = False
        for slot in input_slots:
            for opt in slot.get("items") or []:
                if opt["item_id"] not in item_ids:
                    missing = True
                    break
            if missing:
                break
        if missing:
            skipped += 1
            continue
        db.execute(
            "INSERT INTO recipes (id, output_item_id, output_qty, station_id, "
            "can_make_by_hand, craft_time_seconds, proficiency, proficiency_xp, "
            "awareness_xp, recipe_level) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                r["id"], out["item_id"], 1,
                r.get("station_id"),
                1 if r.get("can_make_by_hand") else 0,
                r.get("craft_time_seconds"),
                r.get("proficiency"), r.get("proficiency_xp"),
                r.get("awareness_xp"),
                r.get("recipe_level"),
            ),
        )
        inserted_recipe_ids.add(r["id"])
        for gi, slot in enumerate(input_slots):
            cur = db.execute(
                "INSERT INTO recipe_input_groups (recipe_id, group_index, kind) VALUES (?,?,?)",
                (r["id"], gi, slot["kind"]),
            )
            group_id = cur.lastrowid
            qty = slot.get("quantity") or 1
            for opt in slot.get("items") or []:
                db.execute(
                    "INSERT INTO recipe_input_group_items (group_id, item_id, quantity) "
                    "VALUES (?,?,?)",
                    (group_id, opt["item_id"], qty),
                )

    # tech nodes — parent_id set to first prerequisite main node (flat ancestry model).
    # Two passes: insert rows with NULL parent_id, then update once all rows exist
    # (avoids FK ordering issues).
    for n in tech_nodes:
        db.execute(
            "INSERT INTO tech_nodes (id, category, name_zh, name_en, description_zh, "
            "required_mask_level, consume_points, parent_id, icon_path) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (
                n["id"], n.get("category"), n.get("name_zh"), None,
                n.get("description_zh"), n.get("required_mask_level"),
                n.get("consume_points"),
                None,
                n.get("icon_path"),
            ),
        )
    existing_node_ids = {n["id"] for n in tech_nodes}
    for n in tech_nodes:
        parent = (n.get("prerequisite_main_nodes") or [None])[0]
        if parent and parent in existing_node_ids:
            db.execute(
                "UPDATE tech_nodes SET parent_id=? WHERE id=?",
                (parent, n["id"]),
            )

    # tech unlocks — only link recipes that we actually inserted
    for n in tech_nodes:
        for rec_id in (n.get("unlocks_recipes") or []):
            if rec_id in inserted_recipe_ids:
                db.execute(
                    "INSERT OR IGNORE INTO tech_node_unlocks_recipe (tech_node_id, recipe_id) "
                    "VALUES (?,?)",
                    (n["id"], rec_id),
                )

    # translations — PO first (authoritative), then manual fills gaps, then bp_prettify
    po = load_json(TRANSLATIONS / "po.json").get("entries", {})
    manual = load_json(TRANSLATIONS / "manual.json").get("entries", {})

    for key, en in po.items():
        db.execute(
            "INSERT OR REPLACE INTO translations (key, en, source) VALUES (?,?,?)",
            (key, en, "po"),
        )
    for key, en in manual.items():
        db.execute(
            "INSERT OR IGNORE INTO translations (key, en, source) VALUES (?,?,?)",
            (key, en, "manual"),
        )

    def ensure(prefix: str, raw_id: str):
        key = f"{prefix}:{raw_id}"
        row = db.execute("SELECT 1 FROM translations WHERE key=?", (key,)).fetchone()
        if row is None:
            db.execute(
                "INSERT INTO translations (key, en, source) VALUES (?,?,?)",
                (key, prettify_bp_id(raw_id), "bp_prettify"),
            )

    for it in items:
        ensure("item", it["id"])
    for sid in stations:
        ensure("station", sid)
    for n in tech_nodes:
        ensure("tech_node", n["id"])

    # Apply translations to the entity tables
    db.execute("""
        UPDATE items SET name_en = (
          SELECT en FROM translations WHERE key = 'item:' || items.id
        )
    """)
    db.execute("""
        UPDATE stations SET name_en = COALESCE(
          (SELECT en FROM translations WHERE key = 'station:' || stations.id),
          stations.name_en
        )
    """)
    db.execute("""
        UPDATE tech_nodes SET name_en = (
          SELECT en FROM translations WHERE key = 'tech_node:' || tech_nodes.id
        )
    """)

    # Compute unique slugs from name_en (already populated via translations).
    rows = db.execute("SELECT id, name_en FROM items").fetchall()
    slug_counts: dict[str, int] = {}
    for item_id, name_en in rows:
        base = slugify(name_en) if name_en else slugify(prettify_bp_id(item_id))
        slug_counts[base] = slug_counts.get(base, 0) + 1
    seen: dict[str, int] = {}
    for item_id, name_en in rows:
        base = slugify(name_en) if name_en else slugify(prettify_bp_id(item_id))
        if slug_counts[base] > 1:
            seen[base] = seen.get(base, 0) + 1
            slug = f"{base}-{seen[base]}" if seen[base] > 1 else base
        else:
            slug = base
        db.execute("UPDATE items SET slug=? WHERE id=?", (slug, item_id))

    db.commit()
    db.execute("VACUUM")
    db.close()

    print(f"Built {DB_PATH}")
    print(f"  items:             {len(items)}")
    print(f"  recipes inserted:  {len(inserted_recipe_ids)}  (skipped {skipped})")
    print(f"  stations:          {len(stations)}")
    print(f"  tech_nodes:        {len(tech_nodes)}")


if __name__ == "__main__":
    main()
