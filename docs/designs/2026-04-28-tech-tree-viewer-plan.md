# Tech tree viewer implementation plan

**Goal:** New `/tech-tree` page with multi-column tier layout, collapsible subnodes, dependency lines, and deep linking.

**Architecture:** Expand the DB schema to store full prerequisite lists (currently only `parent_id`), add a new `/api/tech-tree` endpoint that returns tier-grouped data, build a React page with SVG dependency lines between columns.

**Tech stack:** SQLite + Go (chi) backend, React + TypeScript + Tailwind frontend, SVG for lines.

---

### Task 1: English translations for tech tree nodes

**Files:**
- Create: `data/translations/tech_tree_names.json`
- Modify: `pipeline/build_db.py:221-250`

- [ ] **Step 1: Build translation mapping from scraped data**

Run a Python script to match scraped English names against our tech_tree.json Chinese names, then use Claude-assisted translation for remaining nodes:

```python
# pipeline/build_tech_translations.py
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARSED = ROOT / "Game" / "Parsed"

tech_nodes = json.loads((PARSED / "tech_tree.json").read_text())

# Load scraped data from all 3 modes
scraped_subs = {}
scraped_mains = {}
for fname in [
    ".superpowers/brainstorm/scraped_tech_names.json",
    ".superpowers/brainstorm/scraped_warrior.json",
    ".superpowers/brainstorm/scraped_tribe.json",
]:
    p = ROOT / fname
    if not p.exists():
        continue
    d = json.loads(p.read_text())
    for s in d.get("subNodes", []):
        scraped_subs[s["slug"]] = s["name"]
    for m in d.get("mainNodes", []):
        scraped_mains[m["name"]] = True

# Build translations keyed by node ID
translations = {}

# Main nodes: match by trying slug-ified Chinese→English mappings
# We'll do this semi-manually with the scraped main names list
# For now, output what we have and flag gaps
matched = 0
for n in tech_nodes:
    node_id = n["id"]
    # Check if there's already a match
    # ... (manual matching step)

# Write output
out = {"source": "soulmaskdatabase.com + manual", "entries": translations}
(ROOT / "data" / "translations" / "tech_tree_names.json").write_text(
    json.dumps(out, indent=2, ensure_ascii=False)
)
print(f"Wrote {len(translations)} translations")
```

This is a semi-manual step. Generate the base file, then hand-edit to fill gaps. The scraped data (95 main + 317 sub names) covers most nodes. Use Claude to translate the remaining ~100 Chinese names.

The output file format matches existing translation files:

```json
{
  "source": "soulmaskdatabase.com + manual",
  "entries": {
    "tech_node:BP_KJS_GZT_GouHuo": "Campfire",
    "tech_node:BP_KJS_GJ_YuanShi": "Primitive Tool",
    "tech_node:BP_KJS_SubNode_GJ_ShiFu": "Stone Axe"
  }
}
```

- [ ] **Step 2: Load tech_tree_names.json in build_db.py**

In `pipeline/build_db.py`, after loading `manual.json` (line 233), add:

```python
tech_names = load_json(TRANSLATIONS / "tech_tree_names.json").get("entries", {})
for key, en in tech_names.items():
    db.execute(
        "INSERT OR REPLACE INTO translations (key, en, source) VALUES (?,?,?)",
        (key, en, "tech_tree_names"),
    )
```

This runs before the existing `UPDATE tech_nodes SET name_en = ...` statement at line 269, so names propagate automatically.

- [ ] **Step 3: Rebuild DB and verify**

```bash
make db
```

Then verify:

```bash
sqlite3 data/app.db "SELECT id, name_en FROM tech_nodes WHERE name_en IS NOT NULL AND category='main' LIMIT 10;"
```

Expected: main nodes now have English names.

- [ ] **Step 4: Commit**

```bash
git add data/translations/tech_tree_names.json pipeline/build_db.py
git commit -m "feat: add English translations for tech tree nodes"
```

---

### Task 2: Expand DB schema for full prerequisites

The current schema stores only `parent_id` (first prerequisite). The tech tree viewer needs the full `prerequisite_main_nodes` list and `child_sub_nodes` to build tier groupings and dependency lines.

**Files:**
- Modify: `backend/internal/db/schema.sql:54-64`
- Modify: `pipeline/build_db.py:186-219`

- [ ] **Step 1: Add prerequisite junction table to schema.sql**

Add after the `tech_nodes` table (after line 64):

```sql
CREATE TABLE tech_node_prerequisites (
  tech_node_id      TEXT NOT NULL REFERENCES tech_nodes(id),
  prerequisite_id   TEXT NOT NULL REFERENCES tech_nodes(id),
  PRIMARY KEY (tech_node_id, prerequisite_id)
);
```

- [ ] **Step 2: Add `is_sub` and `slug` columns to `tech_nodes`**

Change the `tech_nodes` table to:

```sql
CREATE TABLE tech_nodes (
  id                   TEXT PRIMARY KEY,
  category             TEXT,
  name_zh              TEXT,
  name_en              TEXT,
  description_zh       TEXT,
  required_mask_level  INTEGER,
  consume_points       INTEGER,
  parent_id            TEXT REFERENCES tech_nodes(id),
  icon_path            TEXT,
  is_sub               INTEGER NOT NULL DEFAULT 0,
  slug                 TEXT
);
CREATE INDEX idx_tech_nodes_slug ON tech_nodes(slug);
```

Keep `parent_id` for backwards compatibility with the existing `GetTechUnlocksForRecipe` query.

- [ ] **Step 3: Update build_db.py to populate new columns and table**

Replace the tech nodes section (lines 186-219) with:

```python
    # tech nodes
    for n in tech_nodes:
        slug = slugify(n.get("name_en") or n.get("name_zh") or n["id"])
        db.execute(
            "INSERT INTO tech_nodes (id, category, name_zh, name_en, description_zh, "
            "required_mask_level, consume_points, parent_id, icon_path, is_sub, slug) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                n["id"], n.get("category"), n.get("name_zh"), None,
                n.get("description_zh"), n.get("required_mask_level"),
                n.get("consume_points"), None, n.get("icon_path"),
                1 if n.get("is_sub") else 0, slug,
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

    # tech node prerequisites (full list)
    for n in tech_nodes:
        for prereq_id in (n.get("prerequisite_main_nodes") or []):
            if prereq_id in existing_node_ids:
                db.execute(
                    "INSERT OR IGNORE INTO tech_node_prerequisites "
                    "(tech_node_id, prerequisite_id) VALUES (?,?)",
                    (n["id"], prereq_id),
                )

    # tech unlocks
    for n in tech_nodes:
        for rec_id in (n.get("unlocks_recipes") or []):
            if rec_id in inserted_recipe_ids:
                db.execute(
                    "INSERT OR IGNORE INTO tech_node_unlocks_recipe "
                    "(tech_node_id, recipe_id) VALUES (?,?)",
                    (n["id"], rec_id),
                )
```

Note: the `slug` will be computed from `name_en` after translations are applied. Move the slug update after the translation block:

After the `UPDATE tech_nodes SET name_en = ...` statement (line 272), add:

```python
    db.execute("""
        UPDATE tech_nodes SET slug = NULL
    """)
    rows = db.execute("SELECT id, name_en, name_zh FROM tech_nodes").fetchall()
    for row in rows:
        name = row[1] or row[2] or row[0]
        slug = slugify(name)
        db.execute("UPDATE tech_nodes SET slug=? WHERE id=?", (slug, row[0]))
```

- [ ] **Step 4: Rebuild and verify**

```bash
make db
sqlite3 data/app.db "SELECT tn.id, tn.slug, GROUP_CONCAT(tp.prerequisite_id) FROM tech_nodes tn LEFT JOIN tech_node_prerequisites tp ON tp.tech_node_id = tn.id WHERE tn.category='main' GROUP BY tn.id LIMIT 10;"
```

Expected: nodes have slugs and prerequisite links.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/db/schema.sql pipeline/build_db.py
git commit -m "feat: expand tech_nodes schema with prerequisites table, is_sub, slug"
```

---

### Task 3: Backend API endpoint

**Files:**
- Modify: `backend/internal/db/queries.sql` (add queries)
- Create: `backend/internal/api/tech_tree.go` (handler)
- Modify: `backend/internal/api/router.go:29-33` (add route)

- [ ] **Step 1: Add SQL queries**

Append to `backend/internal/db/queries.sql`:

```sql
-- name: ListTechNodes :many
SELECT id, category, name_zh, name_en, description_zh,
       required_mask_level, consume_points, parent_id,
       icon_path, is_sub, slug
FROM tech_nodes
ORDER BY required_mask_level, id;

-- name: ListTechNodePrerequisites :many
SELECT tech_node_id, prerequisite_id
FROM tech_node_prerequisites;

-- name: ListTechNodeRecipeUnlocks :many
SELECT u.tech_node_id, u.recipe_id,
       i.name_en AS item_name_en, i.name_zh AS item_name_zh,
       i.id AS item_id, i.slug AS item_slug, i.icon_path AS item_icon
FROM tech_node_unlocks_recipe u
JOIN recipes r ON r.id = u.recipe_id
JOIN items i ON i.id = r.output_item_id;
```

- [ ] **Step 2: Regenerate SQLc**

```bash
make db && make sqlc
```

Verify no errors. Expected: `backend/internal/db/gen/queries.sql.go` now has `ListTechNodes`, `ListTechNodePrerequisites`, `ListTechNodeRecipeUnlocks` functions.

- [ ] **Step 3: Create the handler**

Create `backend/internal/api/tech_tree.go`:

```go
package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

type TechSubNode struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	NameZh         *string          `json:"name_zh,omitempty"`
	Slug           *string          `json:"slug,omitempty"`
	AwarenessLevel *int64           `json:"awareness_level,omitempty"`
	Points         *int64           `json:"points,omitempty"`
	Recipes        []TechRecipeLink `json:"recipes"`
}

type TechRecipeLink struct {
	RecipeID   string  `json:"recipe_id"`
	ItemID     string  `json:"item_id"`
	ItemName   string  `json:"item_name"`
	ItemNameZh *string `json:"item_name_zh,omitempty"`
	ItemSlug   *string `json:"item_slug,omitempty"`
	ItemIcon   *string `json:"item_icon,omitempty"`
}

type TechMainNode struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	NameZh         *string       `json:"name_zh,omitempty"`
	Slug           *string       `json:"slug,omitempty"`
	AwarenessLevel *int64        `json:"awareness_level,omitempty"`
	IconPath       *string       `json:"icon_path,omitempty"`
	DependsOn      []string      `json:"depends_on,omitempty"`
	SubNodes       []TechSubNode `json:"sub_nodes"`
}

type TechTierNodes struct {
	Left  []TechMainNode `json:"left"`
	Right []TechMainNode `json:"right"`
}

type TechTier struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	AwarenessLevel int64         `json:"awareness_level"`
	Nodes          TechTierNodes `json:"nodes"`
}

type TechTreeResponse struct {
	Tiers    []TechTier     `json:"tiers"`
	Untiered []TechMainNode `json:"untiered"`
}

var bonfireChain = []string{
	"BP_KJS_GZT_GouHuo",
	"BP_KJS_GZT_YingHuo",
	"BP_KJS_GZT_YingHuo_2",
	"BP_KJS_GZT_YingHuo_3",
	"BP_KJS_GZT_YingHuo_4",
	"BP_KJS_GZT_YingHuo_5",
}

func (s *Server) handleTechTree(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "survival"
	}

	var mainCat, subCat string
	switch mode {
	case "soldier":
		mainCat, subCat = "main_action", "sub_action"
	case "management":
		mainCat, subCat = "main_management", "sub_management"
	default:
		mainCat, subCat = "main", "sub"
	}

	ctx := r.Context()
	q := dbgen.New(s.DB)

	allNodes, err := q.ListTechNodes(ctx)
	if err != nil {
		http.Error(w, "failed to load tech nodes", 500)
		return
	}

	allPrereqs, err := q.ListTechNodePrerequisites(ctx)
	if err != nil {
		http.Error(w, "failed to load prerequisites", 500)
		return
	}

	allRecipes, err := q.ListTechNodeRecipeUnlocks(ctx)
	if err != nil {
		http.Error(w, "failed to load recipe unlocks", 500)
		return
	}

	// Index prerequisites: node_id -> []prerequisite_id
	prereqMap := map[string][]string{}
	for _, p := range allPrereqs {
		prereqMap[p.TechNodeID] = append(prereqMap[p.TechNodeID], p.PrerequisiteID)
	}

	// Index recipes: node_id -> []TechRecipeLink
	recipeMap := map[string][]TechRecipeLink{}
	for _, r := range allRecipes {
		recipeMap[r.TechNodeID] = append(recipeMap[r.TechNodeID], TechRecipeLink{
			RecipeID:   r.RecipeID,
			ItemID:     r.ItemID,
			ItemName:   stringOrEmpty(r.ItemNameEn),
			ItemNameZh: nullStr(r.ItemNameZh),
			ItemSlug:   nullStr(r.ItemSlug),
			ItemIcon:   nullStr(r.ItemIcon),
		})
	}

	// Filter to requested mode
	mainNodes := map[string]dbgen.ListTechNodesRow{}
	subNodes := map[string]dbgen.ListTechNodesRow{}
	childMap := map[string][]string{} // main_id -> []sub_id via parent_id

	for _, n := range allNodes {
		cat := ""
		if n.Category.Valid {
			cat = n.Category.String
		}
		if cat == mainCat {
			mainNodes[n.ID] = n
		} else if cat == subCat {
			subNodes[n.ID] = n
			if n.ParentID.Valid {
				childMap[n.ParentID.String] = append(childMap[n.ParentID.String], n.ID)
			}
		}
	}

	// Build bonfire set for tier assignment
	bonfireSet := map[string]bool{}
	for _, id := range bonfireChain {
		bonfireSet[id] = true
	}

	// Find tier for each node by walking prerequisite chain
	tierCache := map[string]string{}
	var findTier func(id string, visited map[string]bool) string
	findTier = func(id string, visited map[string]bool) string {
		if visited[id] {
			return ""
		}
		visited[id] = true
		if bonfireSet[id] {
			return id
		}
		if cached, ok := tierCache[id]; ok {
			return cached
		}
		best := ""
		bestIdx := -1
		for _, pid := range prereqMap[id] {
			t := findTier(pid, visited)
			if t != "" {
				for i, bf := range bonfireChain {
					if bf == t && i > bestIdx {
						best = t
						bestIdx = i
					}
				}
			}
		}
		tierCache[id] = best
		return best
	}

	// Group main nodes by tier
	tierNodes := map[string][]string{} // bonfire_id -> []main_node_id
	var untieredIDs []string

	for id := range mainNodes {
		if bonfireSet[id] {
			continue
		}
		visited := map[string]bool{}
		tier := findTier(id, visited)
		if tier == "" {
			untieredIDs = append(untieredIDs, id)
		} else {
			tierNodes[tier] = append(tierNodes[tier], id)
		}
	}

	// Helper: build TechMainNode from DB row
	buildMainNode := func(id string) TechMainNode {
		n := mainNodes[id]
		mn := TechMainNode{
			ID:             id,
			Name:           stringOrEmpty(n.NameEn),
			NameZh:         nullStr(n.NameZh),
			Slug:           nullStr(n.Slug),
			AwarenessLevel: nullInt(n.RequiredMaskLevel),
			IconPath:       nullStr(n.IconPath),
		}
		// Non-bonfire prerequisites within this node's tier
		for _, pid := range prereqMap[id] {
			if !bonfireSet[pid] {
				mn.DependsOn = append(mn.DependsOn, pid)
			}
		}
		// Sub nodes
		for _, sid := range childMap[id] {
			sn := subNodes[sid]
			sub := TechSubNode{
				ID:             sid,
				Name:           stringOrEmpty(sn.NameEn),
				NameZh:         nullStr(sn.NameZh),
				Slug:           nullStr(sn.Slug),
				AwarenessLevel: nullInt(sn.RequiredMaskLevel),
				Points:         nullInt(sn.ConsumePoints),
				Recipes:        recipeMap[sid],
			}
			if sub.Recipes == nil {
				sub.Recipes = []TechRecipeLink{}
			}
			mn.SubNodes = append(mn.SubNodes, sub)
		}
		if mn.SubNodes == nil {
			mn.SubNodes = []TechSubNode{}
		}
		return mn
	}

	sortByLevel := func(nodes []TechMainNode) {
		sort.Slice(nodes, func(i, j int) bool {
			li, lj := int64(9999), int64(9999)
			if nodes[i].AwarenessLevel != nil {
				li = *nodes[i].AwarenessLevel
			}
			if nodes[j].AwarenessLevel != nil {
				lj = *nodes[j].AwarenessLevel
			}
			if li != lj {
				return li < lj
			}
			return nodes[i].ID < nodes[j].ID
		})
	}

	// Build tiers
	// Bonfire names (English) — will be looked up from mainNodes if present,
	// otherwise use hardcoded fallbacks
	bonfireNames := map[string]string{
		"BP_KJS_GZT_GouHuo":    "Campfire",
		"BP_KJS_GZT_YingHuo":   "Bonfire",
		"BP_KJS_GZT_YingHuo_2": "Bronze Pit Bonfire",
		"BP_KJS_GZT_YingHuo_3": "Black Iron Pit Bonfire",
		"BP_KJS_GZT_YingHuo_4": "Steel Pit Bonfire",
		"BP_KJS_GZT_YingHuo_5": "Fine Steel Pit Bonfire",
	}

	var tiers []TechTier
	for _, bfID := range bonfireChain {
		bfNode, hasBf := mainNodes[bfID]
		if !hasBf {
			continue
		}

		name := bonfireNames[bfID]
		if bfNode.NameEn.Valid && bfNode.NameEn.String != "" {
			name = bfNode.NameEn.String
		}

		level := int64(0)
		if bfNode.RequiredMaskLevel.Valid {
			level = bfNode.RequiredMaskLevel.Int64
		}

		nodeIDs := tierNodes[bfID]
		tierNodeSet := map[string]bool{}
		for _, id := range nodeIDs {
			tierNodeSet[id] = true
		}

		var left, right []TechMainNode
		for _, id := range nodeIDs {
			mn := buildMainNode(id)
			// Right column: has a non-bonfire prereq within this tier
			hasInternalPrereq := false
			for _, dep := range mn.DependsOn {
				if tierNodeSet[dep] {
					hasInternalPrereq = true
					break
				}
			}
			if hasInternalPrereq {
				right = append(right, mn)
			} else {
				left = append(left, mn)
			}
		}
		sortByLevel(left)
		sortByLevel(right)

		tiers = append(tiers, TechTier{
			ID:             bfID,
			Name:           name,
			AwarenessLevel: level,
			Nodes:          TechTierNodes{Left: left, Right: right},
		})
	}

	// Ensure empty slices
	for i := range tiers {
		if tiers[i].Nodes.Left == nil {
			tiers[i].Nodes.Left = []TechMainNode{}
		}
		if tiers[i].Nodes.Right == nil {
			tiers[i].Nodes.Right = []TechMainNode{}
		}
	}

	var untiered []TechMainNode
	for _, id := range untieredIDs {
		untiered = append(untiered, buildMainNode(id))
	}
	sortByLevel(untiered)
	if untiered == nil {
		untiered = []TechMainNode{}
	}

	resp := TechTreeResponse{Tiers: tiers, Untiered: untiered}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func stringOrEmpty(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}
```

Note: `nullStr` and `nullInt` are already defined in `items.go`. `stringOrEmpty` is new — it returns `""` instead of `nil` for display names.

Check if `nullStr`/`nullInt` exist:

```bash
grep -n 'func nullStr\|func nullInt\|func nullFloat' backend/internal/api/items.go
```

If they're in `items.go`, they're already package-scoped — no import needed.

- [ ] **Step 4: Register the route**

In `backend/internal/api/router.go`, add after line 32 (`r.Get("/food-buffs", ...)`):

```go
	r.Get("/tech-tree", s.handleTechTree)
```

- [ ] **Step 5: Build and test**

```bash
cd backend && go build ./...
```

Then start dev server and test:

```bash
make dev
curl -s 'http://localhost:9060/api/tech-tree?mode=survival' | python3 -m json.tool | head -60
curl -s 'http://localhost:9060/api/tech-tree?mode=soldier' | python3 -m json.tool | head -30
```

Verify: response has `tiers` array with 6 entries, each tier has `left`/`right` node arrays, nodes have `sub_nodes` with `recipes`.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/db/queries.sql backend/internal/db/gen/ backend/internal/api/tech_tree.go backend/internal/api/router.go
git commit -m "feat: add /api/tech-tree endpoint with tier grouping"
```

---

### Task 4: Frontend types and API client

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/api.ts`

- [ ] **Step 1: Add TypeScript types**

Append to `web/src/lib/types.ts`:

```typescript
export interface TechRecipeLink {
  recipe_id: string
  item_id: string
  item_name: string
  item_name_zh?: string | null
  item_slug?: string | null
  item_icon?: string | null
}

export interface TechSubNode {
  id: string
  name: string
  name_zh?: string | null
  slug?: string | null
  awareness_level?: number | null
  points?: number | null
  recipes: TechRecipeLink[]
}

export interface TechMainNode {
  id: string
  name: string
  name_zh?: string | null
  slug?: string | null
  awareness_level?: number | null
  icon_path?: string | null
  depends_on?: string[]
  sub_nodes: TechSubNode[]
}

export interface TechTierNodes {
  left: TechMainNode[]
  right: TechMainNode[]
}

export interface TechTier {
  id: string
  name: string
  awareness_level: number
  nodes: TechTierNodes
}

export interface TechTreeResponse {
  tiers: TechTier[]
  untiered: TechMainNode[]
}

export type TechMode = 'survival' | 'soldier' | 'management'
```

- [ ] **Step 2: Add fetch function**

Append to `web/src/lib/api.ts`:

```typescript
import type { TechTreeResponse, TechMode } from './types'

export async function fetchTechTree(mode: TechMode = 'survival'): Promise<TechTreeResponse> {
  const res = await fetch(`/api/tech-tree?mode=${mode}`)
  if (!res.ok) throw new Error(`tech-tree: ${res.status}`)
  return res.json()
}
```

Add the `TechTreeResponse` and `TechMode` imports to the existing import line at the top of `api.ts`.

- [ ] **Step 3: Verify types compile**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts web/src/lib/api.ts
git commit -m "feat: add tech tree types and API client"
```

---

### Task 5: TechRecipeCard component

**Files:**
- Create: `web/src/components/TechRecipeCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Link } from 'react-router-dom'
import type { TechRecipeLink } from '../lib/types'

const ICON_BASE = import.meta.env.VITE_ICON_BASE || '/icons'

export default function TechRecipeCard({ recipe }: { recipe: TechRecipeLink }) {
  const href = recipe.item_slug ? `/item/${recipe.item_slug}` : `/item/${recipe.item_id}`
  const iconSrc = recipe.item_icon
    ? `${ICON_BASE}/${recipe.item_icon.replace('/Game/UI/Icon/', '').replace(/\//g, '_')}.png`
    : null

  return (
    <Link
      to={href}
      className="flex items-center gap-2 rounded border border-neutral-700 bg-white/[0.03] px-2 py-1.5 hover:border-teal-600 hover:bg-white/[0.06] transition-colors"
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className="h-7 w-7 rounded object-contain" />
      ) : (
        <div className="h-7 w-7 rounded bg-teal-900/30 flex items-center justify-center text-xs text-teal-400">?</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-neutral-300 truncate">{recipe.item_name || recipe.item_name_zh}</div>
      </div>
      <span className="text-teal-500 text-xs">→</span>
    </Link>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TechRecipeCard.tsx
git commit -m "feat: add TechRecipeCard component"
```

---

### Task 6: TechSubNode component

**Files:**
- Create: `web/src/components/TechSubNode.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import type { TechSubNode as TechSubNodeType } from '../lib/types'
import TechRecipeCard from './TechRecipeCard'

interface Props {
  node: TechSubNodeType
  isOpen: boolean
  onToggle: () => void
}

export default function TechSubNode({ node, isOpen, onToggle }: Props) {
  const name = node.name || node.name_zh || node.id

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] transition-colors ${
          isOpen
            ? 'bg-green-500/10 text-white border border-green-500/30'
            : 'bg-green-500/[0.06] text-neutral-300 hover:bg-green-500/10'
        }`}
      >
        <span className="flex-1 truncate">{name}</span>
        {node.points != null && (
          <span className="text-neutral-500 text-[10px] shrink-0">{node.points}pt</span>
        )}
      </button>

      {isOpen && (
        <div className="mt-1 mb-1 rounded border border-teal-700 bg-[#1e2d38] p-2">
          <div className="text-xs font-semibold text-white mb-0.5">{name}</div>
          <div className="text-[10px] text-neutral-400 mb-2">
            {node.awareness_level != null && `Awareness ${node.awareness_level}`}
            {node.awareness_level != null && node.points != null && ' · '}
            {node.points != null && `${node.points} tech point${node.points !== 1 ? 's' : ''}`}
          </div>
          {node.recipes.length > 0 && (
            <>
              <div className="text-[10px] text-neutral-500 mb-1">
                Unlocks {node.recipes.length} recipe{node.recipes.length !== 1 ? 's' : ''}:
              </div>
              <div className="flex flex-col gap-1">
                {node.recipes.map(r => (
                  <TechRecipeCard key={r.recipe_id} recipe={r} />
                ))}
              </div>
            </>
          )}
          {node.recipes.length === 0 && (
            <div className="text-[10px] text-neutral-500 italic">No linked recipes</div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TechSubNode.tsx
git commit -m "feat: add TechSubNode component with inline recipe detail"
```

---

### Task 7: TechNode component (collapsible main node)

**Files:**
- Create: `web/src/components/TechNode.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, forwardRef } from 'react'
import type { TechMainNode } from '../lib/types'
import TechSubNode from './TechSubNode'

interface Props {
  node: TechMainNode
  isExpanded: boolean
  onToggle: () => void
  highlighted?: boolean
  dimmed?: boolean
}

const TechNode = forwardRef<HTMLDivElement, Props>(
  ({ node, isExpanded, onToggle, highlighted, dimmed }, ref) => {
    const [openSubId, setOpenSubId] = useState<string | null>(null)
    const name = node.name || node.name_zh || node.id

    return (
      <div
        ref={ref}
        data-node-id={node.id}
        className={`rounded-md transition-all ${
          dimmed ? 'opacity-30' : ''
        } ${
          isExpanded
            ? 'border border-green-500 overflow-hidden'
            : highlighted
              ? 'border border-green-500/50'
              : 'border border-neutral-700'
        }`}
      >
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] transition-colors ${
            isExpanded
              ? 'bg-green-500/10 text-green-400 font-semibold'
              : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.06]'
          }`}
        >
          <span className={`text-[9px] ${isExpanded ? 'text-green-400' : 'text-neutral-600'}`}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="flex-1 truncate">{name}</span>
          <span className="text-neutral-600 text-[10px] shrink-0">
            {node.sub_nodes.length}
          </span>
        </button>

        {isExpanded && node.sub_nodes.length > 0 && (
          <div className="border-t border-green-500/15 bg-green-500/[0.02] px-1.5 py-1 pl-5 flex flex-col gap-1">
            {node.sub_nodes.map(sub => (
              <TechSubNode
                key={sub.id}
                node={sub}
                isOpen={openSubId === sub.id}
                onToggle={() => setOpenSubId(openSubId === sub.id ? null : sub.id)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
)

TechNode.displayName = 'TechNode'
export default TechNode
```

Uses `forwardRef` so the parent can read DOM positions for SVG line drawing.

- [ ] **Step 2: Verify**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TechNode.tsx
git commit -m "feat: add TechNode collapsible accordion component"
```

---

### Task 8: TechTier component with SVG dependency lines

**Files:**
- Create: `web/src/components/TechTier.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useRef, useState, useEffect, useCallback } from 'react'
import type { TechTier as TechTierType, TechMainNode } from '../lib/types'
import TechNode from './TechNode'

interface Props {
  tier: TechTierType
  expandedNodeId: string | null
  onToggleNode: (id: string) => void
  hoveredNodeId: string | null
  onHoverNode: (id: string | null) => void
}

interface Line {
  fromId: string
  toId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export default function TechTier({ tier, expandedNodeId, onToggleNode, hoveredNodeId, onHoverNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [lines, setLines] = useState<Line[]>([])
  const [containerHeight, setContainerHeight] = useState(0)

  const setNodeRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el)
    else nodeRefs.current.delete(id)
  }, [])

  const computeLines = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    setContainerHeight(rect.height)
    const newLines: Line[] = []

    for (const node of tier.nodes.right) {
      for (const depId of (node.depends_on || [])) {
        const fromEl = nodeRefs.current.get(depId)
        const toEl = nodeRefs.current.get(node.id)
        if (!fromEl || !toEl) continue

        const fromRect = fromEl.getBoundingClientRect()
        const toRect = toEl.getBoundingClientRect()

        newLines.push({
          fromId: depId,
          toId: node.id,
          x1: fromRect.right - rect.left,
          y1: fromRect.top + fromRect.height / 2 - rect.top,
          x2: toRect.left - rect.left,
          y2: toRect.top + toRect.height / 2 - rect.top,
        })
      }
    }
    setLines(newLines)
  }, [tier])

  useEffect(() => {
    requestAnimationFrame(computeLines)
  }, [computeLines, expandedNodeId])

  useEffect(() => {
    const observer = new ResizeObserver(() => requestAnimationFrame(computeLines))
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [computeLines])

  const isNodeInHoverChain = (nodeId: string) => {
    if (!hoveredNodeId) return false
    if (nodeId === hoveredNodeId) return true
    return lines.some(
      l => (l.fromId === hoveredNodeId && l.toId === nodeId) ||
           (l.toId === hoveredNodeId && l.fromId === nodeId)
    )
  }

  return (
    <div className="flex-none rounded-lg border border-neutral-800 bg-white/[0.01] overflow-hidden">
      {/* Tier header */}
      <div className="bg-teal-700 text-white px-4 py-2 text-center">
        <div className="text-sm font-bold">{tier.name}</div>
        <div className="text-[10px] opacity-60">Awareness {tier.awareness_level}</div>
      </div>

      {/* Two-column layout with SVG overlay */}
      <div ref={containerRef} className="relative flex gap-0 p-2" style={{ minWidth: tier.nodes.right.length > 0 ? 384 : 180 }}>
        {/* SVG lines */}
        {lines.length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none z-10"
            style={{ width: '100%', height: containerHeight || '100%' }}
          >
            {lines.map((line, i) => {
              const active = isNodeInHoverChain(line.fromId) || isNodeInHoverChain(line.toId)
              const dimmed = hoveredNodeId && !active
              return (
                <path
                  key={i}
                  d={`M ${line.x1} ${line.y1} C ${line.x1 + 20} ${line.y1}, ${line.x2 - 20} ${line.y2}, ${line.x2} ${line.y2}`}
                  stroke="#5BC477"
                  strokeWidth={active ? 2 : 1.5}
                  fill="none"
                  opacity={dimmed ? 0.08 : active ? 0.8 : 0.3}
                  className="transition-opacity duration-150"
                />
              )
            })}
          </svg>
        )}

        {/* Left column */}
        <div className="flex-none flex flex-col gap-1" style={{ width: 180 }}>
          {tier.nodes.left.map(node => (
            <div
              key={node.id}
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
            >
              <TechNode
                ref={setNodeRef(node.id)}
                node={node}
                isExpanded={expandedNodeId === node.id}
                onToggle={() => onToggleNode(node.id)}
                highlighted={isNodeInHoverChain(node.id)}
                dimmed={!!hoveredNodeId && !isNodeInHoverChain(node.id)}
              />
            </div>
          ))}
        </div>

        {/* Right column */}
        {tier.nodes.right.length > 0 && (
          <div className="flex-none flex flex-col gap-1" style={{ width: 180, marginLeft: 24 }}>
            {tier.nodes.right.map(node => (
              <div
                key={node.id}
                onMouseEnter={() => onHoverNode(node.id)}
                onMouseLeave={() => onHoverNode(null)}
              >
                <TechNode
                  ref={setNodeRef(node.id)}
                  node={node}
                  isExpanded={expandedNodeId === node.id}
                  onToggle={() => onToggleNode(node.id)}
                  highlighted={isNodeInHoverChain(node.id)}
                  dimmed={!!hoveredNodeId && !isNodeInHoverChain(node.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TechTier.tsx
git commit -m "feat: add TechTier component with SVG dependency lines"
```

---

### Task 9: TechTree page and routing

**Files:**
- Create: `web/src/pages/TechTree.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create the page component**

```tsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchTechTree } from '../lib/api'
import type { TechTreeResponse, TechMode, TechMainNode } from '../lib/types'
import TechTier from '../components/TechTier'

const MODES: { key: TechMode; label: string }[] = [
  { key: 'survival', label: 'Survival' },
  { key: 'soldier', label: 'Soldier' },
  { key: 'management', label: 'Management' },
]

export default function TechTree() {
  const { slug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()

  const [mode, setMode] = useState<TechMode>('survival')
  const [data, setData] = useState<TechTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchTechTree(mode)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [mode])

  // Deep link: find and expand node matching slug
  useEffect(() => {
    if (!slug || !data) return

    for (const tier of data.tiers) {
      const allNodes = [...tier.nodes.left, ...tier.nodes.right]
      for (const node of allNodes) {
        if (node.slug === slug) {
          setExpandedNodeId(node.id)
          // Scroll tier into view after render
          setTimeout(() => {
            const el = document.querySelector(`[data-node-id="${node.id}"]`)
            el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
          }, 100)
          return
        }
        for (const sub of node.sub_nodes) {
          if (sub.slug === slug) {
            setExpandedNodeId(node.id)
            setTimeout(() => {
              const el = document.querySelector(`[data-node-id="${node.id}"]`)
              el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
            }, 100)
            return
          }
        }
      }
    }
  }, [slug, data])

  const handleToggleNode = useCallback((id: string) => {
    setExpandedNodeId(prev => prev === id ? null : id)
  }, [])

  // Search filter
  const matchesSearch = useCallback((node: TechMainNode): boolean => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    if ((node.name || '').toLowerCase().includes(q)) return true
    if ((node.name_zh || '').includes(searchQuery)) return true
    return node.sub_nodes.some(
      s => (s.name || '').toLowerCase().includes(q) || (s.name_zh || '').includes(searchQuery)
    )
  }, [searchQuery])

  return (
    <>
      <Helmet>
        <title>Tech Tree — SoulmaskDB</title>
      </Helmet>

      <div className="min-h-screen bg-[#16212B]">
        {/* Top bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-800 bg-[#16212B]/95 backdrop-blur px-4 py-2.5">
          <h1 className="text-sm font-bold text-white mr-2">Tech Tree</h1>

          {/* Mode tabs */}
          <div className="flex gap-1">
            {MODES.map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  mode === m.key
                    ? 'bg-teal-700 text-white'
                    : 'bg-white/[0.05] text-neutral-500 border border-neutral-700 hover:text-neutral-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <input
            type="text"
            placeholder="Search tech nodes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-52 rounded border border-neutral-700 bg-white/[0.05] px-3 py-1 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-teal-600"
          />
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-neutral-500 text-sm">Loading...</div>
        )}
        {error && (
          <div className="flex items-center justify-center py-20 text-red-400 text-sm">{error}</div>
        )}

        {data && (
          <div
            ref={scrollContainerRef}
            className="flex gap-0.5 p-3 overflow-x-auto items-start"
          >
            {data.tiers.map(tier => {
              const hasMatch = !searchQuery || [...tier.nodes.left, ...tier.nodes.right].some(matchesSearch)
              return (
                <div
                  key={tier.id}
                  className={`transition-opacity ${hasMatch ? '' : 'opacity-20 pointer-events-none'}`}
                >
                  <TechTier
                    tier={searchQuery ? {
                      ...tier,
                      nodes: {
                        left: tier.nodes.left.filter(matchesSearch),
                        right: tier.nodes.right.filter(matchesSearch),
                      },
                    } : tier}
                    expandedNodeId={expandedNodeId}
                    onToggleNode={handleToggleNode}
                    hoveredNodeId={hoveredNodeId}
                    onHoverNode={setHoveredNodeId}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Untiered nodes (Guardian armor) */}
        {data && data.untiered.length > 0 && (
          <div className="px-3 pb-6">
            <div className="rounded-lg border border-neutral-800 bg-white/[0.01] overflow-hidden" style={{ maxWidth: 400 }}>
              <div className="bg-neutral-800 text-neutral-300 px-4 py-2 text-center text-sm font-semibold">
                Guardian Armor Sets
                <div className="text-[10px] text-neutral-500 font-normal">No tier prerequisite</div>
              </div>
              <div className="p-2 flex flex-col gap-1">
                {data.untiered.map(node => (
                  <TechNode
                    key={node.id}
                    node={node}
                    isExpanded={expandedNodeId === node.id}
                    onToggle={() => handleToggleNode(node.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
```

Import `TechNode` at the top:

```tsx
import TechNode from '../components/TechNode'
```

- [ ] **Step 2: Add routes in App.tsx**

Replace the `App.tsx` content:

```tsx
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import Home from './pages/Home'
import Item from './pages/Item'
import AwarenessXp from './pages/AwarenessXp'
import FoodAlmanac from './pages/FoodAlmanac'
import TechTree from './pages/TechTree'

export default function App() {
  const loadGraph = useStore(s => s.loadGraph)
  useEffect(() => { loadGraph() }, [loadGraph])
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/item/:id" element={<Item />} />
        <Route path="/awareness-xp" element={<AwarenessXp />} />
        <Route path="/food-almanac" element={<FoodAlmanac />} />
        <Route path="/tech-tree" element={<TechTree />} />
        <Route path="/tech-tree/:slug" element={<TechTree />} />
      </Routes>
    </Layout>
  )
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/TechTree.tsx web/src/App.tsx
git commit -m "feat: add TechTree page with routing, search, mode tabs, deep linking"
```

---

### Task 10: Add navigation link and test in browser

**Files:**
- Modify: `web/src/components/Layout.tsx` (add nav link)

- [ ] **Step 1: Find the nav bar and add link**

Check `Layout.tsx` for the existing navigation pattern (look for `Link` components to `/food-almanac`, `/awareness-xp`). Add a new entry:

```tsx
<Link to="/tech-tree" className="...existing-classes...">Tech Tree</Link>
```

Match the existing nav link style and placement.

- [ ] **Step 2: Start dev server and test in browser**

```bash
make dev
```

Open `http://localhost:5173/tech-tree` in browser. Verify:
1. Page loads with Survival mode selected
2. 6 tier columns appear with correct names (Campfire, Bonfire, Bronze, ...)
3. Left/right column layout within each tier
4. Clicking a main node expands to show subnodes
5. Clicking a subnode shows inline recipe card with links
6. SVG dependency lines appear between left and right columns
7. Hovering a node highlights its dependency lines
8. Mode tabs switch between survival/soldier/management
9. Search filters nodes across tiers
10. `/tech-tree/primitive-tool` deep-links correctly
11. Guardian armor section appears at the bottom

- [ ] **Step 3: Fix any visual issues found during testing**

Adjust spacing, colors, line positions as needed. Common things to check:
- SVG lines recompute when accordion expands
- Horizontal scroll works for all 6 tiers
- Search dimming looks correct
- Recipe cards link through to `/item/:id` correctly

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Layout.tsx
git commit -m "feat: add Tech Tree nav link"
```

---

### Task 11: Link from item detail to tech tree

**Files:**
- Modify: `web/src/components/TechUnlock.tsx`

- [ ] **Step 1: Make tech unlock entries link to the tech tree page**

The existing `TechUnlock.tsx` displays tech node names. Wrap them in `<Link to={/tech-tree/${slug}>}` so users can navigate from item detail → tech tree.

Check the current component, then add `Link` wrappers around the tech node name display. The slug is available as the tech node's English name, slugified. Since the backend doesn't currently return slugs in the `TechUnlock` struct, compute the slug client-side:

```tsx
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

Wrap the tech name with:

```tsx
<Link to={`/tech-tree/${slugify(name)}`} className="hover:text-teal-400 transition-colors">
  {name}
</Link>
```

- [ ] **Step 2: Test in browser**

Navigate to an item page that has tech unlocks. Click the tech node name. Verify it navigates to `/tech-tree/:slug` and the node is highlighted/expanded.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TechUnlock.tsx
git commit -m "feat: link tech unlocks on item page to tech tree viewer"
```

---

### Task 12: Update changelog

**Files:**
- Modify: `web/src/pages/Home.tsx`

- [ ] **Step 1: Add changelog entry**

Find the `CHANGELOG` array in `Home.tsx` and add at the top:

```typescript
{ date: '2026-04-28', text: 'Browse the full tech tree with tier groupings, dependency lines, and recipe previews' },
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Home.tsx
git commit -m "chore: add tech tree viewer to changelog"
```
