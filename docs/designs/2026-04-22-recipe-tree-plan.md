# Recipe Tree Implementation Plan

**Goal:** Build a working local instance of the Recipe Tree site — Go backend serving a React SPA, SQLite DB built from `Game/Parsed/*.json`, with enough translations to be usable in English.

**Architecture:** Pipeline (Python) rebuilds `data/app.db` from JSON + translations. Go backend opens the DB read-only, exposes three endpoints (`/api/graph`, `/api/items/:id`, `/api/search`), embeds the Vite SPA. React SPA loads the full crafting graph once and does all tree/flow rendering client-side.

**Tech Stack:** Python 3 (pipeline), Go 1.22 + `chi` + `modernc.org/sqlite` + `sqlc` + `zerolog`, React 18 + Vite + TypeScript + Tailwind + Zustand + react-router v6, pnpm, make.

**Source spec:** `docs/designs/2026-04-22-recipe-tree-design.md` — authoritative for all shape decisions.

**Phasing:** 10 phases, each landing a commit (or a small sequence). Phases build top-to-bottom: DB → backend → frontend scaffolding → tree view → flow view → used-in → sidebar → polish. MVP (Phase 5) is already usable end-to-end.

---

## File-structure map

Before the tasks, here's every file this plan creates and its responsibility. Locks decomposition decisions up front.

### `/pipeline/` (additions)
| File | Responsibility |
|---|---|
| `build_db.py` | Rebuild `data/app.db` from parsed JSON + translations. |
| `generate_translations.py` | Emit a yaml batch of items needing English translation. |
| `test_build_db.py` | Pytest: build a tiny fixture db and assert structure. |

### `/backend/`
| File | Responsibility |
|---|---|
| `go.mod`, `go.sum` | Module at `github.com/rubensayshi/soulmask-codex/backend`. |
| `sqlc.yaml` | sqlc config pointing at `internal/db/queries.sql` + `schema.sql`. |
| `cmd/server/main.go` | Wire everything: open DB, start server, handle `-dev` flag. |
| `internal/db/schema.sql` | Single source of truth for SQLite schema. |
| `internal/db/queries.sql` | sqlc input — raw SQL queries. |
| `internal/db/gen/*.go` | sqlc-generated Go code (committed). |
| `internal/db/db.go` | DB open + mtime helper. |
| `internal/graph/build.go` | Load items+recipes+stations into the compact Graph payload. |
| `internal/graph/build_test.go` | Unit tests against a built fixture db. |
| `internal/api/router.go` | chi router, route registration. |
| `internal/api/graph.go` | `/api/graph` handler — ETag + caching. |
| `internal/api/items.go` | `/api/items/:id` handler. |
| `internal/api/search.go` | `/api/search` handler. |
| `internal/api/api_test.go` | HTTP-level tests using `httptest`. |
| `internal/spa/embed.go` | `//go:embed dist/*` + SPA fallback handler + dev-mode proxy. |
| `internal/spa/dist/.gitkeep` | Placeholder so `go:embed` compiles before frontend build. |
| `.gitignore` | Ignore `internal/spa/dist/*` except `.gitkeep`. |

### `/web/`
| File | Responsibility |
|---|---|
| `package.json`, `pnpm-lock.yaml` | deps |
| `vite.config.ts` | Vite + proxy `/api/*` → `localhost:8080`. |
| `tailwind.config.ts` | Theme extension ports prototype palette/fonts. |
| `postcss.config.js`, `tsconfig.json`, `index.html` | Standard. |
| `src/main.tsx` | React + router entry. |
| `src/App.tsx` | Routes + graph bootstrap. |
| `src/pages/Home.tsx` | Placeholder homepage. |
| `src/pages/Item.tsx` | Item detail page composition. |
| `src/components/Layout.tsx` | Topnav + sidebar + main shell. |
| `src/components/TopNav.tsx` | Logo + view toggle. |
| `src/components/Sidebar.tsx` | History / search-results. |
| `src/components/ItemHeader.tsx` | Diamond icon + title + meta. |
| `src/components/QtyControl.tsx` | +/− multiplier. |
| `src/components/TreeView.tsx` | Ingredient list tree. |
| `src/components/FlowView.tsx` | Diamond-node flow diagram. |
| `src/components/UsedIn.tsx` | Both upstream views (mode branch inside). |
| `src/components/RawMats.tsx` | Collapsible shopping list. |
| `src/components/Diamond.tsx` | Low-level diamond primitive (rotate/counter-rotate). |
| `src/components/Icon.tsx` | `<img>` + initials fallback. |
| `src/store/index.ts` | Zustand store. |
| `src/lib/api.ts` | `fetch` wrappers. |
| `src/lib/graph.ts` | `buildIngredientTree`, `buildUsedInIndex`, `computeRawMats`. |
| `src/lib/graph.test.ts` | Vitest unit tests. |
| `src/lib/types.ts` | `Graph`, `Item`, `Recipe` type defs. |
| `src/styles/globals.css` | Tailwind `@tailwind` directives + font imports. |
| `src/styles/components.css` | `@apply` blocks for diamond/connector helpers. |

### `/data/`
| File | Responsibility |
|---|---|
| `translations/manual.json` | Claude-generated English names (committed). |
| `translations/po.json` | Empty stub (committed); populated later from modkit. |
| `app.db` | Built by pipeline (gitignored). |

### Root
| File | Responsibility |
|---|---|
| `Makefile` | `dev`, `build`, `db`, `sqlc`, `translate`, `test` targets. |
| `tasks/translate_batch.yaml` | Emitted by `generate_translations.py`, gitignored. |
| `.gitignore` additions | `data/app.db`, `backend/internal/spa/dist/*`, `tasks/translate_batch.yaml`, `web/dist/`, `web/node_modules/`, `backend/bin/`. |

---

## Phase 0: Repo scaffolding

Single commit. Lay down the directory structure + stub files so subsequent phases land cleanly.

### Task 0.1: Create directory tree and placeholder files

**Files:** Create directories and empty/near-empty files.

- [ ] **Step 1: Create directories**

```bash
mkdir -p backend/cmd/server
mkdir -p backend/internal/{db/gen,graph,api,spa/dist}
mkdir -p web/src/{components,pages,store,lib,styles}
mkdir -p data/translations
mkdir -p tasks
```

- [ ] **Step 2: Create placeholder files**

Create `backend/internal/spa/dist/.gitkeep` (empty) so `go:embed dist/*` compiles before the frontend build produces real files.

Create `data/translations/manual.json`:
```json
{
  "source": "claude-manual",
  "generated_at": "2026-04-22",
  "entries": {}
}
```

Create `data/translations/po.json`:
```json
{
  "source": "po",
  "entries": {}
}
```

- [ ] **Step 3: Extend `.gitignore`**

Append to `/Users/ruben/work/private/souldb/.gitignore`:
```
# Build artifacts
data/app.db
web/node_modules/
web/dist/
backend/bin/
backend/internal/spa/dist/*
!backend/internal/spa/dist/.gitkeep

# Pipeline outputs
tasks/translate_batch.yaml
```

- [ ] **Step 4: Write Makefile at repo root**

Create `/Users/ruben/work/private/souldb/Makefile`:
```makefile
.PHONY: dev build db sqlc translate test clean

db:
	python3 pipeline/build_db.py

translate:
	python3 pipeline/generate_translations.py

sqlc:
	cd backend && sqlc generate

test:
	cd backend && go test ./...
	cd web && pnpm test -- --run
	pytest pipeline/

build: sqlc
	cd web && pnpm install && pnpm build
	rm -rf backend/internal/spa/dist
	cp -r web/dist backend/internal/spa/dist
	cd backend && go build -o bin/server ./cmd/server

dev:
	@echo "Start backend:  cd backend && go run ./cmd/server -dev"
	@echo "Start web:      cd web && pnpm dev"
	@echo "Rebuild db:     make db"

clean:
	rm -rf backend/bin backend/internal/spa/dist/* web/dist web/node_modules data/app.db
	touch backend/internal/spa/dist/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add Makefile .gitignore backend/ web/ data/ tasks/
git commit -m "chore: scaffold backend/web/data directories and Makefile"
```

---

## Phase 1: SQLite schema + `build_db.py`

Goal: running `make db` produces a populated `data/app.db` that matches the schema. Test-first via pytest.

### Task 1.1: Write `schema.sql`

**Files:** Create `/Users/ruben/work/private/souldb/backend/internal/db/schema.sql`.

- [ ] **Step 1: Write the schema**

Paste the full schema from the design doc §"Data model (SQLite)" into `backend/internal/db/schema.sql`. Exact content:

```sql
CREATE TABLE items (
  id              TEXT PRIMARY KEY,
  category        TEXT,
  subcategory     TEXT,
  name_zh         TEXT,
  name_en         TEXT,
  description_zh  TEXT,
  weight          REAL,
  max_stack       INTEGER,
  durability      INTEGER,
  icon_path       TEXT,
  is_raw          INTEGER NOT NULL,
  stats_json      TEXT
);

CREATE TABLE stations (
  id       TEXT PRIMARY KEY,
  name_zh  TEXT,
  name_en  TEXT
);

CREATE TABLE recipes (
  id                  TEXT PRIMARY KEY,
  output_item_id      TEXT NOT NULL REFERENCES items(id),
  output_qty          INTEGER NOT NULL DEFAULT 1,
  station_id          TEXT REFERENCES stations(id),
  can_make_by_hand    INTEGER,
  craft_time_seconds  REAL,
  proficiency         TEXT,
  proficiency_xp      REAL,
  recipe_level        INTEGER
);

CREATE TABLE recipe_input_groups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id    TEXT NOT NULL REFERENCES recipes(id),
  group_index  INTEGER NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('all','one_of'))
);

CREATE TABLE recipe_input_group_items (
  group_id   INTEGER NOT NULL REFERENCES recipe_input_groups(id),
  item_id    TEXT NOT NULL REFERENCES items(id),
  quantity   INTEGER NOT NULL,
  PRIMARY KEY (group_id, item_id)
);
CREATE INDEX idx_rigi_item ON recipe_input_group_items(item_id);
CREATE INDEX idx_recipe_output ON recipes(output_item_id);

CREATE TABLE tech_nodes (
  id                   TEXT PRIMARY KEY,
  category             TEXT,
  name_zh              TEXT,
  name_en              TEXT,
  description_zh       TEXT,
  required_mask_level  INTEGER,
  consume_points       INTEGER,
  parent_id            TEXT REFERENCES tech_nodes(id),
  icon_path            TEXT
);

CREATE TABLE tech_node_unlocks_recipe (
  tech_node_id  TEXT NOT NULL REFERENCES tech_nodes(id),
  recipe_id     TEXT NOT NULL REFERENCES recipes(id),
  PRIMARY KEY (tech_node_id, recipe_id)
);

CREATE TABLE translations (
  key     TEXT PRIMARY KEY,
  en      TEXT NOT NULL,
  source  TEXT NOT NULL
);
```

- [ ] **Step 2: Commit**

```bash
git add backend/internal/db/schema.sql
git commit -m "feat(backend): add sqlite schema"
```

### Task 1.2: Write failing test for `build_db.py`

**Files:** Create `/Users/ruben/work/private/souldb/pipeline/test_build_db.py`.

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pytest pipeline/test_build_db.py -v
```
Expected: FAIL — `build_db.py` does not exist.

### Task 1.3: Write `build_db.py`

**Files:** Create `/Users/ruben/work/private/souldb/pipeline/build_db.py`.

- [ ] **Step 1: Write the script**

```python
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
import sys
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
    s = re.sub(r"^(BP_|Daoju_|DaoJu_Item_|Daoju_Item_|DaoJu_)", "", raw)
    s = s.replace("_", " ")
    return " ".join(w.capitalize() for w in s.split())


def main():
    if DB_PATH.exists():
        DB_PATH.unlink()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA.read_text(encoding="utf-8"))

    items = load_json(PARSED / "items.json")
    recipes = load_json(PARSED / "recipes.json")
    tech_nodes = load_json(PARSED / "tech_tree.json")

    # Determine which items are raw (have no recipe producing them)
    produced_ids = {
        r["output"]["item_id"]
        for r in recipes
        if r.get("output")
    }

    # items
    for it in items:
        db.execute(
            "INSERT INTO items (id, category, subcategory, name_zh, name_en, "
            "description_zh, weight, max_stack, durability, icon_path, is_raw, stats_json) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                it["id"], it.get("category"), it.get("subcategory"),
                it.get("name_zh"), None,  # name_en filled below
                it.get("description_zh"), it.get("weight"), it.get("max_stack"),
                it.get("durability"), it.get("icon_path"),
                0 if it["id"] in produced_ids else 1,
                json.dumps(it.get("stats")) if it.get("stats") else None,
            ),
        )

    # stations (distinct from recipes)
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

    # recipes + groups
    for r in recipes:
        out = r.get("output") or {}
        if not out.get("item_id"):
            continue
        db.execute(
            "INSERT INTO recipes (id, output_item_id, output_qty, station_id, "
            "can_make_by_hand, craft_time_seconds, proficiency, proficiency_xp, recipe_level) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (
                r["id"], out["item_id"], 1,
                r.get("station_id"),
                1 if r.get("can_make_by_hand") else 0,
                r.get("craft_time_seconds"),
                r.get("proficiency"), r.get("proficiency_xp"),
                r.get("recipe_level"),
            ),
        )
        inputs = r.get("inputs") or []
        if not inputs:
            continue
        cur = db.execute(
            "INSERT INTO recipe_input_groups (recipe_id, group_index, kind) VALUES (?, 0, 'all')",
            (r["id"],),
        )
        group_id = cur.lastrowid
        for ingr in inputs:
            db.execute(
                "INSERT INTO recipe_input_group_items (group_id, item_id, quantity) "
                "VALUES (?,?,?)",
                (group_id, ingr["item_id"], ingr.get("quantity") or 1),
            )

    # tech nodes
    for n in tech_nodes:
        db.execute(
            "INSERT INTO tech_nodes (id, category, name_zh, name_en, description_zh, "
            "required_mask_level, consume_points, parent_id, icon_path) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (
                n["id"], n.get("category"), n.get("name_zh"), None,
                n.get("description_zh"), n.get("required_mask_level"),
                n.get("consume_points"),
                (n.get("prerequisite_main_nodes") or [None])[0],
                n.get("icon_path"),
            ),
        )
    # tech unlocks (only link if recipe was inserted)
    inserted_recipe_ids = {r["id"] for r in recipes if (r.get("output") or {}).get("item_id")}
    for n in tech_nodes:
        for rec_id in (n.get("unlocks_recipes") or []):
            if rec_id in inserted_recipe_ids:
                db.execute(
                    "INSERT OR IGNORE INTO tech_node_unlocks_recipe (tech_node_id, recipe_id) "
                    "VALUES (?,?)",
                    (n["id"], rec_id),
                )

    # translations: PO first (authoritative), then manual fills gaps, then bp_prettify
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

    # Fill bp_prettify for everything that still has no translation
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

    # Apply translations to target tables
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

    db.commit()
    db.execute("VACUUM")
    db.close()

    print(f"Built {DB_PATH}")
    print(f"  items:       {len(items)}")
    print(f"  recipes:     {len(recipes)}")
    print(f"  stations:    {len(stations)}")
    print(f"  tech_nodes:  {len(tech_nodes)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run test, confirm PASS**

```bash
pytest pipeline/test_build_db.py -v
```
Expected: PASS.

- [ ] **Step 3: Run against real data**

```bash
make db
sqlite3 data/app.db 'SELECT COUNT(*) FROM items;'        # expect 2015
sqlite3 data/app.db 'SELECT COUNT(*) FROM recipes;'       # expect 1109
sqlite3 data/app.db 'SELECT COUNT(*) FROM stations;'      # expect ~35
sqlite3 data/app.db 'SELECT COUNT(*) FROM tech_nodes;'    # expect 777
sqlite3 data/app.db 'SELECT COUNT(*) FROM recipe_input_group_items;'  # expect ~3k
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/build_db.py pipeline/test_build_db.py data/translations/
git commit -m "feat(pipeline): add build_db.py that loads parsed JSON + translations into sqlite"
```

---

## Phase 2: Translation batch

Goal: `data/translations/manual.json` contains English names for the ~1,000 items that appear in recipes, plus stations and proficiencies.

### Task 2.1: Write `generate_translations.py`

**Files:** Create `/Users/ruben/work/private/souldb/pipeline/generate_translations.py`.

- [ ] **Step 1: Write the script**

```python
"""
Emit tasks/translate_batch.yaml — a list of keys that appear in recipes
(or otherwise need English) but aren't yet translated in manual.json / po.json.

A Claude session then fills in translations and writes data/translations/manual.json.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARSED = ROOT / "Game" / "Parsed"
TRANSLATIONS = ROOT / "data" / "translations"
OUT = ROOT / "tasks" / "translate_batch.yaml"


def main():
    items = {i["id"]: i for i in json.loads((PARSED / "items.json").read_text())}
    recipes = json.loads((PARSED / "recipes.json").read_text())
    manual = json.loads((TRANSLATIONS / "manual.json").read_text()).get("entries", {})
    po     = json.loads((TRANSLATIONS / "po.json").read_text()).get("entries", {})
    known = set(manual) | set(po)

    # Items: any item that appears as recipe input or output
    needed_items = set()
    for r in recipes:
        out = r.get("output") or {}
        if out.get("item_id"):
            needed_items.add(out["item_id"])
        for inp in r.get("inputs") or []:
            needed_items.add(inp["item_id"])

    # Stations + proficiencies
    stations = {}
    profs = set()
    for r in recipes:
        if r.get("station_id"):
            stations.setdefault(r["station_id"], r.get("station_name"))
        if r.get("proficiency"):
            profs.add(r["proficiency"])

    lines = ["# Translation batch. Fill `en` values and merge into data/translations/manual.json.\n"]

    lines.append("items:\n")
    for item_id in sorted(needed_items):
        key = f"item:{item_id}"
        if key in known:
            continue
        it = items.get(item_id, {})
        name_zh = it.get("name_zh") or ""
        cat = it.get("category") or ""
        lines.append(f"  - key: {key}\n")
        lines.append(f"    zh: {json.dumps(name_zh, ensure_ascii=False)}\n")
        lines.append(f"    category: {cat}\n")
        lines.append(f"    en: \"\"\n")

    lines.append("\nstations:\n")
    for sid, sname in sorted(stations.items()):
        key = f"station:{sid}"
        if key in known:
            continue
        lines.append(f"  - key: {key}\n")
        lines.append(f"    current: {json.dumps(sname or '', ensure_ascii=False)}\n")
        lines.append(f"    en: \"\"\n")

    lines.append("\nproficiencies:\n")
    for p in sorted(profs):
        key = f"proficiency:{p}"
        if key in known:
            continue
        lines.append(f"  - key: {key}\n")
        lines.append(f"    current: {json.dumps(p, ensure_ascii=False)}\n")
        lines.append(f"    en: \"\"\n")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

```bash
make translate
head -40 tasks/translate_batch.yaml
```
Expected: A yaml listing of items with empty `en` fields.

- [ ] **Step 3: Commit the script**

```bash
git add pipeline/generate_translations.py
git commit -m "feat(pipeline): add generate_translations.py"
```

### Task 2.2: Fill `manual.json` with Claude translations

**Files:** Modify `/Users/ruben/work/private/souldb/data/translations/manual.json`.

- [ ] **Step 1: Translate the batch**

Open `tasks/translate_batch.yaml`. For each entry, use Chinese name + BP id + game context to produce a quality English name. Write the result into `data/translations/manual.json` under `entries` as `{key: en_name}`.

Guidance for Chinese → English:
- **铁锭** (Iron Ingot), **钢锭** (Steel Ingot), **铜锭** (Copper Ingot) — material tier follows metal name + Ingot
- **兽皮** (Beast Hide), **优质兽皮** (Premium Beast Hide), **厚兽皮** (Thick Hide) — prefix adjective + base noun
- **粗革** (Crude Leather), **皮革** (Leather), **优质皮革** (Premium Leather), **精致皮革** (Refined Leather) — four-tier progression
- **石头** (Stone), **木材** (Wood), **植物纤维** (Plant Fiber) — common materials
- **BP_GongZuoTai_ZhuZaoTai** (Smithing Station), **BP_GongZuoTai_GaoLu** (Blast Furnace), **BP_GongZuoTai_PengRenTai** (Cooking Station) — station names match Soulmask wiki conventions
- Use the BP filename as a hint when the Chinese is ambiguous.
- For items you're unsure about, leave a prettified BP name — `bp_prettify` will cover what we miss.

Estimated batch size: ~1,000 items + ~35 stations + ~12 proficiencies. Break into sections of ~100 and commit as you go.

- [ ] **Step 2: Rebuild db and verify**

```bash
make db
sqlite3 data/app.db "SELECT COUNT(*) FROM items WHERE name_en IS NOT NULL;"
# Should be close to 2015 (every item has a translation via po/manual/bp_prettify fallback)
sqlite3 data/app.db "SELECT id, name_zh, name_en FROM items WHERE name_zh='铁锭';"
# Should show name_en = 'Iron Ingot'
```

- [ ] **Step 3: Commit**

```bash
git add data/translations/manual.json
git commit -m "feat(data): add first-pass English translations for recipe items"
```

---

## Phase 3: Go backend

Goal: `go run ./cmd/server` serves the three API endpoints against real data.

### Task 3.1: Initialize Go module and install deps

**Files:** Create `/Users/ruben/work/private/souldb/backend/go.mod`.

- [ ] **Step 1: Init module**

```bash
cd backend
go mod init github.com/rubensayshi/soulmask-codex/backend
go get github.com/go-chi/chi/v5
go get modernc.org/sqlite
go get github.com/rs/zerolog
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
```

- [ ] **Step 2: Commit**

```bash
git add backend/go.mod backend/go.sum
git commit -m "chore(backend): initialize Go module with chi, sqlite, zerolog, sqlc"
```

### Task 3.2: Configure sqlc

**Files:** Create `/Users/ruben/work/private/souldb/backend/sqlc.yaml`, `/Users/ruben/work/private/souldb/backend/internal/db/queries.sql`.

- [ ] **Step 1: Write sqlc config**

`backend/sqlc.yaml`:
```yaml
version: "2"
sql:
  - engine: "sqlite"
    queries: "internal/db/queries.sql"
    schema: "internal/db/schema.sql"
    gen:
      go:
        package: "dbgen"
        out: "internal/db/gen"
        sql_package: "database/sql"
        emit_prepared_queries: false
        emit_interface: false
        emit_exact_table_names: false
        emit_empty_slices: true
```

- [ ] **Step 2: Write queries.sql**

`backend/internal/db/queries.sql`:
```sql
-- name: GetItem :one
SELECT * FROM items WHERE id = ?;

-- name: ListItemsForGraph :many
SELECT id, name_en, name_zh, category, is_raw, icon_path FROM items;

-- name: ListRecipesForGraph :many
SELECT id, output_item_id, output_qty, station_id, craft_time_seconds,
       proficiency, recipe_level
FROM recipes;

-- name: ListRecipeGroupsForGraph :many
SELECT rig.id AS group_id, rig.recipe_id, rig.group_index, rig.kind,
       rigi.item_id, rigi.quantity
FROM recipe_input_groups rig
JOIN recipe_input_group_items rigi ON rigi.group_id = rig.id
ORDER BY rig.recipe_id, rig.group_index;

-- name: ListStationsForGraph :many
SELECT id, name_en, name_zh FROM stations;

-- name: SearchItems :many
SELECT id, name_en, name_zh, category
FROM items
WHERE name_en LIKE '%' || @q || '%' COLLATE NOCASE
   OR name_zh LIKE '%' || @q || '%'
ORDER BY
  CASE
    WHEN name_en LIKE @q || '%' COLLATE NOCASE THEN 0
    WHEN name_zh LIKE @q || '%' THEN 1
    ELSE 2
  END,
  name_en
LIMIT @lim;

-- name: GetRecipesForOutput :many
SELECT * FROM recipes WHERE output_item_id = ?;

-- name: GetRecipesUsingInput :many
SELECT DISTINCT r.* FROM recipes r
JOIN recipe_input_groups rig ON rig.recipe_id = r.id
JOIN recipe_input_group_items rigi ON rigi.group_id = rig.id
WHERE rigi.item_id = ?;

-- name: GetTechUnlocksForRecipe :many
SELECT tn.* FROM tech_nodes tn
JOIN tech_node_unlocks_recipe u ON u.tech_node_id = tn.id
WHERE u.recipe_id = ?;
```

- [ ] **Step 3: Run sqlc and commit**

```bash
cd backend && sqlc generate
ls internal/db/gen/    # should show models.go, db.go, queries.sql.go
```

```bash
git add backend/sqlc.yaml backend/internal/db/queries.sql backend/internal/db/gen/
git commit -m "feat(backend): add sqlc config and generated queries"
```

### Task 3.3: DB open helper

**Files:** Create `/Users/ruben/work/private/souldb/backend/internal/db/db.go`.

- [ ] **Step 1: Write the helper**

```go
package db

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "modernc.org/sqlite"
)

// Open opens the sqlite db read-only. Caller owns closing.
func Open(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, fmt.Errorf("db file missing at %s: %w", path, err)
	}
	dsn := fmt.Sprintf("file:%s?mode=ro&_pragma=foreign_keys(1)", path)
	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	if err := conn.Ping(); err != nil {
		conn.Close()
		return nil, err
	}
	return conn, nil
}

// Mtime returns the file modification time; used for cache invalidation.
func Mtime(path string) (time.Time, error) {
	info, err := os.Stat(path)
	if err != nil {
		return time.Time{}, err
	}
	return info.ModTime(), nil
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/internal/db/db.go
git commit -m "feat(backend): add db open helper (read-only)"
```

### Task 3.4: Graph builder with test

**Files:** Create `/Users/ruben/work/private/souldb/backend/internal/graph/build.go` and `build_test.go`.

- [ ] **Step 1: Define types**

`backend/internal/graph/build.go`:
```go
// Package graph builds the compact crafting graph served at /api/graph.
package graph

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

// Graph is the shape shipped to the client on page load.
type Graph struct {
	Items    []Item    `json:"items"`
	Recipes  []Recipe  `json:"recipes"`
	Stations []Station `json:"stations"`
}

type Item struct {
	ID       string  `json:"id"`
	N        *string `json:"n"`          // name_en
	NZ       *string `json:"nz"`         // name_zh
	Cat      *string `json:"cat"`        // category
	Raw      bool    `json:"raw"`
	IconPath *string `json:"ic,omitempty"`
}

type Recipe struct {
	ID       string   `json:"id"`
	Out      string   `json:"out"`                   // output_item_id
	OutQ     int64    `json:"outQ"`                  // output_qty
	Station  *string  `json:"st,omitempty"`          // station_id
	Time     *float64 `json:"t,omitempty"`           // craft_time_seconds
	Prof     *string  `json:"prof,omitempty"`
	Groups   []Group  `json:"groups"`
}

type Group struct {
	Kind  string      `json:"kind"` // 'all' | 'one_of'
	Items []GroupItem `json:"items"`
}

type GroupItem struct {
	ID string `json:"id"`
	Q  int64  `json:"q"`
}

type Station struct {
	ID string  `json:"id"`
	N  *string `json:"n"`
}

// Build reads all items, recipes, groups, and stations from the db and
// assembles the graph.
func Build(ctx context.Context, sqlDB *sql.DB) (*Graph, error) {
	q := dbgen.New(sqlDB)

	itemRows, err := q.ListItemsForGraph(ctx)
	if err != nil {
		return nil, fmt.Errorf("list items: %w", err)
	}
	items := make([]Item, 0, len(itemRows))
	for _, r := range itemRows {
		items = append(items, Item{
			ID:       r.ID,
			N:        nullable(r.NameEn),
			NZ:       nullable(r.NameZh),
			Cat:      nullable(r.Category),
			Raw:      r.IsRaw != 0,
			IconPath: nullable(r.IconPath),
		})
	}

	recipeRows, err := q.ListRecipesForGraph(ctx)
	if err != nil {
		return nil, fmt.Errorf("list recipes: %w", err)
	}
	recipesByID := make(map[string]*Recipe, len(recipeRows))
	recipes := make([]Recipe, 0, len(recipeRows))
	for _, r := range recipeRows {
		rec := Recipe{
			ID:     r.ID,
			Out:    r.OutputItemID,
			OutQ:   r.OutputQty,
			Station: nullable(r.StationID),
			Time:   nullablef(r.CraftTimeSeconds),
			Prof:   nullable(r.Proficiency),
			Groups: []Group{},
		}
		recipes = append(recipes, rec)
		recipesByID[r.ID] = &recipes[len(recipes)-1]
	}

	groupRows, err := q.ListRecipeGroupsForGraph(ctx)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}
	// Rows are ordered by recipe_id, group_index. Fold into structured Groups.
	var curRecipe *Recipe
	var curGroupID int64 = -1
	var curGroup *Group
	for _, gr := range groupRows {
		rec, ok := recipesByID[gr.RecipeID]
		if !ok {
			continue
		}
		if rec != curRecipe || gr.GroupID != curGroupID {
			rec.Groups = append(rec.Groups, Group{Kind: gr.Kind, Items: []GroupItem{}})
			curRecipe = rec
			curGroupID = gr.GroupID
			curGroup = &rec.Groups[len(rec.Groups)-1]
		}
		curGroup.Items = append(curGroup.Items, GroupItem{ID: gr.ItemID, Q: gr.Quantity})
	}

	stationRows, err := q.ListStationsForGraph(ctx)
	if err != nil {
		return nil, fmt.Errorf("list stations: %w", err)
	}
	stations := make([]Station, 0, len(stationRows))
	for _, s := range stationRows {
		stations = append(stations, Station{ID: s.ID, N: nullable(s.NameEn)})
	}

	return &Graph{Items: items, Recipes: recipes, Stations: stations}, nil
}

// MarshalJSON on Graph: deterministic, no HTML escaping.
func Marshal(g *Graph) ([]byte, error) {
	return json.Marshal(g)
}

func nullable(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

func nullablef(f sql.NullFloat64) *float64 {
	if !f.Valid {
		return nil
	}
	v := f.Float64
	return &v
}
```

- [ ] **Step 2: Write failing test**

`backend/internal/graph/build_test.go`:
```go
package graph

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

// fixtureDB opens an in-memory SQLite, applies schema.sql + a tiny seed, returns it.
func fixtureDB(t *testing.T) *sql.DB {
	t.Helper()
	schema, err := os.ReadFile(filepath.Join("..", "db", "schema.sql"))
	if err != nil {
		t.Fatalf("read schema: %v", err)
	}
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(string(schema)); err != nil {
		t.Fatalf("apply schema: %v", err)
	}
	seed := `
INSERT INTO items (id, category, name_zh, name_en, is_raw) VALUES
  ('iron_ore',   'material',  '铁矿石', 'Iron Ore',   1),
  ('iron_ingot', 'processed', '铁锭',   'Iron Ingot', 0);
INSERT INTO stations (id, name_en) VALUES ('blast_furnace', 'Blast Furnace');
INSERT INTO recipes (id, output_item_id, output_qty, station_id) VALUES
  ('rec_ingot', 'iron_ingot', 1, 'blast_furnace');
INSERT INTO recipe_input_groups (id, recipe_id, group_index, kind) VALUES
  (1, 'rec_ingot', 0, 'all');
INSERT INTO recipe_input_group_items (group_id, item_id, quantity) VALUES
  (1, 'iron_ore', 2);
`
	if _, err := conn.Exec(seed); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return conn
}

func TestBuildReturnsItemsRecipesStations(t *testing.T) {
	conn := fixtureDB(t)
	defer conn.Close()

	g, err := Build(context.Background(), conn)
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Items) != 2 {
		t.Fatalf("want 2 items, got %d", len(g.Items))
	}
	if len(g.Recipes) != 1 {
		t.Fatalf("want 1 recipe, got %d", len(g.Recipes))
	}
	if len(g.Stations) != 1 {
		t.Fatalf("want 1 station, got %d", len(g.Stations))
	}
}

func TestBuildFoldsGroupsCorrectly(t *testing.T) {
	conn := fixtureDB(t)
	defer conn.Close()
	g, err := Build(context.Background(), conn)
	if err != nil {
		t.Fatal(err)
	}
	rec := g.Recipes[0]
	if len(rec.Groups) != 1 {
		t.Fatalf("want 1 group, got %d", len(rec.Groups))
	}
	if rec.Groups[0].Kind != "all" {
		t.Errorf("want kind=all, got %s", rec.Groups[0].Kind)
	}
	if len(rec.Groups[0].Items) != 1 || rec.Groups[0].Items[0].ID != "iron_ore" {
		t.Errorf("group items wrong: %+v", rec.Groups[0].Items)
	}
	if rec.Groups[0].Items[0].Q != 2 {
		t.Errorf("want quantity 2, got %d", rec.Groups[0].Items[0].Q)
	}
}
```

- [ ] **Step 3: Run tests**

```bash
cd backend && go test ./internal/graph/...
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/graph/
git commit -m "feat(backend): add graph builder + tests"
```

### Task 3.5: HTTP handlers and router

**Files:** Create `/Users/ruben/work/private/souldb/backend/internal/api/router.go`, `graph.go`, `items.go`, `search.go`, `api_test.go`.

- [ ] **Step 1: Write router + graph handler**

`backend/internal/api/router.go`:
```go
package api

import (
	"database/sql"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

type Server struct {
	DB     *sql.DB
	DBPath string
	Log    zerolog.Logger
	graph  *graphCache
}

func NewServer(db *sql.DB, dbPath string, log zerolog.Logger) *Server {
	return &Server{DB: db, DBPath: dbPath, Log: log, graph: newGraphCache()}
}

func (s *Server) Router() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(requestLog(s.Log))

	r.Route("/api", func(r chi.Router) {
		r.Get("/graph", s.handleGraph)
		r.Get("/items/{id}", s.handleItem)
		r.Get("/search", s.handleSearch)
	})
	return r
}
```

`backend/internal/api/middleware.go`:
```go
package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

func requestLog(log zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			log.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Int("status", ww.Status()).
				Dur("dur", time.Since(start)).
				Msg("http")
		})
	}
}
```

- [ ] **Step 2: Write graph handler with in-memory cache**

`backend/internal/api/graph.go`:
```go
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	sdb "github.com/rubensayshi/soulmask-codex/backend/internal/db"
	"github.com/rubensayshi/soulmask-codex/backend/internal/graph"
)

type graphCache struct {
	mu       sync.RWMutex
	builtAt  time.Time
	dbMtime  time.Time
	body     []byte
	etag     string
}

func newGraphCache() *graphCache { return &graphCache{} }

func (s *Server) handleGraph(w http.ResponseWriter, r *http.Request) {
	body, etag, err := s.cachedGraph(r.Context())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "application/json")
	if match := r.Header.Get("If-None-Match"); match == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Write(body)
}

func (s *Server) cachedGraph(ctx context.Context) ([]byte, string, error) {
	mtime, err := sdb.Mtime(s.DBPath)
	if err != nil {
		return nil, "", err
	}

	s.graph.mu.RLock()
	if !s.graph.dbMtime.IsZero() && s.graph.dbMtime.Equal(mtime) {
		body, etag := s.graph.body, s.graph.etag
		s.graph.mu.RUnlock()
		return body, etag, nil
	}
	s.graph.mu.RUnlock()

	s.graph.mu.Lock()
	defer s.graph.mu.Unlock()
	if s.graph.dbMtime.Equal(mtime) {
		return s.graph.body, s.graph.etag, nil
	}
	g, err := graph.Build(ctx, s.DB)
	if err != nil {
		return nil, "", err
	}
	body, err := json.Marshal(g)
	if err != nil {
		return nil, "", err
	}
	s.graph.body = body
	s.graph.dbMtime = mtime
	s.graph.etag = fmt.Sprintf("W/\"%d-%d\"", mtime.UnixNano(), len(body))
	s.graph.builtAt = time.Now()
	return body, s.graph.etag, nil
}
```

- [ ] **Step 3: Write item-detail + search handlers**

`backend/internal/api/items.go`:
```go
package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

type ItemDetail struct {
	ID              string      `json:"id"`
	NameEn          *string     `json:"name_en"`
	NameZh          *string     `json:"name_zh"`
	DescriptionZh   *string     `json:"description_zh"`
	Category        *string     `json:"category"`
	Subcategory     *string     `json:"subcategory"`
	Weight          *float64    `json:"weight"`
	MaxStack        *int64      `json:"max_stack"`
	Durability      *int64      `json:"durability"`
	IsRaw           bool        `json:"is_raw"`
	IconPath        *string     `json:"icon_path"`
	Stats           interface{} `json:"stats"`
	TechUnlockedBy  []string    `json:"tech_unlocked_by"`
	RecipesToCraft  []string    `json:"recipes_to_craft"`
	RecipesUsedIn   []string    `json:"recipes_used_in"`
}

func (s *Server) handleItem(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	q := dbgen.New(s.DB)
	ctx := r.Context()

	item, err := q.GetItem(ctx, id)
	if err != nil {
		http.Error(w, "item not found", 404)
		return
	}

	toCraft, _ := q.GetRecipesForOutput(ctx, id)
	usedIn, _ := q.GetRecipesUsingInput(ctx, id)

	toCraftIDs := make([]string, 0, len(toCraft))
	for _, r := range toCraft { toCraftIDs = append(toCraftIDs, r.ID) }
	usedInIDs := make([]string, 0, len(usedIn))
	for _, r := range usedIn { usedInIDs = append(usedInIDs, r.ID) }

	// Tech nodes for any recipe that produces this item
	var tech []string
	for _, r := range toCraft {
		nodes, _ := q.GetTechUnlocksForRecipe(ctx, r.ID)
		for _, n := range nodes { tech = append(tech, n.ID) }
	}

	var stats interface{}
	if item.StatsJson.Valid {
		_ = json.Unmarshal([]byte(item.StatsJson.String), &stats)
	}

	detail := ItemDetail{
		ID:             item.ID,
		NameEn:         nullStr(item.NameEn),
		NameZh:         nullStr(item.NameZh),
		DescriptionZh:  nullStr(item.DescriptionZh),
		Category:       nullStr(item.Category),
		Subcategory:    nullStr(item.Subcategory),
		Weight:         nullFloat(item.Weight),
		MaxStack:       nullInt(item.MaxStack),
		Durability:     nullInt(item.Durability),
		IsRaw:          item.IsRaw != 0,
		IconPath:       nullStr(item.IconPath),
		Stats:          stats,
		TechUnlockedBy: tech,
		RecipesToCraft: toCraftIDs,
		RecipesUsedIn:  usedInIDs,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}
```

`backend/internal/api/search.go`:
```go
package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

type SearchHit struct {
	ID       string  `json:"id"`
	NameEn   *string `json:"name_en"`
	NameZh   *string `json:"name_zh"`
	Category *string `json:"category"`
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, []SearchHit{})
		return
	}
	limit := int64(50)
	if l, err := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 64); err == nil && l > 0 && l <= 200 {
		limit = l
	}

	rows, err := dbgen.New(s.DB).SearchItems(r.Context(), dbgen.SearchItemsParams{Q: q, Lim: limit})
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	hits := make([]SearchHit, 0, len(rows))
	for _, r := range rows {
		hits = append(hits, SearchHit{
			ID: r.ID, NameEn: nullStr(r.NameEn), NameZh: nullStr(r.NameZh),
			Category: nullStr(r.Category),
		})
	}
	writeJSON(w, hits)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func nullStr(n sql.NullString) *string {
	if !n.Valid { return nil }; v := n.String; return &v
}
func nullInt(n sql.NullInt64) *int64 {
	if !n.Valid { return nil }; v := n.Int64; return &v
}
func nullFloat(n sql.NullFloat64) *float64 {
	if !n.Valid { return nil }; v := n.Float64; return &v
}
```

Note: `@q` / `@lim` syntax tells sqlc to generate a `SearchItemsParams{Q string, Lim int64}` struct — matches the handler's call site cleanly.

- [ ] **Step 4: Write API tests**

`backend/internal/api/api_test.go`:
```go
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"database/sql"
	_ "modernc.org/sqlite"

	"github.com/rs/zerolog"
)

func setupServer(t *testing.T) (*Server, func()) {
	t.Helper()
	schema, err := os.ReadFile(filepath.Join("..", "db", "schema.sql"))
	if err != nil { t.Fatal(err) }

	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "test.db")
	conn, err := sql.Open("sqlite", "file:"+dbPath)
	if err != nil { t.Fatal(err) }
	if _, err := conn.Exec(string(schema)); err != nil { t.Fatal(err) }
	seed := `
INSERT INTO items (id, category, name_zh, name_en, is_raw) VALUES
  ('iron_ore','material','铁矿石','Iron Ore',1),
  ('iron_ingot','processed','铁锭','Iron Ingot',0);
INSERT INTO stations (id, name_en) VALUES ('bf','Blast Furnace');
INSERT INTO recipes (id, output_item_id, output_qty, station_id) VALUES
  ('rec_ingot','iron_ingot',1,'bf');
INSERT INTO recipe_input_groups (id, recipe_id, group_index, kind) VALUES (1,'rec_ingot',0,'all');
INSERT INTO recipe_input_group_items (group_id, item_id, quantity) VALUES (1,'iron_ore',2);
`
	if _, err := conn.Exec(seed); err != nil { t.Fatal(err) }

	srv := NewServer(conn, dbPath, zerolog.Nop())
	return srv, func() { conn.Close() }
}

func TestGraphEndpoint(t *testing.T) {
	srv, cleanup := setupServer(t); defer cleanup()
	r := httptest.NewRequest("GET", "/api/graph", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, r)
	if w.Code != 200 { t.Fatalf("status %d: %s", w.Code, w.Body.String()) }
	if !strings.Contains(w.Body.String(), "iron_ore") {
		t.Errorf("response missing item: %s", w.Body.String())
	}
	if w.Header().Get("ETag") == "" { t.Error("no ETag header") }
}

func TestGraphEndpointETagNotModified(t *testing.T) {
	srv, cleanup := setupServer(t); defer cleanup()

	r1 := httptest.NewRequest("GET", "/api/graph", nil)
	w1 := httptest.NewRecorder()
	srv.Router().ServeHTTP(w1, r1)
	etag := w1.Header().Get("ETag")

	r2 := httptest.NewRequest("GET", "/api/graph", nil)
	r2.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()
	srv.Router().ServeHTTP(w2, r2)
	if w2.Code != http.StatusNotModified { t.Errorf("want 304, got %d", w2.Code) }
}

func TestItemEndpoint(t *testing.T) {
	srv, cleanup := setupServer(t); defer cleanup()
	r := httptest.NewRequest("GET", "/api/items/iron_ingot", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, r)
	if w.Code != 200 { t.Fatalf("status %d", w.Code) }
	var d map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &d); err != nil { t.Fatal(err) }
	if d["id"] != "iron_ingot" { t.Errorf("wrong id: %v", d["id"]) }
}

func TestSearchEndpoint(t *testing.T) {
	srv, cleanup := setupServer(t); defer cleanup()
	r := httptest.NewRequest("GET", "/api/search?q=iron", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, r)
	if w.Code != 200 { t.Fatalf("status %d", w.Code) }
	if !strings.Contains(w.Body.String(), "Iron Ore") {
		t.Errorf("missing Iron Ore: %s", w.Body.String())
	}
}
```

- [ ] **Step 5: Run tests**

```bash
cd backend && go test ./internal/api/...
```
Expected: PASS. If sqlc param names cause compile errors, adjust `api/search.go` to match generated signatures.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/api/ backend/internal/db/gen/
git commit -m "feat(backend): add /api/graph /api/items /api/search handlers + tests"
```

### Task 3.6: SPA embed + dev-mode proxy

**Files:** Create `/Users/ruben/work/private/souldb/backend/internal/spa/embed.go`.

- [ ] **Step 1: Write the embed + proxy handler**

```go
// Package spa serves the React SPA. Prod: serves from embedded dist/.
// Dev: reverse-proxies to Vite at localhost:5173.
package spa

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

//go:embed dist/*
var distFS embed.FS

// ProdHandler serves embedded dist/; any path missing from dist/ returns index.html.
func ProdHandler() (http.Handler, error) {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return nil, err
	}
	fileServer := http.FileServer(http.FS(sub))
	index, err := fs.ReadFile(sub, "index.html")
	if err != nil {
		// dist/ may be empty during early scaffolding; serve a stub.
		index = []byte("<!doctype html><title>Soulmask</title><p>SPA not built yet.</p>")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// /api/* is handled by chi elsewhere; assume this handler gets called
		// only for non-api paths. Try fileserver first; fall back to index.
		if strings.HasSuffix(r.URL.Path, "/") || !strings.Contains(r.URL.Path[1:], ".") {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(index)
			return
		}
		fileServer.ServeHTTP(w, r)
	}), nil
}

// DevHandler reverse-proxies to Vite.
func DevHandler(target string) (http.Handler, error) {
	u, err := url.Parse(target)
	if err != nil {
		return nil, err
	}
	proxy := httputil.NewSingleHostReverseProxy(u)
	proxy.ModifyResponse = func(resp *http.Response) error { return nil }
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
		_ = io.Discard
	}), nil
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/internal/spa/
git commit -m "feat(backend): add SPA embed + dev-mode reverse proxy"
```

### Task 3.7: Wire `main.go`

**Files:** Create `/Users/ruben/work/private/souldb/backend/cmd/server/main.go`.

- [ ] **Step 1: Write main**

```go
package main

import (
	"context"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/rubensayshi/soulmask-codex/backend/internal/api"
	sdb "github.com/rubensayshi/soulmask-codex/backend/internal/db"
	"github.com/rubensayshi/soulmask-codex/backend/internal/spa"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dbPath := flag.String("db", "../data/app.db", "path to app.db")
	dev := flag.Bool("dev", false, "reverse-proxy non-api to Vite on :5173")
	flag.Parse()

	log := zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).
		With().Timestamp().Logger()

	db, err := sdb.Open(*dbPath)
	if err != nil {
		log.Fatal().Err(err).Str("path", *dbPath).Msg("open db")
	}
	defer db.Close()
	log.Info().Str("db", *dbPath).Msg("db opened")

	apiServer := api.NewServer(db, *dbPath, log)

	var spaHandler http.Handler
	if *dev {
		spaHandler, err = spa.DevHandler("http://localhost:5173")
	} else {
		spaHandler, err = spa.ProdHandler()
	}
	if err != nil {
		log.Fatal().Err(err).Msg("spa handler")
	}

	root := chi.NewRouter()
	root.Mount("/api", apiServer.Router())
	root.Handle("/*", spaHandler)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           root,
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		log.Info().Str("addr", *addr).Bool("dev", *dev).Msg("listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("serve")
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Info().Msg("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
```

Note the `api.NewServer(...).Router()` call returns a `chi.Router` that's mounted under `/api`. The router inside `api/router.go` registers routes under `/api/...` — mounting it under `/api` double-prefixes. Fix: change `router.go` to register at root paths (`/graph`, `/items/:id`, `/search`) and let `main.go`'s `root.Mount("/api", ...)` add the prefix.

Edit `backend/internal/api/router.go`:
```go
func (s *Server) Router() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(requestLog(s.Log))

	r.Get("/graph", s.handleGraph)
	r.Get("/items/{id}", s.handleItem)
	r.Get("/search", s.handleSearch)
	return r
}
```

And update the tests in `api_test.go` to hit `/graph`, `/items/...`, `/search` instead of `/api/...`.

- [ ] **Step 2: Run end-to-end**

```bash
make db
cd backend && go run ./cmd/server -dev -db ../data/app.db
```

In another terminal:
```bash
curl -s http://localhost:8080/api/graph | head -c 200
curl -s http://localhost:8080/api/items/Daoju_Item_Wood | head -c 200
curl -s 'http://localhost:8080/api/search?q=iron' | head -c 200
```
Expected: real JSON data from the 2015-item database.

- [ ] **Step 3: Commit**

```bash
git add backend/
git commit -m "feat(backend): wire main.go; end-to-end API working against real db"
```

---

## Phase 4: Frontend scaffolding

Goal: `cd web && pnpm dev` serves a blank page at `localhost:5173` that loads the graph from `/api/graph` and prints "loaded N items" in dev.

### Task 4.1: Init Vite + TypeScript + Tailwind

**Files:** Create `/Users/ruben/work/private/souldb/web/*`.

- [ ] **Step 1: Init Vite**

```bash
cd web
pnpm create vite . --template react-ts
pnpm install
pnpm add react-router-dom zustand
pnpm add -D tailwindcss postcss autoprefixer vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind theme**

Replace `web/tailwind.config.ts` with:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:            '#080808',
        surface:       '#0d0d0d',
        panel:         '#111111',
        card:          '#171712',
        'card-hover':  '#1f1f18',
        border:        '#272518',
        'border-lit':  '#3e3c28',
        gold:          '#b89840',
        'gold-dim':    '#6a5820',
        'gold-glow':   'rgba(184,152,64,.12)',
        text:          '#c8c0a0',
        'text-muted':  '#706858',
        'text-dim':    '#3e3828',
        raw:           '#6aaa44',
        'raw-bg':      '#0b160a',
        'raw-border':  '#1e3818',
        jade:          '#44a08a',
        'jade-bg':     '#091410',
        'jade-border': '#1a3828',
        or:            '#9080cc',
        'or-bg':       '#0e0c1c',
        'or-border':   '#302858',
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        sans:    ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        wider2:  '.12em',
        widest2: '.16em',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 3: Configure Vite proxy**

Replace `web/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Write globals.css**

Create `web/src/styles/globals.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
html, body, #root { height: 100%; }
body {
  @apply bg-bg text-text font-sans antialiased;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(184,152,64,.025) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(68,160,138,.02) 0%, transparent 50%);
}
body > * { position: relative; z-index: 1; }

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { @apply bg-border; }
```

Create `web/src/styles/components.css`:
```css
@tailwind components;

/* Diamond shape: wrapper rotates 45deg, child counter-rotates. */
@layer components {
  .diamond {
    @apply flex items-center justify-center overflow-hidden;
    transform: rotate(45deg);
  }
  .diamond-inner {
    @apply flex items-center justify-center overflow-hidden;
    transform: rotate(-45deg);
  }
  /* L-shaped connector used in FlowView branches */
  .flow-branch::before {
    content: '';
    @apply absolute left-0 w-px bg-gold-dim;
    top: 30px;
    bottom: 30px;
  }
  .flow-branch-item::before {
    content: '';
    @apply absolute left-0 top-1/2 w-[14px] h-px bg-gold-dim;
  }
  .flow-branch.jade::before { @apply bg-jade-border; }
  .flow-branch-item.jade::before { @apply bg-jade-border; }
}
```

- [ ] **Step 5: Main entry + types**

Replace `web/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'
import './styles/components.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

Create `web/src/lib/types.ts`:
```ts
export interface Graph {
  items: Item[]
  recipes: Recipe[]
  stations: Station[]
}

export interface Item {
  id: string
  n: string | null           // name_en
  nz: string | null          // name_zh
  cat: string | null
  raw: boolean
  ic?: string | null
}

export interface Recipe {
  id: string
  out: string
  outQ: number
  st?: string | null
  t?: number | null
  prof?: string | null
  groups: Group[]
}

export interface Group {
  kind: 'all' | 'one_of'
  items: { id: string; q: number }[]
}

export interface Station {
  id: string
  n: string | null
}
```

Create `web/src/lib/api.ts`:
```ts
import type { Graph } from './types'

export async function fetchGraph(etag: string | null): Promise<
  { status: 'notModified' } | { status: 'loaded'; graph: Graph; etag: string }
> {
  const headers: Record<string, string> = {}
  if (etag) headers['If-None-Match'] = etag
  const res = await fetch('/api/graph', { headers })
  if (res.status === 304) return { status: 'notModified' }
  if (!res.ok) throw new Error(`graph: ${res.status}`)
  const newEtag = res.headers.get('ETag') || ''
  const graph = (await res.json()) as Graph
  return { status: 'loaded', graph, etag: newEtag }
}

export interface SearchHit {
  id: string
  name_en: string | null
  name_zh: string | null
  category: string | null
}

export async function search(q: string, limit = 50): Promise<SearchHit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  if (!res.ok) throw new Error(`search: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 6: Zustand store**

Create `web/src/store/index.ts`:
```ts
import { create } from 'zustand'
import { fetchGraph } from '../lib/api'
import type { Graph } from '../lib/types'

const GRAPH_CACHE_KEY = 'soulmask:graph'
const ETAG_CACHE_KEY  = 'soulmask:etag'
const VISITS_KEY      = 'soulmask:visits'

interface Store {
  graph: Graph | null
  graphStatus: 'idle' | 'loading' | 'ready' | 'error'
  graphEtag: string | null
  loadGraph: () => Promise<void>

  recentVisits: string[]
  pushVisit: (id: string) => void
  clearVisits: () => void

  orSel: Record<string, number>
  setOrSel: (key: string, idx: number) => void
  resetOrSel: () => void

  quantity: number
  setQuantity: (n: number) => void
}

function loadCachedGraph(): { graph: Graph | null; etag: string | null } {
  try {
    const raw  = sessionStorage.getItem(GRAPH_CACHE_KEY)
    const etag = sessionStorage.getItem(ETAG_CACHE_KEY)
    return { graph: raw ? JSON.parse(raw) : null, etag }
  } catch {
    return { graph: null, etag: null }
  }
}

function loadVisits(): string[] {
  try { return JSON.parse(sessionStorage.getItem(VISITS_KEY) || '[]') } catch { return [] }
}

export const useStore = create<Store>((set, get) => {
  const cached = loadCachedGraph()
  return {
    graph: cached.graph,
    graphStatus: cached.graph ? 'ready' : 'idle',
    graphEtag: cached.etag,
    async loadGraph() {
      set({ graphStatus: 'loading' })
      try {
        const result = await fetchGraph(get().graphEtag)
        if (result.status === 'notModified') {
          set({ graphStatus: 'ready' })
        } else {
          sessionStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify(result.graph))
          sessionStorage.setItem(ETAG_CACHE_KEY, result.etag)
          set({ graph: result.graph, graphEtag: result.etag, graphStatus: 'ready' })
        }
      } catch (e) {
        set({ graphStatus: 'error' })
      }
    },

    recentVisits: loadVisits(),
    pushVisit(id) {
      const curr = get().recentVisits.filter(v => v !== id)
      const next = [id, ...curr].slice(0, 20)
      sessionStorage.setItem(VISITS_KEY, JSON.stringify(next))
      set({ recentVisits: next })
    },
    clearVisits() {
      sessionStorage.removeItem(VISITS_KEY)
      set({ recentVisits: [] })
    },

    orSel: {},
    setOrSel(key, idx) { set(s => ({ orSel: { ...s.orSel, [key]: idx } })) },
    resetOrSel() { set({ orSel: {} }) },

    quantity: 1,
    setQuantity(n) { set({ quantity: Math.max(1, Math.min(99, n)) }) },
  }
})
```

- [ ] **Step 7: App shell + routes**

Replace `web/src/App.tsx`:
```tsx
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import Home from './pages/Home'
import Item from './pages/Item'

export default function App() {
  const loadGraph = useStore(s => s.loadGraph)
  useEffect(() => { loadGraph() }, [loadGraph])
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/item/:id" element={<Item />} />
    </Routes>
  )
}
```

Create `web/src/pages/Home.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { useStore } from '../store'

export default function Home() {
  const graph = useStore(s => s.graph)
  const status = useStore(s => s.graphStatus)
  if (status === 'loading' || !graph) return <div className="p-8">Loading…</div>
  return (
    <div className="p-8 space-y-4">
      <h1 className="font-display text-2xl text-gold">Soulmask · Recipe Tree</h1>
      <p className="text-text-muted">
        Loaded {graph.items.length} items, {graph.recipes.length} recipes.
      </p>
      <p>
        <Link className="text-gold underline" to="/item/Daoju_Item_Wood">
          Try an item →
        </Link>
      </p>
    </div>
  )
}
```

Create `web/src/pages/Item.tsx` (stub — filled in later phases):
```tsx
import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from '../store'

export default function Item() {
  const { id } = useParams<{ id: string }>()
  const pushVisit = useStore(s => s.pushVisit)
  const resetOrSel = useStore(s => s.resetOrSel)
  const graph = useStore(s => s.graph)

  useEffect(() => { if (id) { pushVisit(id); resetOrSel() } }, [id, pushVisit, resetOrSel])

  if (!graph) return <div className="p-8">Loading…</div>
  const item = graph.items.find(i => i.id === id)
  if (!item) return <div className="p-8">Item not found: {id}</div>

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl text-gold">{item.n ?? item.nz ?? item.id}</h1>
      <p className="text-text-muted">Category: {item.cat ?? '—'}</p>
    </div>
  )
}
```

- [ ] **Step 8: Verify end-to-end**

In separate terminals:
```bash
cd backend && go run ./cmd/server -dev -db ../data/app.db
cd web && pnpm dev
```
Open `http://localhost:5173`. Expected: "Loaded 2015 items, 1109 recipes." Clicking the link navigates to `/item/Daoju_Item_Wood` and shows its category.

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold vite + tailwind + zustand + router; loads /api/graph"
```

---

## Phase 5: Item header + Tree view

Goal: the Item page renders the prototype's item header and the ingredient tree with correct quantities and raw-mats rollup.

### Task 5.1: Graph helpers (pure functions) with tests

**Files:** Create `/Users/ruben/work/private/souldb/web/src/lib/graph.ts` and `/Users/ruben/work/private/souldb/web/src/lib/graph.test.ts`.

- [ ] **Step 1: Write helpers**

```ts
import type { Graph, Item, Recipe } from './types'

export function indexItems(g: Graph): Map<string, Item> {
  return new Map(g.items.map(i => [i.id, i]))
}

/** Primary recipe that produces this item.
 *  Real data has `_Split` variants (e.g. BP_PeiFang_PiGe_2_Split) that decompose
 *  higher-tier items back into lower-tier ones — those break chains, so we skip them. */
export function primaryRecipeFor(g: Graph, itemId: string): Recipe | undefined {
  const matches = g.recipes.filter(r => r.out === itemId)
  return matches.find(r => !r.id.includes('_Split')) ?? matches[0]
}

/** Index: item_id → ids of recipes that consume it as an ingredient. */
export function buildUsedInIndex(g: Graph): Map<string, string[]> {
  const idx = new Map<string, string[]>()
  for (const r of g.recipes) {
    for (const grp of r.groups) {
      for (const it of grp.items) {
        const list = idx.get(it.id) ?? []
        list.push(r.id)
        idx.set(it.id, list)
      }
    }
  }
  return idx
}

/** How much of `src` a given recipe needs. Returns null if not an input. */
export function qtyNeeded(r: Recipe, src: string): number | null {
  for (const grp of r.groups) {
    for (const it of grp.items) {
      if (it.id === src) return it.q
    }
  }
  return null
}

export interface RawMats { [itemId: string]: number }

/**
 * Aggregate raw-material requirement for producing `qty` of `itemId`.
 * Respects `orSel` — each 'one_of' group keys on `recipeId:groupIndex` → alternative index.
 */
export function computeRawMats(
  g: Graph,
  itemId: string,
  qty: number,
  orSel: Record<string, number> = {},
): RawMats {
  const byId = indexItems(g)
  const out: RawMats = {}
  function walk(id: string, n: number) {
    const item = byId.get(id)
    if (!item) return
    if (item.raw) {
      out[id] = (out[id] || 0) + n
      return
    }
    const recipe = primaryRecipeFor(g, id)
    if (!recipe) {
      out[id] = (out[id] || 0) + n
      return
    }
    recipe.groups.forEach((grp, gi) => {
      if (grp.kind === 'all') {
        for (const ing of grp.items) walk(ing.id, ing.q * n)
      } else {
        const key = `${recipe.id}:${gi}`
        const chosen = orSel[key] ?? 0
        const alt = grp.items[chosen] ?? grp.items[0]
        if (alt) walk(alt.id, alt.q * n)
      }
    })
  }
  walk(itemId, qty)
  return out
}
```

- [ ] **Step 2: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeRawMats, buildUsedInIndex, qtyNeeded, primaryRecipeFor } from './graph'
import type { Graph } from './types'

function makeGraph(): Graph {
  return {
    items: [
      { id: 'ore',    n: 'Ore',    nz: null, cat: 'raw', raw: true },
      { id: 'wood',   n: 'Wood',   nz: null, cat: 'raw', raw: true },
      { id: 'ingot',  n: 'Ingot',  nz: null, cat: null,  raw: false },
      { id: 'pickaxe',n: 'Pickaxe',nz: null, cat: null,  raw: false },
    ],
    recipes: [
      { id: 'r_ingot', out: 'ingot', outQ: 1, groups: [
        { kind: 'all', items: [{ id: 'ore', q: 2 }] }
      ]},
      { id: 'r_pick',  out: 'pickaxe', outQ: 1, groups: [
        { kind: 'all', items: [{ id: 'ingot', q: 3 }, { id: 'wood', q: 2 }] }
      ]},
    ],
    stations: [],
  }
}

describe('computeRawMats', () => {
  it('sums transitive raw inputs', () => {
    const g = makeGraph()
    const mats = computeRawMats(g, 'pickaxe', 1)
    expect(mats).toEqual({ ore: 6, wood: 2 })
  })
  it('scales by qty', () => {
    const mats = computeRawMats(makeGraph(), 'pickaxe', 3)
    expect(mats).toEqual({ ore: 18, wood: 6 })
  })
  it('handles one_of groups using orSel', () => {
    const g = makeGraph()
    g.recipes[0].groups = [
      { kind: 'all', items: [{ id: 'wood', q: 1 }] },
      { kind: 'one_of', items: [{ id: 'ore', q: 2 }, { id: 'wood', q: 5 }] },
    ]
    expect(computeRawMats(g, 'ingot', 1)).toEqual({ wood: 1, ore: 2 })
    expect(computeRawMats(g, 'ingot', 1, { 'r_ingot:1': 1 })).toEqual({ wood: 6 })
  })
})

describe('buildUsedInIndex', () => {
  it('indexes all consuming recipes per item', () => {
    const idx = buildUsedInIndex(makeGraph())
    expect(idx.get('ore')).toEqual(['r_ingot'])
    expect(idx.get('ingot')).toEqual(['r_pick'])
    expect(idx.get('wood')).toEqual(['r_pick'])
  })
})

describe('qtyNeeded', () => {
  it('finds quantity by input id', () => {
    const g = makeGraph()
    expect(qtyNeeded(g.recipes[1], 'ingot')).toBe(3)
    expect(qtyNeeded(g.recipes[1], 'ore')).toBe(null)
  })
})

describe('primaryRecipeFor', () => {
  it('returns the first recipe with matching output', () => {
    expect(primaryRecipeFor(makeGraph(), 'ingot')?.id).toBe('r_ingot')
    expect(primaryRecipeFor(makeGraph(), 'ore')).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd web && pnpm test -- --run src/lib/graph.test.ts
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/graph.ts web/src/lib/graph.test.ts
git commit -m "feat(web): add graph helpers (computeRawMats, buildUsedInIndex) with tests"
```

### Task 5.2: Icon + Diamond primitives

**Files:** Create `/Users/ruben/work/private/souldb/web/src/components/Icon.tsx` and `Diamond.tsx`.

- [ ] **Step 1: Icon component**

```tsx
import { useState } from 'react'
import type { Item } from '../lib/types'

const CDN = 'https://www.soulmaskdatabase.com/images/'

function initials(name: string | null | undefined): string {
  if (!name) return '??'
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  item: Item | undefined
  size?: number
  className?: string
}

export default function Icon({ item, size = 28, className = '' }: Props) {
  const [err, setErr] = useState(false)
  if (!item) return null

  const classes = [
    'flex items-center justify-center overflow-hidden border text-xs font-semibold',
    item.raw
      ? 'bg-raw-bg border-raw-border text-raw'
      : 'bg-card border-border text-text-muted',
    className,
  ].join(' ')

  const style = { width: size, height: size }
  const label = item.n ?? item.nz ?? item.id
  const hasImg = item.ic && !err

  return (
    <div className={classes} style={style}>
      {hasImg ? (
        <img
          src={CDN + (item.ic as string)}
          alt={label}
          className="w-full h-full object-cover"
          onError={() => setErr(true)}
        />
      ) : (
        initials(label)
      )}
    </div>
  )
}
```

- [ ] **Step 2: Diamond component**

```tsx
import type { ReactNode } from 'react'
import type { Item } from '../lib/types'
import { useState } from 'react'

const CDN = 'https://www.soulmaskdatabase.com/images/'

interface Props {
  item: Item | undefined
  size?: number
  variant?: 'default' | 'root' | 'raw' | 'jade'
  onClick?: () => void
  children?: ReactNode
}

export default function Diamond({ item, size = 42, variant = 'default', onClick }: Props) {
  const [err, setErr] = useState(false)
  if (!item) return null
  const label = item.n ?? item.nz ?? item.id
  const hasImg = item.ic && !err

  const border = {
    default: 'border-border-lit',
    root:    'border-gold border-[1.5px]',
    raw:     'border-raw-border',
    jade:    'border-jade-border',
  }[variant]
  const bg = {
    default: 'bg-card hover:bg-card-hover',
    root:    'bg-card-hover',
    raw:     'bg-raw-bg',
    jade:    'bg-jade-bg',
  }[variant]
  const hover = variant === 'raw' ? '' : 'hover:border-gold'
  const cursor = onClick ? 'cursor-pointer' : ''

  return (
    <div
      className={`diamond border ${border} ${bg} ${hover} ${cursor} transition-colors`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <div className="diamond-inner" style={{ width: size, height: size }}>
        {hasImg ? (
          <img
            src={CDN + (item.ic as string)}
            alt={label}
            style={{ width: size * 0.7, height: size * 0.7 }}
            className="object-cover"
            onError={() => setErr(true)}
          />
        ) : (
          <span style={{ fontSize: size * 0.24 }} className="font-semibold text-text-muted">
            {initials(label)}
          </span>
        )}
      </div>
    </div>
  )
}

function initials(s: string): string {
  return s.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Icon.tsx web/src/components/Diamond.tsx
git commit -m "feat(web): add Icon and Diamond primitives"
```

### Task 5.3: Layout shell + topnav

**Files:** Create `/Users/ruben/work/private/souldb/web/src/components/Layout.tsx` and `TopNav.tsx`.

- [ ] **Step 1: TopNav with view toggle**

`web/src/components/TopNav.tsx`:
```tsx
import { useSearchParams, Link } from 'react-router-dom'

export default function TopNav() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'tree' ? 'tree' : 'flow'
  const setView = (v: 'tree' | 'flow') => {
    const next = new URLSearchParams(params)
    if (v === 'flow') next.delete('view')
    else next.set('view', v)
    setParams(next, { replace: true })
  }
  return (
    <div className="flex items-center gap-3 h-12 px-5 bg-surface border-b border-border flex-shrink-0">
      <Link to="/" className="flex items-center gap-2 font-display text-sm font-bold tracking-wider2 text-gold">
        <div className="diamond border-[1.5px] border-gold w-[22px] h-[22px]">
          <div className="diamond-inner text-[10px] text-gold">◈</div>
        </div>
        Soulmask
      </Link>
      <div className="w-px h-4 bg-border" />
      <span className="text-[10px] text-text-dim tracking-widest2 uppercase">Codex · Recipe Tree</span>
      <div className="flex-1" />
      <div className="flex border border-border overflow-hidden">
        <button
          className={`px-4 py-1 text-[10px] tracking-wider2 uppercase font-semibold border-r border-border ${
            view === 'tree' ? 'bg-card text-gold' : 'text-text-dim hover:text-text-muted'
          }`}
          onClick={() => setView('tree')}
        >Tree</button>
        <button
          className={`px-4 py-1 text-[10px] tracking-wider2 uppercase font-semibold ${
            view === 'flow' ? 'bg-card text-gold' : 'text-text-dim hover:text-text-muted'
          }`}
          onClick={() => setView('flow')}
        >Flow</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Layout with sidebar placeholder**

`web/src/components/Layout.tsx`:
```tsx
import type { ReactNode } from 'react'
import TopNav from './TopNav'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-6 py-5">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Sidebar stub (history only, search added Phase 8)**

`web/src/components/Sidebar.tsx`:
```tsx
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store'
import Icon from './Icon'

export default function Sidebar() {
  const { id: currentId } = useParams<{ id: string }>()
  const visits = useStore(s => s.recentVisits)
  const graph  = useStore(s => s.graph)
  if (!graph) return <aside className="w-[234px] flex-shrink-0 border-r border-border bg-surface" />

  const byId = new Map(graph.items.map(i => [i.id, i]))

  return (
    <aside className="w-[234px] flex-shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="px-3 pt-2 pb-1 text-[9px] tracking-widest2 uppercase text-text-dim font-semibold">
        Recent
      </div>
      <div className="flex-1 overflow-y-auto pb-2">
        {visits.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-text-dim">
            Nothing yet. Click an item to begin.
          </div>
        )}
        {visits.map(id => {
          const it = byId.get(id)
          const active = id === currentId
          return (
            <Link
              key={id}
              to={`/item/${id}`}
              className={`flex items-center gap-2 px-3 py-1.5 border-l-2 ${
                active
                  ? 'bg-gold-glow border-gold'
                  : 'border-transparent hover:bg-card'
              }`}
            >
              <Icon item={it} size={22} />
              <div>
                <div className="text-xs text-text">{it?.n ?? it?.nz ?? id}</div>
                {it?.cat && <div className="text-[10px] text-text-muted">{it.cat}</div>}
              </div>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Mount Layout in App.tsx**

Replace `web/src/App.tsx`:
```tsx
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import Home from './pages/Home'
import Item from './pages/Item'

export default function App() {
  const loadGraph = useStore(s => s.loadGraph)
  useEffect(() => { loadGraph() }, [loadGraph])
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/item/:id" element={<Item />} />
      </Routes>
    </Layout>
  )
}
```

- [ ] **Step 5: Visual smoke test**

Start both servers; navigate to a couple of items; verify the layout chrome is stable and the sidebar fills with your recent items. No functional test needed beyond this at this point.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Layout.tsx web/src/components/TopNav.tsx web/src/components/Sidebar.tsx web/src/App.tsx
git commit -m "feat(web): layout shell with topnav + recent-items sidebar"
```

### Task 5.4: ItemHeader + QtyControl

**Files:** Create `/Users/ruben/work/private/souldb/web/src/components/ItemHeader.tsx` and `QtyControl.tsx`.

- [ ] **Step 1: ItemHeader**

```tsx
import type { Item, Recipe, Station } from '../lib/types'
import Diamond from './Diamond'

interface Props {
  item: Item
  recipe?: Recipe
  station?: Station
}

export default function ItemHeader({ item, recipe, station }: Props) {
  const title = item.n ?? item.nz ?? item.id
  const subtitle = item.raw ? 'Raw Material' : (station?.n ?? 'Crafted Item')
  return (
    <div className="flex items-start gap-4 p-5 mb-5 bg-panel border border-border-lit border-t-[2px] border-t-gold-dim">
      <div className="flex-shrink-0 flex flex-col items-center gap-2">
        <Diamond item={item} size={58} variant={item.ic ? 'root' : 'default'} />
      </div>
      <div className="flex-1">
        <div className="font-display text-lg font-semibold text-text mb-1 tracking-wide">{title}</div>
        <div className="text-[10px] text-text-muted tracking-wider2 uppercase mb-2">{subtitle}</div>
        <div className="flex flex-wrap gap-1">
          {item.raw && (
            <span className="inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-medium border border-raw-border text-raw bg-raw-bg">
              Gathered
            </span>
          )}
          {station?.n && (
            <span className="inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-medium border border-gold-dim text-gold bg-card">
              {station.n}
            </span>
          )}
          {recipe?.t != null && (
            <span className="inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-medium border border-border text-text-muted bg-card">
              ⏱ {recipe.t}s
            </span>
          )}
          {recipe?.prof && (
            <span className="inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-medium border border-border text-text-muted bg-card">
              {recipe.prof}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: QtyControl**

```tsx
import { useStore } from '../store'

export default function QtyControl() {
  const qty = useStore(s => s.quantity)
  const set = useStore(s => s.setQuantity)
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[9px] text-text-dim tracking-wider2 uppercase font-semibold">Quantity</span>
      <div className="flex items-center border border-border overflow-hidden">
        <button
          className="w-7 h-7 flex items-center justify-center text-text-muted hover:bg-card hover:text-gold"
          onClick={() => set(qty - 1)}
        >−</button>
        <div className="px-3 text-sm font-semibold text-text border-l border-r border-border min-w-[38px] text-center leading-7 tabular-nums">
          {qty}
        </div>
        <button
          className="w-7 h-7 flex items-center justify-center text-text-muted hover:bg-card hover:text-gold"
          onClick={() => set(qty + 1)}
        >+</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ItemHeader.tsx web/src/components/QtyControl.tsx
git commit -m "feat(web): item header and qty control"
```

### Task 5.5: TreeView + RawMatsCollapsible

**Files:** Create `/Users/ruben/work/private/souldb/web/src/components/TreeView.tsx` and `RawMats.tsx`.

- [ ] **Step 1: TreeView**

```tsx
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Graph, Recipe } from '../lib/types'
import { primaryRecipeFor, indexItems } from '../lib/graph'
import Icon from './Icon'
import { useStore } from '../store'

interface Props {
  graph: Graph
  rootId: string
}

export default function TreeView({ graph, rootId }: Props) {
  const byId = useMemo(() => indexItems(graph), [graph])
  const quantity = useStore(s => s.quantity)
  const orSel    = useStore(s => s.orSel)
  const setOrSel = useStore(s => s.setOrSel)

  const recipe = primaryRecipeFor(graph, rootId)
  if (!recipe) return <div className="h-16 flex items-center justify-center text-[11px] text-text-dim">Raw material — gathered, not crafted</div>

  return (
    <div className="mb-5">
      {recipe.groups.map((grp, gi) => {
        if (grp.kind === 'all') {
          return grp.items.map(ing => (
            <TreeNode key={`${gi}-${ing.id}`} graph={graph} id={ing.id} qty={ing.q * quantity} byId={byId} />
          ))
        }
        const orKey = `${recipe.id}:${gi}`
        const chosen = orSel[orKey] ?? 0
        return (
          <div key={gi} className="ml-2 mb-1 p-2 bg-or-bg border border-or-border">
            <div className="text-[8px] tracking-wider2 uppercase text-or mb-1 font-semibold flex items-center gap-2">
              Choose one
              <span className="flex-1 h-px bg-or-border" />
            </div>
            {grp.items.map((alt, ai) => {
              const item = byId.get(alt.id)
              const active = chosen === ai
              return (
                <div
                  key={alt.id}
                  className={`flex items-center gap-2 px-1.5 py-1 border transition-colors cursor-pointer my-0.5 ${
                    active ? 'bg-[rgba(144,128,204,.14)] border-or' : 'border-transparent hover:bg-[rgba(144,128,204,.1)] hover:border-or-border'
                  }`}
                  onClick={() => setOrSel(orKey, ai)}
                >
                  <Icon item={item} size={22} />
                  <span className="text-xs text-text flex-1">{item?.n ?? item?.nz ?? alt.id}</span>
                  <span className="text-[10px] font-semibold text-or">×{alt.q * quantity}</span>
                </div>
              )
            })}
            {/* Expand chosen alt's sub-recipe */}
            {(() => {
              const picked = grp.items[chosen] ?? grp.items[0]
              const subItem = byId.get(picked.id)
              if (!subItem || subItem.raw) return null
              return (
                <div className="ml-2 mt-1 pl-4 border-l border-or-border">
                  <TreeNode graph={graph} id={picked.id} qty={picked.q * quantity} byId={byId} />
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}

interface NodeProps {
  graph: Graph
  id: string
  qty: number
  byId: Map<string, import('../lib/types').Item>
}

function TreeNode({ graph, id, qty, byId }: NodeProps) {
  const item = byId.get(id)
  const recipe = item && !item.raw ? primaryRecipeFor(graph, id) : undefined
  const hasKids = !!recipe && recipe.groups.some(g => g.items.length > 0)
  const [expanded, setExpanded] = useState(hasKids)
  const stationName = useMemo(() => {
    const st = graph.stations.find(s => s.id === (recipe?.st ?? ''))
    return st?.n ?? null
  }, [graph, recipe])

  if (!item) return null

  return (
    <div>
      <div
        className={`group flex items-center gap-2 px-2 py-1.5 my-px ${hasKids ? 'cursor-pointer' : 'cursor-default'} hover:bg-card`}
        onClick={() => hasKids && setExpanded(v => !v)}
      >
        <span className="w-3 text-[9px] text-text-dim text-center">
          {hasKids ? (expanded ? '▾' : '▸') : ''}
        </span>
        <Icon item={item} size={26} />
        <span className="text-sm text-text flex-1">{item.n ?? item.nz ?? item.id}</span>
        {item.raw && <span className="w-1.5 h-1.5 rotate-45 bg-raw" />}
        {stationName && (
          <span className="text-[9px] text-text-dim px-1 py-px bg-panel">{stationName}</span>
        )}
        <span className="text-xs font-semibold text-gold tabular-nums min-w-[28px] text-right">×{qty}</span>
        {!item.raw && (
          <Link
            to={`/item/${item.id}`}
            onClick={e => e.stopPropagation()}
            className="w-[18px] h-[18px] flex items-center justify-center bg-card text-gold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          >→</Link>
        )}
      </div>
      {expanded && recipe && (
        <div className="relative pl-4 ml-4 border-l border-gold-dim">
          {recipe.groups.map((grp, gi) =>
            grp.items.map(ing => (
              <TreeNode key={`${gi}-${ing.id}`} graph={graph} id={ing.id} qty={ing.q * qty} byId={byId} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

Note: the nested `TreeNode` intentionally does not handle OR groups — only the root-level group renders `one_of`. A future pass extends `TreeNode` to handle nested OR if the data ever produces deep OR chains; for now real data only has top-level OR (when it exists).

- [ ] **Step 2: RawMatsCollapsible**

```tsx
import { useMemo, useState } from 'react'
import type { Graph } from '../lib/types'
import { computeRawMats } from '../lib/graph'
import { useStore } from '../store'
import { Link } from 'react-router-dom'

interface Props { graph: Graph; rootId: string }

export default function RawMatsCollapsible({ graph, rootId }: Props) {
  const quantity = useStore(s => s.quantity)
  const orSel    = useStore(s => s.orSel)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const mats = useMemo(
    () => computeRawMats(graph, rootId, quantity, orSel),
    [graph, rootId, quantity, orSel]
  )
  const byId = useMemo(() => new Map(graph.items.map(i => [i.id, i])), [graph])
  const entries = Object.entries(mats).sort((a, b) => b[1] - a[1])
  if (!entries.length) return null

  return (
    <div className="mb-5 border border-border">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-card select-none"
           onClick={() => setOpen(o => !o)}>
        <div className={`w-[7px] h-[7px] rotate-45 border border-raw-border ${open ? 'bg-raw' : 'bg-transparent'}`} />
        <span className="flex-1 text-[9px] tracking-wider2 uppercase text-text-muted font-semibold">Total Raw Materials</span>
        <span className="text-[9px] text-text-dim">{open ? '▴' : '▾'} {entries.length}</span>
      </div>
      {open && (
        <div className="border-t border-border p-1">
          {entries.map(([id, qty]) => {
            const it = byId.get(id)
            return (
              <Link key={id} to={`/item/${id}`} className="flex items-center gap-2 px-2 py-1 hover:bg-card">
                <div className="w-6 h-6 bg-raw-bg border border-raw-border flex items-center justify-center text-[8px] font-semibold text-raw">
                  {(it?.n ?? it?.nz ?? id).slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 text-[11px] text-text">{it?.n ?? it?.nz ?? id}</span>
                <span className="text-xs font-semibold text-raw tabular-nums">×{qty}</span>
              </Link>
            )
          })}
          <button
            className={`w-full mt-1 p-1.5 border text-[9px] tracking-wider2 uppercase transition-colors ${
              copied ? 'border-raw-border text-raw' : 'border-border text-text-dim hover:border-gold-dim hover:text-gold'
            }`}
            onClick={() => {
              navigator.clipboard?.writeText(
                entries.map(([id, q]) => `${byId.get(id)?.n ?? id}: ×${q}`).join('\n')
              )
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            }}
          >
            {copied ? '✓ Copied' : 'Copy shopping list'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Compose Item page**

Replace `web/src/pages/Item.tsx`:
```tsx
import { useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { primaryRecipeFor } from '../lib/graph'
import ItemHeader from '../components/ItemHeader'
import QtyControl from '../components/QtyControl'
import TreeView from '../components/TreeView'
import RawMatsCollapsible from '../components/RawMats'

export default function Item() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const view = params.get('view') === 'tree' ? 'tree' : 'flow'

  const pushVisit  = useStore(s => s.pushVisit)
  const resetOrSel = useStore(s => s.resetOrSel)
  const graph      = useStore(s => s.graph)

  useEffect(() => { if (id) { pushVisit(id); resetOrSel() } }, [id, pushVisit, resetOrSel])

  const item = useMemo(() => graph?.items.find(i => i.id === id), [graph, id])
  const recipe = useMemo(() => graph && id ? primaryRecipeFor(graph, id) : undefined, [graph, id])
  const station = useMemo(() => graph?.stations.find(s => s.id === (recipe?.st ?? '')), [graph, recipe])

  if (!graph) return <div>Loading…</div>
  if (!item) return <div>Item not found: {id}</div>

  return (
    <div>
      <ItemHeader item={item} recipe={recipe} station={station} />
      {recipe && <QtyControl />}
      {recipe && (
        <>
          <SectionHeader label="Ingredients" color="gold" />
          {view === 'tree'
            ? <TreeView graph={graph} rootId={item.id} />
            : <div className="text-text-dim text-xs">Flow view: see Phase 6.</div>}
          <RawMatsCollapsible graph={graph} rootId={item.id} />
        </>
      )}
    </div>
  )
}

function SectionHeader({ label, color }: { label: string; color: 'gold' | 'jade' }) {
  const diamondColor = color === 'gold' ? 'border-gold-dim bg-gold-dim' : 'border-jade-border bg-jade-border'
  return (
    <div className="flex items-center gap-2 mt-0.5 mb-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-border" />
      <div className={`w-2 h-2 rotate-45 border ${diamondColor}`} />
      <div className="text-[9px] tracking-wider2 uppercase text-text-dim font-semibold whitespace-nowrap">{label}</div>
      <div className={`w-2 h-2 rotate-45 border ${diamondColor}`} />
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
```

Default view is `flow`, but flow is stubbed in Phase 5 — the user should toggle to Tree to see anything. Phase 6 fills in Flow.

- [ ] **Step 4: Smoke test**

Navigate to an item with a known recipe, e.g. `/item/DaoJu_Item_TieDing?view=tree`. Expected: header with Chinese/English name + station chip + time chip; ingredient tree with qty columns; "Total Raw Materials" toggle at bottom.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TreeView.tsx web/src/components/RawMats.tsx web/src/pages/Item.tsx
git commit -m "feat(web): tree view + raw-mats rollup rendered on item page"
```

---

## Phase 6: Flow view

Goal: the `?view=flow` URL renders the diamond-node horizontal flow diagram from the prototype.

### Task 6.1: FlowView

**Files:** Create `/Users/ruben/work/private/souldb/web/src/components/FlowView.tsx`.

- [ ] **Step 1: Write the component**

```tsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Graph, Item } from '../lib/types'
import { primaryRecipeFor, indexItems } from '../lib/graph'
import Diamond from './Diamond'
import { useStore } from '../store'

interface Props { graph: Graph; rootId: string }

export default function FlowView({ graph, rootId }: Props) {
  const byId = useMemo(() => indexItems(graph), [graph])
  const quantity = useStore(s => s.quantity)
  const orSel    = useStore(s => s.orSel)
  const setOrSel = useStore(s => s.setOrSel)
  const navigate = useNavigate()
  const root = byId.get(rootId)
  if (!root || root.raw) {
    return <div className="h-16 flex items-center justify-center text-[11px] text-text-dim">Raw material — gathered, not crafted</div>
  }
  return (
    <div className="overflow-x-auto pb-5 mb-5">
      <FlowNode graph={graph} byId={byId} id={rootId} qty={1} multiplier={quantity}
                isRoot orSel={orSel} setOrSel={setOrSel} onNavigate={id => navigate(`/item/${id}?view=flow`)} />
    </div>
  )
}

interface NodeProps {
  graph: Graph
  byId: Map<string, Item>
  id: string
  qty: number
  multiplier: number
  isRoot?: boolean
  depth?: number
  orSel: Record<string, number>
  setOrSel: (k: string, i: number) => void
  onNavigate: (id: string) => void
}

function FlowNode({ graph, byId, id, qty, multiplier, isRoot = false, depth = 0, orSel, setOrSel, onNavigate }: NodeProps) {
  const item = byId.get(id)
  if (!item || depth > 6) return null
  const total = qty * multiplier
  const recipe = !item.raw ? primaryRecipeFor(graph, id) : undefined
  const hasKids = !!recipe && recipe.groups.length > 0
  const size = isRoot ? 52 : 42
  const stationName = useMemo(
    () => (recipe?.st ? graph.stations.find(s => s.id === recipe.st)?.n : null),
    [recipe, graph]
  )

  const diamond = (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <Diamond
        item={item}
        size={size}
        variant={isRoot ? 'root' : item.raw ? 'raw' : 'default'}
        onClick={() => !item.raw && onNavigate(item.id)}
      />
      <div className="flex flex-col items-center gap-[1px]">
        <span className={`text-[10px] text-center leading-tight max-w-[88px] ${
          isRoot ? 'text-text text-[11px]' : item.raw ? 'text-raw' : 'text-text-muted'
        }`}>
          {item.n ?? item.nz ?? item.id}
        </span>
        <span className={`text-[10px] font-bold tabular-nums ${item.raw ? 'text-raw' : 'text-gold'}`}>×{total}</span>
        {stationName && <span className="text-[9px] text-text-dim">{stationName}</span>}
      </div>
    </div>
  )

  if (!hasKids || !recipe) return diamond

  return (
    <div className="flex items-center">
      {diamond}
      <div className="w-7 h-px bg-gold-dim flex-shrink-0" />
      <div className="flex flex-col gap-2 relative flow-branch">
        {recipe.groups.map((grp, gi) =>
          grp.kind === 'all'
            ? grp.items.map(ing => (
              <div key={`${gi}-${ing.id}`} className="flex items-center relative flow-branch-item">
                <div className="ml-[14px]">
                  <FlowNode graph={graph} byId={byId} id={ing.id} qty={ing.q * qty} multiplier={multiplier}
                            depth={depth + 1} orSel={orSel} setOrSel={setOrSel} onNavigate={onNavigate} />
                </div>
              </div>
            ))
            : (
              <div key={gi} className="flex items-center relative flow-branch-item">
                <div className="ml-[14px] p-2 bg-or-bg border border-or-border min-w-[140px]">
                  <div className="text-[8px] text-or tracking-wider2 uppercase mb-1 font-semibold">Choose one</div>
                  {grp.items.map((alt, ai) => {
                    const altItem = byId.get(alt.id)
                    const active = (orSel[`${recipe.id}:${gi}`] ?? 0) === ai
                    return (
                      <div
                        key={alt.id}
                        className={`py-1 px-1.5 border flex items-center justify-between gap-1 my-[2px] cursor-pointer transition-colors ${
                          active ? 'bg-[rgba(144,128,204,.14)] border-or' : 'border-transparent hover:bg-[rgba(144,128,204,.1)] hover:border-or-border'
                        }`}
                        onClick={() => setOrSel(`${recipe.id}:${gi}`, ai)}
                      >
                        <span className="text-[11px] text-text">{altItem?.n ?? altItem?.nz ?? alt.id}</span>
                        <span className="text-[10px] font-semibold text-or">×{alt.q * qty * multiplier}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into Item page**

Update `web/src/pages/Item.tsx` ingredients block:
```tsx
{view === 'tree'
  ? <TreeView graph={graph} rootId={item.id} />
  : <FlowView graph={graph} rootId={item.id} />}
```
(Replace the stub `<div>Flow view: see Phase 6.</div>` line.)

- [ ] **Step 3: Smoke test**

Navigate to an item with nested dependencies. Verify diamonds render, gold connector lines appear between parent and children, clicking a child diamond navigates to its page.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/FlowView.tsx web/src/pages/Item.tsx
git commit -m "feat(web): flow view with diamond nodes and connector lines"
```

---

## Phase 7: Used-in (both views)

Goal: below the ingredients section, an "Used as ingredient in" section shows upstream recipes in either tree or flow mode.

### Task 7.1: UsedIn component (both modes)

**Files:** Create `/Users/ruben/work/private/souldb/web/src/components/UsedIn.tsx`.

- [ ] **Step 1: Write UsedIn**

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Graph, Item, Recipe } from '../lib/types'
import { buildUsedInIndex, qtyNeeded, indexItems } from '../lib/graph'
import Diamond from './Diamond'
import Icon from './Icon'

interface Props { graph: Graph; rootId: string; view: 'tree' | 'flow' }

export default function UsedIn({ graph, rootId, view }: Props) {
  const usedInIdx = useMemo(() => buildUsedInIndex(graph), [graph])
  const byId = useMemo(() => indexItems(graph), [graph])

  const directRecipeIds = usedInIdx.get(rootId) ?? []
  if (directRecipeIds.length === 0) {
    return <div className="h-16 flex items-center justify-center text-[11px] text-text-dim">Not used in any known recipe</div>
  }

  const directItems = directRecipeIds
    .map(rid => graph.recipes.find(r => r.id === rid))
    .filter((r): r is Recipe => !!r)
    .map(r => r.out)

  if (view === 'flow') {
    return (
      <div className="overflow-x-auto pb-5 mb-5">
        <div className="flex flex-col gap-3">
          {directItems.map(id => (
            <UsedInFlowNode key={id} graph={graph} byId={byId} usedInIdx={usedInIdx}
                            id={id} sourceId={rootId} depth={0} />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="mb-5">
      {directItems.map(id => (
        <UsedInTreeNode key={id} graph={graph} byId={byId} usedInIdx={usedInIdx}
                        id={id} sourceId={rootId} depth={0} />
      ))}
    </div>
  )
}

function UsedInTreeNode({ graph, byId, usedInIdx, id, sourceId, depth }: {
  graph: Graph; byId: Map<string, Item>; usedInIdx: Map<string, string[]>;
  id: string; sourceId: string; depth: number
}) {
  const item = byId.get(id)
  const [expanded, setExpanded] = useState(false)
  const upstream = usedInIdx.get(id) ?? []
  if (!item) return null

  const recipe = graph.recipes.find(r => r.out === id && r.groups.some(g => g.items.some(it => it.id === sourceId)))
  const qty = recipe ? qtyNeeded(recipe, sourceId) : null
  const station = recipe?.st ? graph.stations.find(s => s.id === recipe.st) : undefined

  return (
    <div>
      <div
        className={`group flex items-center gap-2 px-2 py-1.5 my-px hover:bg-jade-bg ${upstream.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => upstream.length > 0 && setExpanded(v => !v)}
      >
        <span className="w-3 text-[9px] text-jade text-center">
          {upstream.length > 0 ? (expanded ? '▾' : '▸') : ''}
        </span>
        <div className="relative">
          <Icon item={item} size={24} className="border-jade-border bg-jade-bg" />
        </div>
        <span className="flex-1 text-sm text-text">{item.n ?? item.nz ?? item.id}</span>
        {qty != null && <span className="text-[10px] font-semibold text-jade">×{qty}</span>}
        {station?.n && <span className="text-[9px] text-jade px-1 py-px bg-jade-bg">{station.n}</span>}
        <Link to={`/item/${item.id}`} className="w-[18px] h-[18px] flex items-center justify-center bg-jade-bg text-jade text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}>→</Link>
      </div>
      {expanded && (
        <div className="relative pl-4 ml-4 border-l border-jade-border">
          {upstream.map(rid => {
            const r = graph.recipes.find(rr => rr.id === rid)
            if (!r) return null
            return <UsedInTreeNode key={r.out} graph={graph} byId={byId} usedInIdx={usedInIdx}
                                   id={r.out} sourceId={id} depth={depth + 1} />
          })}
        </div>
      )}
    </div>
  )
}

function UsedInFlowNode({ graph, byId, usedInIdx, id, sourceId, depth }: {
  graph: Graph; byId: Map<string, Item>; usedInIdx: Map<string, string[]>;
  id: string; sourceId: string; depth: number
}) {
  const item = byId.get(id)
  const nav = useNavigate()
  if (!item || depth > 4) return null
  const upstream = usedInIdx.get(id) ?? []
  const recipe = graph.recipes.find(r => r.out === id && r.groups.some(g => g.items.some(it => it.id === sourceId)))
  const qty = recipe ? qtyNeeded(recipe, sourceId) : null
  const station = recipe?.st ? graph.stations.find(s => s.id === recipe.st) : undefined

  const diamond = (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <Diamond item={item} size={42} variant="jade" onClick={() => nav(`/item/${item.id}?view=flow`)} />
      <div className="flex flex-col items-center gap-[1px]">
        <span className="text-[10px] text-center leading-tight max-w-[88px] text-jade">{item.n ?? item.nz ?? item.id}</span>
        {qty != null && <span className="text-[10px] font-bold text-jade tabular-nums">×{qty}</span>}
        {station?.n && <span className="text-[9px] text-text-dim">{station.n}</span>}
      </div>
    </div>
  )

  if (!upstream.length) return diamond
  return (
    <div className="flex items-center">
      {diamond}
      <div className="w-7 h-px bg-jade-border flex-shrink-0" />
      <div className="flex flex-col gap-2 relative flow-branch jade">
        {upstream.map(rid => {
          const r = graph.recipes.find(rr => rr.id === rid)
          if (!r) return null
          return (
            <div key={r.out} className="flex items-center relative flow-branch-item jade">
              <div className="ml-[14px]">
                <UsedInFlowNode graph={graph} byId={byId} usedInIdx={usedInIdx}
                                id={r.out} sourceId={id} depth={depth + 1} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount on Item page**

Update `web/src/pages/Item.tsx` to append (after the RawMats + Ingredients block):
```tsx
<SectionHeader label="Used as ingredient in" color="jade" />
<UsedIn graph={graph} rootId={item.id} view={view} />
```
Add the import: `import UsedIn from '../components/UsedIn'`.

- [ ] **Step 3: Smoke test**

Navigate to `/item/DaoJu_Item_TieDing?view=flow` (Iron Ingot). Expected: ingredients fanning right + "Used as ingredient in" section showing Iron Axe, Iron Sword, etc. fanning right in jade.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/UsedIn.tsx web/src/pages/Item.tsx
git commit -m "feat(web): used-in section in both tree and flow modes"
```

---

## Phase 8: Sidebar search mode

Goal: typing in the sidebar search box swaps the recent-items list for search results; clearing reverts.

### Task 8.1: Add search input + results to sidebar

**Files:** Modify `/Users/ruben/work/private/souldb/web/src/components/Sidebar.tsx`.

- [ ] **Step 1: Add debounced search**

Replace `web/src/components/Sidebar.tsx`:
```tsx
import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import Icon from './Icon'
import { search as searchApi, type SearchHit } from '../lib/api'

export default function Sidebar() {
  const { id: currentId } = useParams<{ id: string }>()
  const visits = useStore(s => s.recentVisits)
  const graph  = useStore(s => s.graph)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])

  useEffect(() => {
    if (!query.trim()) { setHits([]); return }
    const handle = setTimeout(() => {
      searchApi(query.trim()).then(setHits).catch(() => setHits([]))
    }, 150)
    return () => clearTimeout(handle)
  }, [query])

  if (!graph) return <aside className="w-[234px] flex-shrink-0 border-r border-border bg-surface" />
  const byId = new Map(graph.items.map(i => [i.id, i]))
  const showingSearch = query.trim().length > 0

  return (
    <aside className="w-[234px] flex-shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="p-2.5 border-b border-border">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search items…"
          className="w-full bg-panel border border-border px-2.5 py-1.5 text-xs text-text focus:border-gold-dim focus:outline-none placeholder:text-text-dim"
        />
      </div>
      <div className="px-3 pt-2 pb-1 text-[9px] tracking-widest2 uppercase text-text-dim font-semibold">
        {showingSearch ? 'Results' : 'Recent'}
      </div>
      <div className="flex-1 overflow-y-auto pb-2">
        {showingSearch ? (
          hits.length === 0
            ? <div className="px-3 py-2 text-[11px] text-text-dim">No matches.</div>
            : hits.map(hit => {
                const it = byId.get(hit.id) ?? {
                  id: hit.id, n: hit.name_en, nz: hit.name_zh, cat: hit.category,
                  raw: false,
                }
                const active = hit.id === currentId
                return (
                  <Link key={hit.id} to={`/item/${hit.id}`}
                        onClick={() => setQuery('')}
                        className={`flex items-center gap-2 px-3 py-1.5 border-l-2 ${
                          active ? 'bg-gold-glow border-gold' : 'border-transparent hover:bg-card'
                        }`}>
                    <Icon item={it} size={22} />
                    <div>
                      <div className="text-xs text-text">{hit.name_en ?? hit.name_zh ?? hit.id}</div>
                      {hit.category && <div className="text-[10px] text-text-muted">{hit.category}</div>}
                    </div>
                  </Link>
                )
              })
        ) : visits.length === 0
            ? <div className="px-3 py-2 text-[11px] text-text-dim">Nothing yet. Search or click an item to begin.</div>
            : visits.map(id => {
                const it = byId.get(id)
                const active = id === currentId
                return (
                  <Link key={id} to={`/item/${id}`}
                        className={`flex items-center gap-2 px-3 py-1.5 border-l-2 ${
                          active ? 'bg-gold-glow border-gold' : 'border-transparent hover:bg-card'
                        }`}>
                    <Icon item={it} size={22} />
                    <div>
                      <div className="text-xs text-text">{it?.n ?? it?.nz ?? id}</div>
                      {it?.cat && <div className="text-[10px] text-text-muted">{it.cat}</div>}
                    </div>
                  </Link>
                )
              })}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Smoke test**

Type "iron" in the search box; results populate within ~200ms. Clear the input; recent items return. Click a search hit; it navigates and clears the search.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "feat(web): sidebar search mode with debounced /api/search"
```

---

## Phase 9: Homepage + polish

Goal: v1 is navigable end-to-end with a real homepage landing.

### Task 9.1: Homepage content placeholder

**Files:** Modify `/Users/ruben/work/private/souldb/web/src/pages/Home.tsx`.

- [ ] **Step 1: Write the homepage**

```tsx
import { Link } from 'react-router-dom'
import { useStore } from '../store'

// Hand-picked featured items — good entry points for demonstrating chains.
// Adjust once English names land; currently uses BP ids.
const FEATURED: { id: string; label: string; blurb: string }[] = [
  { id: 'DaoJu_Item_FuZi_Iron',     label: 'Iron Axe',      blurb: 'Forged with iron ingots, premium leather, and a hardwood handle.' },
  { id: 'DaoJu_Item_Jian_Iron',     label: 'Iron Sword',    blurb: 'A mid-tier melee weapon built from iron and leather.' },
  { id: 'Daoju_Item_PiGe_3',        label: 'Premium Leather', blurb: 'A multi-step tanning chain from raw hide to finished leather.' },
]

export default function Home() {
  const graph = useStore(s => s.graph)
  const status = useStore(s => s.graphStatus)
  if (status === 'loading' || !graph) return <div className="p-8">Loading…</div>

  const have = new Set(graph.items.map(i => i.id))
  const available = FEATURED.filter(f => have.has(f.id))

  return (
    <div className="p-10 max-w-2xl">
      <h1 className="font-display text-3xl text-gold mb-2 tracking-wide">Soulmask · Recipe Tree</h1>
      <p className="text-text-muted mb-8">
        Browse {graph.items.length.toLocaleString()} items and {graph.recipes.length.toLocaleString()} crafting recipes.
        Click any ingredient to trace its chain.
      </p>

      <h2 className="font-display text-sm text-gold tracking-wider2 uppercase mb-3">Featured chains</h2>
      <div className="grid gap-3">
        {available.map(f => (
          <Link
            key={f.id}
            to={`/item/${f.id}`}
            className="block p-4 bg-panel border border-border-lit hover:border-gold-dim transition-colors"
          >
            <div className="font-display text-base text-text mb-1">{f.label}</div>
            <div className="text-xs text-text-muted">{f.blurb}</div>
          </Link>
        ))}
        {available.length === 0 && (
          <p className="text-text-dim text-xs">
            Featured items aren't in the database yet — use the sidebar search to find something.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Home.tsx
git commit -m "feat(web): homepage with featured chains"
```

### Task 9.2: Production build verification

- [ ] **Step 1: Build everything**

```bash
make build
ls -la backend/bin/server        # should show the binary
file backend/bin/server          # ELF or Mach-O
```

- [ ] **Step 2: Run the prod binary**

```bash
./backend/bin/server -db ./data/app.db -addr :8080
```

Open `http://localhost:8080/`. Expected: homepage loads from the embedded SPA, navigation works, API calls return data. No Vite process needed.

- [ ] **Step 3: Commit any tweaks**

If the embed fallback logic or asset paths needed tweaking to work in prod mode, commit them.

```bash
git add -u
git commit -m "chore: fix prod build asset paths" --allow-empty
```
(Skip if no changes — `--allow-empty` shown only as a marker; don't actually commit empty.)

### Task 9.3: Visual QA against the prototype

- [ ] **Step 1: Compare to prototype**

Open `/tmp/soulmask_design/x/soulmask-db/project/Recipe Tree.html` in one browser tab, your app in another. Item detail side-by-side:

Checklist:
- [ ] Gold accent on item-header top border
- [ ] Diamond icon border color differs for items with icons (gold) vs. without (dim)
- [ ] Tree connector lines use `gold-dim` color, pseudo-element L-shape visible
- [ ] Flow view diamond nodes tilt 45° with counter-rotated inner content
- [ ] Raw items show 45° pip in tree view and green tint in flow
- [ ] "Used in" section uses jade color palette consistently
- [ ] Qty badges show in tabular-nums font variant
- [ ] Sidebar section labels use tracking-widest2 uppercase

Any visual bug: fix inline, commit under `fix(web): polish …`.

- [ ] **Step 2: Final commit**

If the visual pass produced fixes, commit. If not, skip.

```bash
git add -u
git commit -m "fix(web): visual polish to match prototype"
```

---

## Test summary (run before merging)

```bash
make test                        # runs python (pytest), go (go test), web (vitest)
```

Expected output: all three suites pass, with at minimum:
- `pipeline/test_build_db.py` — schema/import smoke
- `backend/internal/graph/build_test.go` — graph folding
- `backend/internal/api/api_test.go` — 4 endpoint tests, ETag 304 path verified
- `web/src/lib/graph.test.ts` — raw-mats math, used-in index, qtyNeeded

---

## Follow-ups (intentionally deferred)

Open items from the spec, not blocking v1:

- **OR-groups extraction** — needs modkit access to re-probe BP_PeiFang for alternative-ingredient properties. Schema + UI already support it; filling `kind='one_of'` rows is the only step.
- **Real PO translations** — same modkit blocker; when resolved, `parse_localization.py` writes `data/translations/po.json` and `make db` picks it up.
- **Self-hosted icons** — modkit blocker. Replace `CDN` constant + the image import/build step.
- **Fly.io deploy** — single binary; needs a `Dockerfile`, `fly.toml`, volume for `data/app.db`, CI to rebuild on pipeline runs.
- **Drops integration** — `drops.json` → new tables + `/api/items/:id` surface.
- **Goose migrations** — swap in when schema evolves post-launch.
- **Share links** — URL-encode OR selections + qty if users request it.
