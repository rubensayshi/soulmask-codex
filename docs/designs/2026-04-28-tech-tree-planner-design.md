# Tech tree planner design

**Goal:** Add a planner mode to the existing tech tree page that lets players toggle individual sub-nodes on/off, see cumulative point costs, get a level estimate, and share builds via URL.

**Architecture:** Pure client-side state layered on the existing tech tree viewer. A `Set<string>` of selected sub-node IDs drives point calculations, prerequisite validation, URL encoding, and the recipe summary panel. One backend change: expose sub→sub prerequisites in the API response.

**Tech stack:** React state + existing tech tree API + base64url hash encoding. No new backend endpoints or persistence.

---

## 1. Page structure

Planner mode is a toggle on the existing `/tech-tree` page, not a separate route.

**When planner is off:** page works exactly as the current viewer — browse, search, expand nodes, follow deep links.

**When planner is on**, three additions:

1. **Planner toggle button** in the sticky header bar (next to search). Green "Planner ON" / muted "Planner OFF".
2. **Budget bar** — second sticky row below the header. Shows: points spent, node count, progress bar, estimated level + tablets, share button, clear button.
3. **Recipe summary panel** — below the tree (full width). Grid of all recipes unlocked by selected nodes.

The tree itself gains selection affordances: sub-nodes become clickable with checkmark indicators when selected.

## 2. Selectable unit

Individual **sub-nodes** are the selectable unit. Main nodes are visual groupings — not directly selectable. When a main node is expanded, its sub-nodes each show a toggle/checkbox.

Main node headers show selection state: "3/5 selected" when partially filled.

## 3. Prerequisite model

Three types of prerequisites exist in the data:

| Relationship | Count | Example |
|---|---|---|
| Main → Main | 164 | Iron Working requires Bronze Smelt |
| Sub → Main | 506 | Sub-node requires its parent main node |
| Sub → Sub | 229 | Sequential chains: `_1` → `_2` → `_3` |

**Current state:** sub→sub prereqs exist in `Game/Parsed/tech_tree.json` (`prerequisite_sub_nodes` field) but are not stored in the database or API response. The backend needs to expose them.

### Backend change

Add sub→sub prerequisites to the data pipeline and API:

1. **`build_db.py`**: store `prerequisite_sub_nodes` in the `tech_node_prerequisites` table (they're already parsed, just not persisted).
2. **API response**: add `depends_on` field to `TechSubNode` — array of prerequisite sub-node IDs.

### Selection rules

**Selecting a sub-node** with unmet prerequisites:
1. Walk the sub→sub chain upward (e.g., clicking `_3` collects `_2` and `_1`).
2. Check that the parent main node's main→main dependency chain is satisfied (all ancestor main nodes have at least one selected sub-node).
3. Collect all prerequisite sub-nodes and unsatisfied main nodes (picking their cheapest sub-node as the minimum).
4. Show confirmation dialog listing all nodes that will be auto-selected, with total point cost.
5. Confirm → select entire chain. Cancel → nothing.

**Deselecting a sub-node:**
1. Check if removing this sub-node leaves its main node with zero selections, and if downstream main nodes depend on it.
2. Collect all downstream selected sub-nodes that would become orphaned.
3. Show confirmation dialog listing removals and points recovered.
4. Confirm → deselect entire chain. Cancel → nothing.

**Zero-cost sub-nodes:** some main nodes (bonfires, Primitive Tool, etc.) have sub-nodes with no point cost. These are auto-learned in-game and treated as automatically satisfied in the planner — they don't need to be selected and don't appear as toggleable. A main node dependency is considered "met" if it only contains zero-cost sub-nodes (i.e., it's a bonfire/base node).

**Grayed-out nodes:** sub-nodes whose main node's dependency chain is not met are visually dimmed and show a tooltip explaining what's needed. They're still clickable (triggers the prerequisite confirmation flow).

## 4. Point budget model

All client-side constants. Shown as an estimate, not exact.

**Points from leveling:** 6 per awareness level (levels 1-60 = 360 max).

**Points from tablets (70% collection rate, ~120 total):**

| Level range | Tablet points gained | Cumulative |
|---|---|---|
| 1-20 | 20 | 20 |
| 20-30 | 20 | 40 |
| 30-35 | 13 | 53 |
| 35-40 | 13 | 66 |
| 40-45 | 13 | 79 |
| 45-50 | 14 | 93 |
| 50-55 | 13 | 106 |
| 55-60 | 14 | 120 |

**Cumulative points at level X** = `(X × 6) + tabletPointsAtLevel(X)`

**Budget bar display:** `42 pts · 12 nodes ·  [████░░░░░░] · ≈ Level 25 + ~12 tablets · Share · Clear`

The progress bar fills based on points spent relative to max available at level 60 (~480).

Given a build's total point cost, we solve for the minimum level where cumulative points >= cost and display: "≈ Level X + ~Y tablets".

## 5. URL hash encoding

Shareable builds encoded entirely in the URL hash — no backend persistence.

**Encoding:**
1. Build a stable sorted list of all sub-node IDs for the current mode.
2. Create a bitfield — one bit per sub-node (1 = selected).
3. Prepend a mode byte: `s` (survival), `w` (warrior), `t` (tribe).
4. Base64url encode → `#build=sABc3f...`

**Decoding on page load:**
1. Parse mode byte, set mode.
2. Decode bitfield, map bit positions back to sub-node IDs using the same stable sort.
3. Restore selections, activate planner mode.

**Robustness:**
- New nodes added by game patches → old URLs decode correctly (new nodes default unselected, they'll be appended to the sorted list).
- Removed nodes → unknown bits silently ignored.
- Typical build (~50 selected of ~380 sub-nodes) → ~60-70 char hash. Short enough for Discord/Reddit.

**Share button** copies the full URL to clipboard with a brief toast confirmation.

## 6. Recipe summary panel

Full-width section below the tech tree, visible only in planner mode.

**Layout:** responsive grid (4 columns on desktop, 2 on mobile). Each card shows:
- Item icon (from `TechRecipeLink.item_icon`)
- Item name (from `TechRecipeLink.item_name`)
- Source tech node name (which sub-node unlocked it)
- Click → navigate to `/item/:slug`

**Grouping:** recipes grouped by tier (Campfire, Bonfire, Bronze Pit, etc.) with tier headers. Tier determined by which tier the source main node belongs to.

**Empty state:** "Select tech nodes above to see unlocked recipes."

**Data source:** each `TechSubNode` in the API response already has a `recipes` array with `item_name`, `item_icon`, `item_slug`. No extra API call needed.

## 7. State management

All planner state lives in the `TechTree` page component:

| State | Type | Purpose |
|---|---|---|
| `plannerMode` | `boolean` | Toggle planner on/off |
| `selectedNodeIds` | `Set<string>` | Selected sub-node IDs |
| `confirmDialog` | `{type, nodes, points} \| null` | Prerequisite/deselect confirmation |

**Derived values (useMemo):**
- Total points spent (sum of `points` for selected sub-nodes — `TechSubNode.points` maps to `consume_points` in the DB)
- Estimated level + tablets (from budget model)
- Unlocked recipes (flatmap selected sub-nodes' recipe arrays)
- Prerequisite satisfaction map (which main nodes are "met")

**State flow:**
1. User clicks sub-node → check prerequisites → show dialog or toggle directly
2. On confirm → update `selectedNodeIds` → derived values recompute → budget bar and recipe panel update
3. On selection change → serialize to URL hash
4. On page load with hash → deserialize → restore selections + planner mode

## 8. Component changes

**Existing components modified:**

| Component | Changes |
|---|---|
| `TechTree.tsx` | Add `plannerMode`, `selectedNodeIds` state. Budget bar. Recipe panel. URL hash sync. Confirmation dialog. |
| `TechNode.tsx` | Accept `plannerMode`, `selectedIds`, `onSelectSub` props. Show selection indicators on sub-nodes. Show "3/5 selected" on main node header. |
| `TechSubNode.tsx` | Accept `isSelected`, `onToggle`, `plannerMode` props. Clickable toggle, checkmark indicator. |
| `TechTier.tsx` | Pass planner props through to TechNode. |

**New components:**

| Component | Purpose |
|---|---|
| `PlannerBudgetBar.tsx` | Sticky budget bar: points, progress, level estimate, share, clear |
| `PlannerRecipePanel.tsx` | Recipe summary grid below tree |
| `PlannerConfirmDialog.tsx` | Prerequisite/deselect confirmation modal |

**Backend changes:**

| File | Change |
|---|---|
| `pipeline/build_db.py` | Persist `prerequisite_sub_nodes` to `tech_node_prerequisites` table |
| `backend/internal/api/tech_tree.go` | Add `depends_on` field to `TechSubNode` JSON response |
| `web/src/lib/types.ts` | Add `depends_on?: string[]` to `TechSubNode` type |

## 9. Non-goals for v1

- No backend persistence of builds (URL hash only)
- No import from game saves
- No preset builds (solo PvE, PvP, crafter)
- No "what am I missing" view
- No build comparison/diff
- No per-tier budget breakdown (just total)
