import type { Graph, Item, Recipe } from './types'

export function indexItems(g: Graph): Map<string, Item> {
  return new Map(g.items.map(i => [i.id, i]))
}

export function indexItemsBySlug(g: Graph): Map<string, Item> {
  const m = new Map<string, Item>()
  for (const i of g.items) {
    if (i.s) m.set(i.s, i)
  }
  return m
}

export function resolveItem(g: Graph, slugOrId: string): Item | undefined {
  return g.items.find(i => i.s === slugOrId) ?? g.items.find(i => i.id === slugOrId)
}

export function itemPath(item: Item): string {
  return `/item/${item.s ?? item.id}`
}

/** True for items with no recipe to expand into — raw materials and standalone
 *  drops/cosmetics. Use this for traversal terminators and "no children" UI. */
export function noRecipe(item: Item): boolean {
  return item.role === 'raw' || item.role === 'standalone'
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

/** Does this item's "used-in" tree reach a non-intermediate item whose category is in `cats`? */
export function hasMatchingFinal(
  g: Graph, byId: Map<string, Item>, usedInIdx: Map<string, string[]>,
  id: string, cats: Set<string>, depth = 0
): boolean {
  const item = byId.get(id)
  if (!item || depth > 4) return false
  if (item.role !== 'intermediate') return cats.has(item.cat ?? 'other')
  const seen = new Set<string>()
  for (const rid of usedInIdx.get(id) ?? []) {
    const r = g.recipes.find(rr => rr.id === rid)
    if (!r || seen.has(r.out)) continue
    seen.add(r.out)
    if (hasMatchingFinal(g, byId, usedInIdx, r.out, cats, depth + 1)) return true
  }
  return false
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
    if (noRecipe(item)) {
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
