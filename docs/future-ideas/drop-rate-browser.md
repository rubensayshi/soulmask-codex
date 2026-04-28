# Loot drop rate browser

## Summary

Expose actual drop probabilities from game data so players can see exactly how likely each item is to drop from each source, with quantity ranges.

## Demand evidence

**Reddit (r/SoulmaskGame)** — "where do I find X?" is one of the most common post types:
- "Best place to farm Bloodstone?"
- "Where do rare mount saddle blueprints drop?"
- "Is X boss worth farming or should I farm Y instead?"
- Players sharing anecdotal drop rates ("I killed 50 of X and got 3 of Y") because no authoritative source exists

**Steam Community** — loot-related questions are a top category:
- Drop rate comparisons between creature types
- Whether difficulty/area affects drop quality
- Chest vs creature vs gathering node probabilities

**Fandom/Fextralife wikis** — list drop sources but without probabilities. Typical entry: "Drops from: Wolf, Bear, Chest" with no percentages or quantity info. Players in comments asking "but what's the actual drop rate?"

**Key insight:** players make farming decisions (which creature to grind, which area to explore) based on incomplete information. Actual probabilities would directly improve their gameplay efficiency.

## Competitor gap

| Tool                  | Lists drop sources? | Shows probabilities? | Shows quantities? |
| --------------------- | ------------------- | -------------------- | ----------------- |
| soulmaskdatabase.com  | Yes                 | No                   | No                |
| saraserenity.net      | Partial             | No                   | No                |
| Fextralife wiki       | Yes                 | No                   | No                |
| Fandom wiki           | Partial             | No                   | No                |

We would be the only tool showing actual game-data probabilities.

## What we have

- `drops.json` — 206K entries with:
  - Source creature/container
  - Item dropped
  - Probability groups (weighted random selection)
  - Quantity ranges (min/max per drop)
  - Drop table hierarchy (which table feeds which)
- Already partially surfaced on item detail pages via "Obtained From" section

## Feature ideas

**Core browser:**
- On item detail pages: expand "Obtained From" to show actual % chance and quantity range
- Sortable by probability (best farming spot first)
- Filter by source type (creature, chest, gathering, boss)

**Standalone page:**
- "What does X creature drop?" — reverse lookup, see full loot table for a creature
- Drop table comparison — compare two farming sources side by side
- "Best source for X material" — ranked by expected items per kill

## Effort estimate

Low-medium (1-3 days). Data is complete and already partially integrated. Main work is UI enhancement on item detail pages and optionally a standalone loot table browser page.
