# Tech tree viewer

**Goal:** New `/tech-tree` page that visualizes the full Knowledge & Technology tree from the game, matching the in-game multi-column tier layout with collapsible subnodes and dependency lines.

**Tech stack:** React + TypeScript (existing webapp), Go backend API (existing), SVG for dependency lines.

---

## Layout

Each game mode (survival, soldier, management) has its own tree, switchable via tabs at the top.

### Tier columns

The tree is divided into 6 tiers, each defined by a bonfire prerequisite in the data:

| Tier               | Bonfire ID              | Awareness | Nodes (survival) |
|--------------------|-------------------------|-----------|-------------------|
| Campfire           | BP_KJS_GZT_GouHuo      | 1         | 15 (11L + 4R)     |
| Bonfire            | BP_KJS_GZT_YingHuo     | 5         | 16 (10L + 6R)     |
| Bronze Pit Bonfire | BP_KJS_GZT_YingHuo_2   | 20        | 22 (12L + 10R)    |
| Black Iron         | BP_KJS_GZT_YingHuo_3   | 35        | 16 (11L + 5R)     |
| Steel              | BP_KJS_GZT_YingHuo_4   | 50        | 13 (8L + 5R)      |
| Fine Steel         | BP_KJS_GZT_YingHuo_5   | 60        | 4 (4L + 0R)       |

**Tier assignment algorithm:** Walk each main node's `prerequisite_main_nodes` chain to find the highest-tier bonfire in its ancestry. That bonfire determines its tier column.

10 "Guardian armor" main nodes have no bonfire prereqs — display them in a separate section below the main tree.

### Two-column layout within each tier

Within each tier, main nodes are split into two columns:
- **Left column:** nodes whose only bonfire-tier prereq is the tier bonfire itself (root nodes within the tier)
- **Right column:** nodes that depend on another non-bonfire node in the same tier

SVG bezier curves connect left-column nodes to their right-column dependents. Lines are drawn from the right edge of the source node to the left edge of the target node.

Sort both columns by `required_mask_level` ascending.

**Chains longer than 2:** Some right-column nodes depend on other right-column nodes (e.g. Bonfire tier: Premium Food → Drying Technique → Brewing Technique). These stay in the right column, sorted by level. Lines connect each pair in the chain, stacking vertically. The left/right split handles direct bonfire-only prereqs vs everything else — it's not strictly "depth 1 vs depth 2".

### Collapsible main nodes (accordion)

Each main node is a collapsible row. Collapsed state shows: name, subnode count badge. Expanded state shows subnodes listed vertically inside the accordion body.

### Subnode detail (inline expand)

Clicking a subnode expands an inline card below it showing:
- Subnode name
- Awareness requirement
- Tech point cost
- Prerequisite chain (if any)
- List of unlocked recipes, each as a small card with: item name, ingredient summary, and a link arrow (`→`) to `/item/:id`

Only one subnode detail can be open at a time within an accordion.

## Interactions

### Mode tabs

Three tabs: Survival / Soldier / Management. Switching mode re-renders the tree with nodes from `main`/`sub`, `main_action`/`sub_action`, or `main_management`/`sub_management` categories respectively. Default to survival.

### Search

Search bar in the top bar. Filters across all main node and subnode names. Matching:
- Highlight and expand matching main nodes
- Scroll to the first match's tier
- Dim non-matching nodes

### Hover highlighting

Hovering a main node brightens its incoming and outgoing dependency lines and dims all other lines. This works both within a tier and could extend cross-tier if useful.

### Deep linking

URL pattern: `/tech-tree/:slug` (e.g. `/tech-tree/basic-building`).

On navigation:
1. Determine which tier the node belongs to
2. Scroll that tier into view
3. Expand the main node's accordion
4. Highlight the node with a visible border/glow

Slugs are derived from the English name (lowercase, hyphenated). Both main nodes and subnodes are linkable. From other pages (e.g. item detail), the existing `tech_unlocked_by` data can link to `/tech-tree/:slug`.

## Dependency lines (SVG)

An SVG overlay is positioned absolutely over the tier's two-column flex container. Lines are computed from DOM measurements of each main-node element's bounding rect.

- Default: low-opacity bezier curves (~0.3 alpha)
- On hover: highlighted lines go to full opacity, non-related lines dim to ~0.1
- On accordion expand/collapse: recompute positions via `requestAnimationFrame`
- Line color: `#5BC477` (green accent)

## Data

### Backend API

New endpoint: `GET /api/tech-tree`

Returns the full tech tree grouped by mode, with tier assignments precomputed:

```json
{
  "tiers": [
    {
      "id": "BP_KJS_GZT_GouHuo",
      "name": "Campfire",
      "awareness_level": 1,
      "nodes": {
        "left": [
          {
            "id": "BP_KJS_...",
            "name": "Basic Building",
            "awareness_level": 1,
            "sub_nodes": [
              {
                "id": "BP_KJS_SubNode_...",
                "name": "Thatch Foundation",
                "points": 1,
                "unlocks_recipes": [
                  { "id": "BP_PeiFang_...", "name": "Thatch Foundation", "item_id": "..." }
                ]
              }
            ]
          }
        ],
        "right": [
          {
            "id": "...",
            "name": "Basic Carpentry",
            "awareness_level": 3,
            "depends_on": ["BP_KJS_..."],
            "sub_nodes": [...]
          }
        ]
      }
    }
  ],
  "untiered": [...]
}
```

Three variants of this response for survival/soldier/management, selected by `?mode=survival|soldier|management` query param.

### English translations

Tech tree data currently only has Chinese names (`name_zh`). English names are sourced from:
1. **soulmaskdatabase.com scrape:** 95 main node names, 317 subnode names already captured in `.superpowers/brainstorm/scraped_tech_names.json`
2. **Claude-assisted zh→en:** remaining ~100 nodes without scrape matches

Translation is stored in `data/translations/tech_tree_names.json` keyed by node ID. The parser (`parse_tech_tree.py`) or `build_db.py` joins English names at build time.

## Components

New files:
- `web/src/pages/TechTree.tsx` — page component, data fetching, mode tabs, search
- `web/src/components/TechTier.tsx` — single tier column with left/right layout + SVG lines
- `web/src/components/TechNode.tsx` — collapsible main node accordion
- `web/src/components/TechSubNode.tsx` — subnode row + inline recipe detail
- `web/src/components/TechRecipeCard.tsx` — small recipe preview card (reuse existing recipe display patterns)

Backend:
- New handler in `server/` for `/api/tech-tree` endpoint
- New SQL query or in-memory computation for tier grouping

## Styling

- Dark background (`#16212B`) for the tree area, matching in-game feel
- Tier headers: teal (`#327D7B`) background, white text
- Node borders: `#333` default, `#5BC477` when expanded
- Subnode detail card: `#1e2d38` background, teal border
- Recipe links: teal text with `→` arrow
- Mode tabs: teal active, dark inactive
- Horizontal scroll for the tier container on smaller viewports

## Out of scope

- Interactive "planner" (checking off learned techs, tracking points spent)
- Subnode prerequisite chains between subnodes (the `auto_learn_sub_nodes` field)
- Cross-tier dependency lines (only within-tier lines for now)
- Mobile-optimized layout (horizontal scroll works but isn't ideal)
