# Tech tree planner

## Summary

Interactive planner where players toggle tech nodes on/off, see cumulative point cost, remaining budget per mask level, and understand what they gain or lose from each choice. The tech tree is too large to unlock everything — build planning is essential.

## Demand evidence

**Reddit (r/SoulmaskGame)** — frequent posts asking:
- "What should I research first?"
- "I wasted my tech points, is there a reset?"
- "What's the optimal tech path for [solo/PvP/PvE]?"
- Players sharing their personal tech tree priorities as text lists, indicating demand for a visual tool
- Questions about what specific nodes unlock and whether prerequisites are worth the cost

**Steam guides** — multiple community guides dedicated entirely to tech tree priority ordering, with hundreds of favorites. These are static text lists that go stale with patches.

**Discord** — tech tree build discussions are a staple topic, with players asking for advice on which branches to prioritize for different playstyles.

**Key insight:** the tech tree is one of Soulmask's most complex systems. Players can't see the full picture in-game and can't undo choices. A planner directly reduces the biggest source of regret in character progression.

## Competitor gap

| Tool                  | Tech tree viewer? | Planner/budgeter? |
| --------------------- | ----------------- | ------------------ |
| soulmaskdatabase.com  | Yes (773 nodes)   | No                 |
| Fextralife wiki       | Category lists     | No                 |
| Fandom wiki           | Partial            | No                 |

soulmaskdatabase.com shows nodes in an expandable tree with 35 mask levels but offers no way to select nodes, track point spend, or simulate a build. A planner would be a clear differentiator.

## What we have

- `tech_tree.json` — 17.5K nodes with:
  - Prerequisites and dependency chains
  - Mask level gating (which level unlocks which tier)
  - Point costs per node
  - Unlocked recipes per node (cross-referenced to `recipes.json`)
  - Node descriptions (Chinese, with some English)
- Full recipe → item cross-references already working

## Feature ideas

**Core planner:**
- Visual tree with toggleable nodes
- Running point budget counter per mask level
- "What does this unlock?" preview (recipes, items)
- Prerequisite highlighting (selecting a node auto-selects its prereqs)
- Shareable build URLs (encode selected nodes in query params)

**Nice to have:**
- Preset builds (solo PvE, PvP meta, crafter-focused)
- "What am I giving up?" — show what remains unlockable given current selections
- Diff view — compare two builds side by side
- Import from game (if save data is accessible)

## Effort estimate

Medium-high (5-7 days). The data is complete and well-structured. Main complexity is the interactive UI — tree visualization, toggle state management, budget calculations, and URL serialization for sharing.
