import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import type { Recipe, Item } from '../lib/types'

const TIERS: { lvl: number | null; label: string }[] = [
  { lvl: null, label: 'Stone' },
  { lvl: 1, label: 'Bone' },
  { lvl: 2, label: 'Bronze' },
  { lvl: 3, label: 'Iron' },
  { lvl: 4, label: 'Steel' },
]

const SKILLS = [
  'Alchemy', 'Armor Crafting', 'Cooking', 'Craftsman', 'Kiln',
  'Leatherworking', 'Plant', 'Potting', 'Weapon Crafting', 'Weaving', 'Wood & Stone',
]

type RoleFilter = 'all' | 'final' | 'intermediate'

interface Row {
  recipe: Recipe
  item: Item
  xpPerSec: number
}

function tierLabel(lvl: number | null | undefined): string {
  return TIERS.find(t => t.lvl === (lvl ?? null))?.label ?? '?'
}

export default function AwarenessXp() {
  const graph = useStore(s => s.graph)
  const status = useStore(s => s.graphStatus)

  const [tierFilter, setTierFilter] = useState<Set<number | null>>(() => new Set(TIERS.map(t => t.lvl)))
  const [skillFilter, setSkillFilter] = useState<Set<string>>(() => new Set(SKILLS))
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  const itemById = useMemo(
    () => graph ? new Map(graph.items.map(i => [i.id, i])) : new Map<string, Item>(),
    [graph],
  )

  const rows = useMemo(() => {
    if (!graph) return []
    const result: Row[] = []
    for (const r of graph.recipes) {
      if (!r.awXp || !r.t || r.t <= 0) continue
      const item = itemById.get(r.out)
      if (!item) continue
      result.push({ recipe: r, item, xpPerSec: r.awXp / r.t })
    }
    result.sort((a, b) => b.xpPerSec - a.xpPerSec)
    return result
  }, [graph, itemById])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const lvl = r.recipe.lvl ?? null
      if (!tierFilter.has(lvl)) return false
      if (r.recipe.prof && r.recipe.prof !== 'None' && !skillFilter.has(r.recipe.prof)) return false
      if (roleFilter !== 'all' && r.item.role !== roleFilter) return false
      return true
    })
  }, [rows, tierFilter, skillFilter, roleFilter])

  if (status === 'loading' || !graph) return <div className="p-8 text-text-dim">Loading...</div>

  const toggleTier = (lvl: number | null) => {
    setTierFilter(prev => {
      const next = new Set(prev)
      next.has(lvl) ? next.delete(lvl) : next.add(lvl)
      return next
    })
  }

  const toggleSkill = (s: string) => {
    setSkillFilter(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="font-display text-[24px] font-semibold text-text tracking-[.03em] mb-1">
        Top Awareness XP
      </h1>
      <p className="text-[12px] text-text-mute mb-5">
        Recipes ranked by awareness XP per second of craft time.
      </p>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6 p-4 bg-panel border border-hair">
        {/* Tier */}
        <FilterRow label="Tier">
          {TIERS.map(t => (
            <Toggle key={String(t.lvl)} label={t.label} active={tierFilter.has(t.lvl)} onClick={() => toggleTier(t.lvl)} />
          ))}
        </FilterRow>

        {/* Skill */}
        <FilterRow label="Skill">
          {SKILLS.map(s => (
            <Toggle key={s} label={s} active={skillFilter.has(s)} onClick={() => toggleSkill(s)} />
          ))}
        </FilterRow>

        {/* Role */}
        <FilterRow label="Type">
          <Toggle label="All" active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} />
          <Toggle label="Final" active={roleFilter === 'final'} onClick={() => setRoleFilter('final')} />
          <Toggle label="Intermediate" active={roleFilter === 'intermediate'} onClick={() => setRoleFilter('intermediate')} />
        </FilterRow>
      </div>

      {/* Table */}
      <div className="text-[12px]">
        <div className="grid grid-cols-[1fr_80px_70px_70px_80px_80px] gap-x-3 px-3 py-2 border-b border-hair-strong text-text-dim uppercase tracking-[.1em] text-[10px] font-medium">
          <span>Item</span>
          <span className="text-right">XP/s</span>
          <span className="text-right">XP</span>
          <span className="text-right">Time</span>
          <span className="text-right">Tier</span>
          <span className="text-right">Skill</span>
        </div>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-text-dim italic">No recipes match the current filters.</div>
        )}
        {filtered.map((r, i) => (
          <Link
            key={r.recipe.id}
            to={`/item/${r.item.id}`}
            className={`grid grid-cols-[1fr_80px_70px_70px_80px_80px] gap-x-3 px-3 py-[7px] items-center border-b border-hair hover:bg-green-bg transition-colors ${i % 2 === 0 ? 'bg-panel' : ''}`}
          >
            <span className="text-text truncate">{r.item.n ?? r.item.nz ?? r.item.id}</span>
            <span className="text-right text-green-hi font-medium tabular-nums">{r.xpPerSec.toFixed(1)}</span>
            <span className="text-right text-text-mute tabular-nums">{r.recipe.awXp}</span>
            <span className="text-right text-text-mute tabular-nums">{r.recipe.t}s</span>
            <span className="text-right text-gold">{tierLabel(r.recipe.lvl)}</span>
            <span className="text-right text-text-dim truncate">{r.recipe.prof ?? '—'}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-text-dim">
        Showing {filtered.length} of {rows.length} recipes
      </div>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-dim uppercase tracking-[.1em] font-medium w-12 flex-shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-[3px] text-[11px] border transition-colors ${
        active
          ? 'bg-green-soft border-green-dim text-green-hi'
          : 'bg-transparent border-hair text-text-dim hover:border-hair-strong'
      }`}
    >
      {label}
    </button>
  )
}
