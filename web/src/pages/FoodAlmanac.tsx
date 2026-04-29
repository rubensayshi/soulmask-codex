import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { fetchFoodBuffs } from '../lib/api'
import type { BuffedItem, BuffModifier } from '../lib/types'

const ICON_BASE = import.meta.env.VITE_ICON_BASE || '/icons'

const CATEGORIES = [
  { key: 'meat',       label: 'Meat',        subtitle: 'HP & healing',             color: '#b85050' },
  { key: 'fruit',      label: 'Fruit & Veg', subtitle: 'Stamina & speed',          color: '#8aa074' },
  { key: 'staple',     label: 'Staple Food',  subtitle: 'Carry weight & defense',  color: '#b8a060' },
  { key: 'recreative', label: 'Recreative',   subtitle: 'Drinks · tobacco · misc', color: '#7a9db5' },
  { key: 'potions',    label: 'Potions',      subtitle: 'Burst, cure, cleanse',     color: '#9b7db8' },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

const HIDDEN_ATTRS = new Set([
  'food', 'water', 'meat_preference', 'fruit_preference', 'staple_preference',
  'mood', 'awareness',
])

const ATTR_LABELS: Record<string, string> = {
  max_health: 'max HP', healing: 'healing', attack: 'attack', defense: 'defense',
  food_consumption: 'food use', water_consumption: 'water use',
  health_regen: 'HP regen', stamina_regen: 'stam regen',
  max_stamina: 'max stam', stamina: 'stamina', speed: 'speed',
  max_carry_weight: 'carry wt', damage_increase: 'damage',
  crit_chance: 'crit', crit_damage: 'crit dmg', crit_defense: 'crit def',
  cold_resistance: 'cold res', heat_resistance: 'heat res',
  poison_resistance: 'poison res', heat_dissipation: 'heat dissip',
  food_stamina_recovery: 'food stam', water_stamina_recovery: 'water stam',
  max_awareness: 'max aware', max_food: 'max food', max_water: 'max water',
  poison: 'poison', radiation: 'radiation', oxygen: 'oxygen',
  heat_damage_reduction: 'heat dmg red', cold_damage_reduction: 'cold dmg red',
  poison_damage_reduction: 'poison dmg red', growth_exp_rate: 'growth XP',
  damage: 'damage',
}

const PREFERENCE_ATTRS = new Set(['meat_preference', 'fruit_preference', 'staple_preference'])

function classifyItem(item: BuffedItem): CategoryKey {
  if (item.category === 'potion') return 'potions'
  const attrs = new Set(item.buffs.modifiers.map(m => m.attribute))
  if (attrs.has('meat_preference')) return 'meat'
  if (attrs.has('fruit_preference')) return 'fruit'
  if (attrs.has('staple_preference')) return 'staple'
  return 'recreative'
}

function deriveTier(dur: number | undefined): 'top' | 'mid' | 'basic' {
  if (!dur) return 'basic'
  const m = dur / 60
  if (m >= 30) return 'top'
  if (m >= 20) return 'mid'
  return 'basic'
}

function formatDuration(sec: number | undefined): string {
  if (!sec) return '—'
  const m = Math.round(sec / 60)
  return `${m}m`
}

interface Column {
  key: string
  attr: string
  label: string
}

function getColumnsForItems(items: BuffedItem[], catKey: CategoryKey): Column[] {
  const seen = new Map<string, number>()
  for (const item of items) {
    for (const mod of item.buffs.modifiers) {
      if (HIDDEN_ATTRS.has(mod.attribute)) continue
      if (PREFERENCE_ATTRS.has(mod.attribute)) continue
      seen.set(mod.attribute, (seen.get(mod.attribute) ?? 0) + 1)
    }
  }
  const cols: Column[] = Array.from(seen.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([attr]) => ({
      key: attr,
      attr,
      label: ATTR_LABELS[attr] ?? attr,
    }))

  if (catKey !== 'potions' && catKey !== 'recreative') {
    const prefAttr = catKey === 'meat' ? 'meat_preference'
      : catKey === 'fruit' ? 'fruit_preference' : 'staple_preference'
    cols.push({ key: 'companion', attr: prefAttr, label: 'companion' })
  }
  return cols
}

function getModForColumn(item: BuffedItem, col: Column): BuffModifier | undefined {
  return item.buffs.modifiers.find(m => m.attribute === col.attr)
}

function formatValue(mod: BuffModifier): string {
  if (mod.computed || mod.value === null) return '?'
  if (PREFERENCE_ATTRS.has(mod.attribute)) return String(mod.value)
  if (mod.op === 'multiply') {
    if (mod.value >= 5) return `×${mod.value}`
    const pct = Math.round((mod.value - 1) * 100)
    return pct >= 0 ? `+${pct}%` : `−${Math.abs(pct)}%`
  }
  if (mod.op === 'override') return `=${mod.value}`
  const v = mod.value
  if (Number.isInteger(v)) return v >= 0 ? `+${v}` : `${v}`
  return v >= 0 ? `+${v}` : `${v}`
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

const TIER_ORDER = { top: 0, mid: 1, basic: 2 }

export default function FoodAlmanac() {
  const [items, setItems] = useState<BuffedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CategoryKey>('meat')
  const [sortBy, setSortBy] = useState<string>('tier')

  useEffect(() => {
    fetchFoodBuffs()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<CategoryKey, BuffedItem[]>()
    for (const cat of CATEGORIES) map.set(cat.key, [])
    for (const item of items) {
      const key = classifyItem(item)
      map.get(key)!.push(item)
    }
    return map
  }, [items])

  const categoryItems = grouped.get(activeTab) ?? []
  const columns = useMemo(() => getColumnsForItems(categoryItems, activeTab), [categoryItems, activeTab])

  const columnMaxes = useMemo(() => {
    const maxes: Record<string, number> = {}
    for (const item of categoryItems) {
      for (const col of columns) {
        const mod = getModForColumn(item, col)
        if (!mod || mod.value === null) continue
        const abs = Math.abs(mod.value)
        maxes[col.key] = Math.max(maxes[col.key] ?? 0, abs)
      }
    }
    return maxes
  }, [categoryItems, columns])

  const sorted = useMemo(() => {
    const arr = [...categoryItems]
    if (sortBy === 'tier') {
      arr.sort((a, b) => {
        const ta = TIER_ORDER[deriveTier(a.buffs.duration_seconds)]
        const tb = TIER_ORDER[deriveTier(b.buffs.duration_seconds)]
        if (ta !== tb) return ta - tb
        return (b.buffs.duration_seconds ?? 0) - (a.buffs.duration_seconds ?? 0)
      })
    } else if (sortBy === 'duration') {
      arr.sort((a, b) => (b.buffs.duration_seconds ?? 0) - (a.buffs.duration_seconds ?? 0))
    } else {
      const col = columns.find(c => c.key === sortBy)
      if (col) {
        arr.sort((a, b) => {
          const va = getModForColumn(a, col)?.value ?? -Infinity
          const vb = getModForColumn(b, col)?.value ?? -Infinity
          return (vb as number) - (va as number)
        })
      }
    }
    return arr
  }, [categoryItems, sortBy, columns])

  const activeCat = CATEGORIES.find(c => c.key === activeTab)!
  const rgb = hexToRgb(activeCat.color)

  if (loading) return <div className="p-8 text-text-dim">Loading...</div>

  return (
    <div>
      <Helmet>
        <title>Food Almanac — Soulmask Codex</title>
        <meta name="description" content="Compare every Soulmask food, drink, and potion side by side — buffs, durations, and companion preferences." />
        <link rel="canonical" href="https://soulmask-codex.com/food-almanac" />
        <meta property="og:title" content="Food Almanac — Soulmask Codex" />
        <meta property="og:description" content="Compare every Soulmask food, drink, and potion side by side — buffs, durations, and companion preferences." />
        <meta property="og:url" content="https://soulmask-codex.com/food-almanac" />
        <meta name="twitter:title" content="Food Almanac — Soulmask Codex" />
        <meta name="twitter:description" content="Compare every Soulmask food, drink, and potion side by side — buffs, durations, and companion preferences." />
      </Helmet>
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-heading text-[28px] font-bold text-text tracking-[.03em] mb-1">
          Food <span className="font-display italic font-semibold" style={{ color: activeCat.color }}>Almanac</span>
        </h1>
        <p className="text-[12px] text-text-mute italic font-display">
          Every dish in one category, side by side — pick your tab.
        </p>
      </div>

      {/* Category tabs — full width */}
      <div className="flex flex-nowrap overflow-x-auto border-b border-hair mb-0">
        {CATEGORIES.map(cat => {
          const count = grouped.get(cat.key)?.length ?? 0
          const active = cat.key === activeTab
          return (
            <button
              key={cat.key}
              onClick={() => { setActiveTab(cat.key); setSortBy('tier') }}
              className={`relative flex-shrink-0 md:flex-1 flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                active ? 'bg-panel' : 'hover:bg-panel/50'
              }`}
              style={active ? {
                borderTop: `2px solid ${cat.color}`,
                borderLeft: '1px solid var(--color-hair, #373c32)',
                borderRight: '1px solid var(--color-hair, #373c32)',
                marginBottom: -1,
              } : undefined}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color, opacity: active ? 1 : 0.35 }}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`text-[12px] font-semibold uppercase tracking-wider2 ${active ? '' : 'text-text-mute'}`}
                  style={active ? { color: cat.color } : undefined}
                >
                  {cat.label}
                </div>
                <div className="text-[10px] text-text-dim truncate">{cat.subtitle}</div>
              </div>
              <span
                className="text-[11px] tabular-nums px-1.5 py-0.5 border"
                style={active
                  ? { borderColor: `rgba(${hexToRgb(cat.color)},.4)`, color: cat.color }
                  : { borderColor: 'var(--color-hair, #373c32)', color: 'var(--color-text-dim, #6b7163)' }
                }
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sub-header: category label + sort controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-3 border-b border-hair">
        <div className="text-[11px] text-text-mute uppercase tracking-wider2">
          <span style={{ color: activeCat.color }}>{'◆'}</span>
          {' '}{activeCat.label} — {activeCat.subtitle} · {categoryItems.length} items
        </div>
        <div className="flex flex-nowrap overflow-x-auto items-center gap-2 text-[11px]">
          <span className="text-text-dim flex-shrink-0">Sort</span>
          <SortPill label="Tier" value="tier" current={sortBy} onChange={setSortBy} color={activeCat.color} />
          <SortPill label="Duration" value="duration" current={sortBy} onChange={setSortBy} color={activeCat.color} />
          <span className="text-text-faint mx-1 flex-shrink-0">by column →</span>
          {columns.slice(0, 6).map(col => (
            <SortPill key={col.key} label={col.label} value={col.key} current={sortBy} onChange={setSortBy} color={activeCat.color} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-hair-strong text-[10px] text-text-dim uppercase tracking-wider2">
              <th className="py-2 px-2 text-left w-[60px]" />
              <th className="py-2 px-2 text-left min-w-[140px]">Item</th>
              <th className="py-2 px-2 text-left w-[50px]">Dur.</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="py-2 px-2 text-left min-w-[90px] cursor-pointer hover:text-text-mute transition-colors"
                  onClick={() => setSortBy(col.key)}
                >
                  <span style={sortBy === col.key ? { color: activeCat.color } : undefined}>{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={3 + columns.length} className="p-6 text-center text-text-dim italic">No items in this category.</td></tr>
            )}
            {sorted.map((item, i) => {
              const tier = deriveTier(item.buffs.duration_seconds)
              return (
                <tr
                  key={item.id}
                  className={`border-b border-hair transition-colors ${i % 2 === 0 ? 'bg-panel/40' : ''}`}
                  style={{ ['--row-hover' as string]: `rgba(${rgb},.06)` }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = `rgba(${rgb},.06)`)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td className="py-2 px-2">
                    <TierBadge tier={tier} color={activeCat.color} />
                  </td>
                  <td className="py-2 px-2">
                    <Link
                      to={`/item/${item.slug ?? item.id}`}
                      className="flex items-center gap-2 text-text transition-colors"
                      style={{ ['--hover-color' as string]: activeCat.color }}
                      onMouseEnter={e => (e.currentTarget.style.color = activeCat.color)}
                      onMouseLeave={e => (e.currentTarget.style.color = '')}
                    >
                      <FoodIcon iconPath={item.icon_path} />
                      {item.name_en ?? item.name_zh ?? item.id}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-text-dim tabular-nums">
                    {formatDuration(item.buffs.duration_seconds)}
                  </td>
                  {columns.map(col => {
                    const mod = getModForColumn(item, col)
                    if (!mod) return <td key={col.key} className="py-2 px-2 text-text-faint text-center">·</td>
                    const max = columnMaxes[col.key] ?? 1
                    const barW = mod.value !== null ? Math.abs(mod.value) / max : 0
                    const isCompanion = PREFERENCE_ATTRS.has(col.attr)
                    return (
                      <td key={col.key} className="py-2 px-2">
                        <div className="relative">
                          <span className={`relative z-10 tabular-nums ${isCompanion ? 'text-gold' : 'text-text'}`}>
                            {formatValue(mod)}
                          </span>
                          {mod.value !== null && !mod.computed && (
                            <div
                              className="absolute left-0 bottom-0 h-[2px] rounded-full"
                              style={{
                                width: `${Math.min(barW * 100, 100)}%`,
                                backgroundColor: isCompanion
                                  ? 'rgba(184,160,96,.4)'
                                  : `rgba(${rgb},.45)`,
                              }}
                            />
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TierBadge({ tier, color }: { tier: 'top' | 'mid' | 'basic'; color: string }) {
  if (tier === 'top') {
    const rgb = hexToRgb(color)
    return (
      <span
        className="inline-block px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider2 border"
        style={{ borderColor: `rgba(${rgb},.4)`, backgroundColor: `rgba(${rgb},.12)`, color }}
      >
        {tier}
      </span>
    )
  }
  const cls = tier === 'mid'
    ? 'border-hair-strong text-text-mute'
    : 'border-hair text-text-dim'
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider2 border ${cls}`}>
      {tier}
    </span>
  )
}

function FoodIcon({ iconPath }: { iconPath: string | null }) {
  const [err, setErr] = useState(false)
  if (!iconPath || err) {
    return <span className="w-6 h-6 flex-shrink-0 rounded bg-panel border border-hair flex items-center justify-center text-[8px] text-text-dim">?</span>
  }
  const name = iconPath.split('/').pop()
  return (
    <img
      src={`${ICON_BASE}/${name}.webp`}
      alt=""
      className="w-6 h-6 flex-shrink-0 object-contain"
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }}
      onError={() => setErr(true)}
    />
  )
}

function SortPill({ label, value, current, onChange, color }: {
  label: string; value: string; current: string; onChange: (v: string) => void; color: string
}) {
  const active = value === current
  const rgb = hexToRgb(color)
  return (
    <button
      onClick={() => onChange(value)}
      className={`px-2 py-[2px] text-[11px] border transition-colors ${
        active
          ? ''
          : 'bg-transparent border-hair text-text-dim hover:border-hair-strong'
      }`}
      style={active ? {
        backgroundColor: `rgba(${rgb},.15)`,
        borderColor: `rgba(${rgb},.4)`,
        color,
      } : undefined}
    >
      {label}
    </button>
  )
}
