# Interactive spawn / resource map

## Summary

Map overlay showing creature spawn points, resource nodes, and points of interest with filtering by creature type, resource, and region.

## Demand evidence

**Reddit (r/SoulmaskGame)** — location questions are frequent:
- "Where do I find alpacas/llamas/jaguars/ostriches/snow leopards?"
- "Best location for Bloodstone/Talc/Asbestos?"
- "Where are the elite spawns on Shifting Sands?"
- Mount taming threads almost always include "where do I find them?" as the first question

**Steam guides** — several popular guides are just annotated screenshots of the map marking resource locations, indicating players need this and will use whatever format is available.

**YouTube** — "Soulmask [creature/resource] location" videos are a common format, many with 10K+ views for specific creatures.

**Key insight:** spawn/resource location is a constant need, but this is also the most competitive space — two tools already have decent maps.

## Competitor landscape

| Tool                  | Map? | Filtering? | Coverage |
| --------------------- | ---- | ---------- | -------- |
| soulmaskdatabase.com  | Yes  | Yes        | Good — creatures, resources, POIs |
| saraserenity.net      | Yes  | Basic      | Good — creatures and resources |

Both existing maps are functional. Our 65K spawn entries may offer more complete coverage (especially for Shifting Sands DLC content and elite spawns), but the differentiation is incremental rather than categorical.

## What we have

- `spawns.json` — 65K spawn entries with coordinates, creature type, spawner class
- `spawn_locations.json` — mapped location metadata
- Spawn maps already rendered on item detail pages (per-creature)
- Cloud & Mist and Shifting Sands regions both covered

## Feature ideas

**Core map:**
- Full-screen interactive map (Leaflet or similar)
- Filter by creature type, resource, region
- Click spawn point → see creature details, drop table link
- Toggle between Cloud & Mist and Shifting Sands

**Nice to have:**
- Route planner — "I need X, Y, Z — show me an efficient path"
- Cluster view for dense spawn areas
- Heat map mode showing spawn density
- Deep-link from item detail pages ("show me on map")

## Effort estimate

Medium-high (5-7 days). Needs map tile setup, coordinate system mapping (game coords → map pixels), Leaflet integration, and filtering UI. The per-creature spawn maps on item pages already prove the coordinate mapping works, which reduces risk.

## Recommendation

Lower priority than tech tree planner or drop rates given existing competition. Consider building this after the unique-value features are shipped, or focus specifically on areas where competitors are weak (Shifting Sands coverage, elite spawns, ruins spawns).
