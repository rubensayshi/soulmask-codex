# Damage / stat calculator

## Summary

Interactive calculator that lets players input weapon, quality tier, proficiency level, and character stats to see predicted damage output. No existing community tool offers this.

## Demand evidence

**Steam Community** — thread titled "How to calculate Detailed Stats ATK and Weapon Damage?" with players attempting to reverse-engineer the formula collaboratively. No consensus reached. Multiple replies with competing theories about how ATK, weapon multipliers, agility bonuses, and proficiency bonuses combine.

**Reddit (r/SoulmaskGame)** — recurring questions about:
- How quality tiers (White/Green/Blue/Purple/Yellow/Orange) scale weapon damage
- Whether agility or strength matters more for specific weapon types
- How proficiency bonuses from tribesmen affect actual DPS
- What the "detailed stats" screen numbers actually mean

**YouTube** — several creators have done empirical damage testing videos, indicating strong viewer interest but no definitive answer. Comments sections are full of follow-up questions.

**Key insight:** this is the #1 most-requested missing tool across all Soulmask communities. Players have been trying to figure this out since early access launch and still can't.

## Competitor gap

| Tool                  | Damage calc? |
| --------------------- | ------------ |
| soulmaskdatabase.com  | No           |
| saraserenity.net      | No           |
| Fextralife wiki       | No           |
| Fandom wiki           | No           |

Nobody has built this. First mover advantage is significant.

## What we have

- `prop_packs.json` — property bundles for equipment with base stats per quality tier
- `items.json` — weapon/armor entries with category, stats, durability
- Quality tier previews already implemented on item detail pages

## Open questions

- Do we have enough data in `prop_packs.json` to derive the full combat formula, or would empirical testing be needed?
- What stat fields exist in prop packs — is it just base damage, or do we have multipliers, scaling coefficients?
- Should this be a standalone calculator page or integrated into item detail pages?
- Scope: weapons only first, or include armor damage reduction from day one?

## Effort estimate

High uncertainty. If the formula is derivable from game data: medium effort (3-5 days). If it requires empirical testing / community collaboration to nail down the formula: much longer, and the calculator would ship with "best guess" caveats initially.
