# NPC / tribesman evaluator

## Summary

Tool to help players evaluate tribesman potential — proficiency caps, hidden talents, optimal tribe composition for combat vs crafting roles.

## Demand evidence

**Reddit (r/SoulmaskGame)** — tribesman management is a recurring topic:
- "How do I evaluate tribesman potential before recruiting?"
- "What proficiency caps should I look for?"
- "Which tribes produce the best combat followers vs crafters?"
- The "Golden Legend Mask trick" for scouting NPC stats is shared as tribal knowledge — indicates players want to optimize recruitment but lack tools
- "How to increase tribe size beyond the cap of 3-18?"
- Posts about followers dying instantly to bosses due to hidden dynamic difficulty scaling with group size

**Steam guides** — taming and tribesman management guides are popular, covering:
- How to read the stat screen
- What the color tiers mean for NPC quality
- Which stats matter for which roles

**Key insight:** tribesman optimization is a deep system that players engage with heavily in mid-to-late game, but it's poorly documented. The "Golden Legend Mask trick" being passed around as folk knowledge shows the information gap.

## Competitor gap

| Tool                  | NPC/tribesman data? |
| --------------------- | ------------------- |
| soulmaskdatabase.com  | No                  |
| saraserenity.net      | No                  |
| Fextralife wiki       | Basic guides        |
| Fandom wiki           | Partial creature list |

No tool offers structured tribesman evaluation data.

## What we have

Currently: **limited**. Our data extraction focuses on items, recipes, tech tree, and drops. Tribesman stat tables, proficiency cap formulas, and talent definitions would need new data extraction from the modkit.

## Open questions

- Are tribesman stat tables / proficiency data in the modkit DataTables we haven't exported yet?
- Is the data in Blueprint assets we haven't parsed?
- Would this require entirely new export paths from UE4Editor?
- How much of this is deterministic data (cap formulas, talent definitions) vs runtime RNG?

## Feature ideas (if data becomes available)

**Core evaluator:**
- Input tribesman stats → see proficiency caps and role recommendations
- Talent database with descriptions and synergies
- "Is this tribesman worth recruiting?" quick check

**Nice to have:**
- Tribe composition planner — optimal mix of combat/crafting/gathering roles
- Proficiency training calculator — how long to max a skill
- Comparative view — paste two tribesman stat screenshots, see which is better

## Effort estimate

High uncertainty. If the data exists in unexported DataTables: medium effort (3-5 days for extraction + UI). If it requires new modkit work or reverse-engineering: significantly more, and blocked on Windows modkit access.

## Recommendation

Park this until we can verify what tribesman data is extractable. High player interest but highest feasibility risk of all proposed features.
