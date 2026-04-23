import { describe, it, expect } from 'vitest'
import { computeRawMats, buildUsedInIndex, qtyNeeded, primaryRecipeFor } from './graph'
import type { Graph } from './types'

function makeGraph(): Graph {
  return {
    items: [
      { id: 'ore',     n: 'Ore',     nz: null, cat: 'raw',  role: 'raw' },
      { id: 'wood',    n: 'Wood',    nz: null, cat: 'raw',  role: 'raw' },
      { id: 'ingot',   n: 'Ingot',   nz: null, cat: null,   role: 'final' },
      { id: 'pickaxe', n: 'Pickaxe', nz: null, cat: null,   role: 'final' },
    ],
    recipes: [
      { id: 'r_ingot', out: 'ingot', outQ: 1, groups: [
        { kind: 'all', items: [{ id: 'ore', q: 2 }] },
      ] },
      { id: 'r_pick', out: 'pickaxe', outQ: 1, groups: [
        { kind: 'all', items: [{ id: 'ingot', q: 3 }, { id: 'wood', q: 2 }] },
      ] },
    ],
    stations: [],
  }
}

describe('computeRawMats', () => {
  it('sums transitive raw inputs', () => {
    const mats = computeRawMats(makeGraph(), 'pickaxe', 1)
    expect(mats).toEqual({ ore: 6, wood: 2 })
  })
  it('scales by qty', () => {
    const mats = computeRawMats(makeGraph(), 'pickaxe', 3)
    expect(mats).toEqual({ ore: 18, wood: 6 })
  })
  it('handles one_of groups using orSel', () => {
    const g = makeGraph()
    g.recipes[0].groups = [
      { kind: 'all', items: [{ id: 'wood', q: 1 }] },
      { kind: 'one_of', items: [{ id: 'ore', q: 2 }, { id: 'wood', q: 5 }] },
    ]
    expect(computeRawMats(g, 'ingot', 1)).toEqual({ wood: 1, ore: 2 })
    expect(computeRawMats(g, 'ingot', 1, { 'r_ingot:1': 1 })).toEqual({ wood: 6 })
  })
})

describe('buildUsedInIndex', () => {
  it('indexes all consuming recipes per item', () => {
    const idx = buildUsedInIndex(makeGraph())
    expect(idx.get('ore')).toEqual(['r_ingot'])
    expect(idx.get('ingot')).toEqual(['r_pick'])
    expect(idx.get('wood')).toEqual(['r_pick'])
  })
})

describe('qtyNeeded', () => {
  it('finds quantity by input id', () => {
    const g = makeGraph()
    expect(qtyNeeded(g.recipes[1], 'ingot')).toBe(3)
    expect(qtyNeeded(g.recipes[1], 'ore')).toBe(null)
  })
})

describe('primaryRecipeFor', () => {
  it('returns the first recipe with matching output', () => {
    expect(primaryRecipeFor(makeGraph(), 'ingot')?.id).toBe('r_ingot')
    expect(primaryRecipeFor(makeGraph(), 'ore')).toBeUndefined()
  })
  it('prefers non-_Split variants', () => {
    const g = makeGraph()
    g.recipes.unshift({
      id: 'r_ingot_Split', out: 'ingot', outQ: 1,
      groups: [{ kind: 'all', items: [{ id: 'wood', q: 99 }] }],
    })
    expect(primaryRecipeFor(g, 'ingot')?.id).toBe('r_ingot')
  })
})
