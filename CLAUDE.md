# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A one-off reverse-engineering pipeline that extracts Soulmask game data (items, recipes, tech tree, loot tables) from the UE4 modkit into JSON under `Game/Parsed/`. Not an app, not a service — a scraper + parsers. No tests, no CI, no package manager, no linter.

Detailed data shapes, fill rates, and cross-reference maps live in `docs/DATA.md`. Design notes and game-concept glossary in `docs/DESIGN.md`. README has the headline numbers and pipeline diagram.

## Pipeline (two-stage, two-platform)

```
Modkit .uasset files  ──►  [Windows-only export]  ──►  uasset_export/  &  Game/Exports/
                                                       │
                                                       ▼
                                               [any platform parsing]
                                                       │
                                                       ▼
                                               Game/Parsed/*.json  (committed)
```

**Stage 1 (Windows only, requires modkit at `C:\Program Files\Epic Games\SoulMaskModkit`):**
- `pipeline/run_export.bat` → runs `pipeline/export_tables.py` inside `UE4Editor-Cmd.exe` to export 11 DataTables to `Game/Exports/*.json`.
- UAssetGUI (manual, GUI tool) → exports BP_PeiFang / BP_DaoJu / BP_KJS `.uasset` files to `uasset_export/**/*.json.gz` (gitignored, ~800MB).

**Stage 2 (host Python 3, no deps):**
```bash
python3 pipeline/parse_exports.py     # drops.json     (from Game/Exports/)
python3 pipeline/parse_recipes.py     # recipes.json   (from uasset_export/Blueprints/PeiFang/)
python3 pipeline/parse_items.py       # items.json     (from uasset_export/Blueprints/DaoJu/)
python3 pipeline/parse_tech_tree.py   # tech_tree.json (from uasset_export/Blueprints/KeJiShu/)
```

Parsers are independent — run any one in isolation. Outputs are stable enough that they're committed to git (see `Game/Parsed/`).

## Two distinct parsing strategies

The code uses **two different approaches** depending on whether the data was exported via UE4Editor or UAssetGUI — don't mix them up:

1. **DataTable rows (`parse_exports.py`)** — regex over UE4 property-export **text** (strings like `((SelectedRandomProbability=30, BaoNeiDaoJuInfos=((DaoJuClass=...)))`). See `split_top_level_parens` / `parse_daoju_bag_content`. Item refs get resolved via `parse_localization.load_names()` (PO-file lookup, keyed on normalized asset paths).

2. **Blueprint assets (`parse_recipes.py`, `parse_items.py`, `parse_tech_tree.py`)** — walk UAssetAPI's tagged-property **JSON tree**. Item references are negative ints into the `Imports` table; resolve with the shared helper:

```python
def resolve_import_path(imports, ref):
    # negative ref → index into Imports; OuterIndex chains to the Package import
    # that holds the /Game/... path
```

This helper (and `find_props` / `get_prop` / `text_zh`) is copy-pasted into each BP parser — they're ~identical but not factored out. Don't refactor casually; the duplication is intentional to keep each parser independently runnable.

## Non-obvious things

- **UE4.27 Python API is crippled.** `FieldIterator`, `EditorAssetLibrary.export_asset`, `AssetExportTask` with csv/json — all broken. `export_tables.py` works around this by reading the `.uasset` binary directly to scrape property names from the FName table, then probing each with `DataTableFunctionLibrary.get_data_table_column_as_string`. See README "Technical notes" — don't try to "clean this up" using the obvious-looking API calls, they don't work.

- **Chinese-only text.** `name_zh` / `description_zh` / `brief_zh` fields are populated; English resolution via PO localization is done only for `drops.json` (via `parse_localization.py`). Items/recipes/tech_tree still need an English-name join — gap #1 in `docs/DATA.md`. The PO files live in the Windows modkit; access to that machine is the blocker, not the code.

- **Path normalization** (`parse_localization.normalize_path`): strips `/Game/` prefix, CDO suffix (`.Default__X_C`), field suffix, lowercases. Any new PO-joined lookup must use the same normalization.

- **Description typo in source data:** main tech-tree nodes use `Desciption` (sic), subnodes use `Description`. `parse_tech_tree.py` checks both.

- **No shared module** between parsers. `resolve_import_path` / `find_props` / `get_prop` are duplicated across `parse_recipes.py`, `parse_items.py`, `parse_tech_tree.py`. If you need to fix a resolver bug, fix it in all three.

- `PROFICIENCY_MAP` and `STATION_MAP` in `parse_recipes.py` are hand-maintained Chinese→English lookups. When recipes appear with a raw Pinyin proficiency/station, add an entry here.

## Output invariants

- IDs are Blueprint filenames, no extension (`BP_PeiFang_WQ_ChangGong_1`, `Daoju_Item_Wood`).
- Cross-references (`recipe.output.item_id` → `items[].id`, `tech_node.unlocks_recipes[]` → `recipes[].id`, etc.) are documented with current coverage in `docs/DATA.md`. Changes that drop coverage are regressions even though there are no tests.
- `Game/Parsed/*.json` is committed; `Game/Exports/*.json` is committed; `uasset_export/` is gitignored (too big).

## Conventions

- Python 3.x, no external dependencies, no virtualenv needed for stage 2. `.venv/` exists in the repo but isn't required.
- Parsers print a summary (counts, by-category breakdowns, sample rows) to stdout — use this to sanity-check changes.
- Error files (`*_errors.json`) are written next to outputs and gitignored.
