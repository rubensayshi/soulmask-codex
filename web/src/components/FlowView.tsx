import { useMemo, useRef, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Graph, Item } from '../lib/types'
import { primaryRecipeFor, indexItems, noRecipe, itemPath } from '../lib/graph'
import Diamond from './Diamond'
import Icon from './Icon'
import { useStore } from '../store'

interface Props { graph: Graph; rootId: string }

export default function FlowView({ graph, rootId }: Props) {
  const byId = useMemo(() => indexItems(graph), [graph])
  const quantity = useStore(s => s.quantity)
  const orSel    = useStore(s => s.orSel)
  const setOrSel = useStore(s => s.setOrSel)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [expandedOr, setExpandedOr] = useState<Set<string>>(new Set())
  const toggleOr = useCallback((key: string) => {
    setExpandedOr(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
    })
  }, [rootId, quantity])

  const root = byId.get(rootId)
  if (!root || noRecipe(root)) {
    return <div className="p-8 text-center text-[12px] text-text-dim italic border border-dashed border-hair bg-panel">No recipe — gathered, dropped, or scavenged</div>
  }

  return (
    <div
      ref={ref}
      className="flow-container flow-vert overflow-auto mb-[22px] p-[20px_8px_24px] border border-hair"
      style={{
        background: 'radial-gradient(ellipse at 20% 40%, rgba(138,160,116,.05) 0%, transparent 45%), linear-gradient(180deg, #181a16 0%, #161815 100%)',
      }}
    >
      <div className="flex flex-col items-center" style={{ minWidth: 'fit-content' }}>
        <FlowNode graph={graph} byId={byId} id={rootId} qty={1} multiplier={quantity}
                  isRoot orSel={orSel} setOrSel={setOrSel} onNavigate={item => navigate(itemPath(item))}
                  expandedOr={expandedOr} toggleOr={toggleOr} />
      </div>
    </div>
  )
}

interface NodeProps {
  graph: Graph
  byId: Map<string, Item>
  id: string
  qty: number
  multiplier: number
  isRoot?: boolean
  depth?: number
  orSel: Record<string, number>
  setOrSel: (k: string, i: number) => void
  onNavigate: (item: Item) => void
  expandedOr: Set<string>
  toggleOr: (k: string) => void
  badge?: ReactNode
}

function FlowNode({ graph, byId, id, qty, multiplier, isRoot = false, depth = 0, orSel, setOrSel, onNavigate, expandedOr, toggleOr, badge }: NodeProps) {
  const item = byId.get(id)
  const total = qty * multiplier
  const terminal = item ? noRecipe(item) : true
  const recipe = item && !terminal ? primaryRecipeFor(graph, id) : undefined
  const stationName = useMemo(
    () => (recipe?.st ? graph.stations.find(s => s.id === recipe.st)?.n ?? null : null),
    [recipe, graph]
  )
  if (!item || depth > 6) return null
  const hasKids = !!recipe && recipe.groups.length > 0
  const size = isRoot ? 64 : 48

  const tile = (
    <div className="flex flex-col items-center gap-[7px] flex-shrink-0">
      <div className="relative">
        <Diamond
          item={item}
          size={size}
          variant={isRoot ? 'root' : terminal ? 'raw' : 'default'}
          onClick={() => !terminal && onNavigate(item)}
        />
        {badge}
      </div>
      <div className="flex flex-col items-center gap-[2px] max-w-[110px] text-center">
        <span className={`text-[11px] leading-[1.25] tracking-[.02em] ${
          isRoot ? 'text-green-hi text-[12px] font-semibold' : terminal ? 'text-text-mute' : 'text-text'
        }`}>
          {item.n ?? item.nz ?? item.id}
        </span>
        <span className={`text-[11px] font-bold tabular-nums tracking-[.04em] ${terminal ? 'text-rust' : 'text-green-hi'}`}>×{total}</span>
        {stationName && !isRoot && <span className="text-[9px] text-text-dim uppercase tracking-[.1em] font-medium">{stationName}</span>}
      </div>
    </div>
  )

  if (!hasKids || !recipe) return tile

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 'fit-content' }}>
      {tile}
      <div className="w-px h-6 bg-green-dim flex-shrink-0 self-center" />
      <div className="flex flex-row relative self-stretch justify-center">
        {recipe.groups.map((grp, gi) => {
          if (grp.kind === 'all') {
            return grp.items.map(ing => (
              <div key={`${gi}-${ing.id}`} className="flow-branch-item vert flex flex-col items-center">
                <div className="mt-[14px]">
                  <FlowNode graph={graph} byId={byId} id={ing.id} qty={ing.q * qty} multiplier={multiplier}
                            depth={depth + 1} orSel={orSel} setOrSel={setOrSel} onNavigate={onNavigate}
                            expandedOr={expandedOr} toggleOr={toggleOr} />
                </div>
              </div>
            ))
          }

          const orKey = `${recipe.id}:${gi}`
          const chosenIdx = orSel[orKey] ?? 0
          const chosenAlt = grp.items[chosenIdx] ?? grp.items[0]

          if (expandedOr.has(orKey)) {
            return (
              <div key={gi} className="flow-branch-item vert flex flex-col items-center">
                <div className="mt-[14px] p-2.5 bg-teal-bg border border-teal-dim min-w-[170px]"
                     style={{ borderLeftWidth: 2, borderLeftColor: '#6ea09a' }}>
                  <div className="text-[9px] tracking-[.18em] uppercase text-teal font-semibold mb-1.5">◈ Choose one</div>
                  {grp.items.map((alt, ai) => {
                    const altItem = byId.get(alt.id)
                    const active = chosenIdx === ai
                    return (
                      <div
                        key={alt.id}
                        className={`flex items-center gap-2 px-1.5 py-1.5 mt-px cursor-pointer border transition-colors ${
                          active ? 'bg-[rgba(109,158,148,.1)] border-teal-dim' : 'border-transparent hover:bg-[rgba(109,158,148,.06)]'
                        }`}
                        onClick={() => { setOrSel(orKey, ai); toggleOr(orKey) }}
                      >
                        <Icon item={altItem} size={20} />
                        <span className="flex-1 text-[11px] text-text truncate">{altItem?.n ?? altItem?.nz ?? alt.id}</span>
                        <span className="text-[10px] font-bold text-teal tabular-nums">×{alt.q * total}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }

          return (
            <div key={gi} className="flow-branch-item vert flex flex-col items-center">
              <div className="mt-[14px]">
                <FlowNode graph={graph} byId={byId} id={chosenAlt.id} qty={chosenAlt.q * qty} multiplier={multiplier}
                          depth={depth + 1} orSel={orSel} setOrSel={setOrSel} onNavigate={onNavigate}
                          expandedOr={expandedOr} toggleOr={toggleOr}
                          badge={
                            <button
                              className="absolute z-10 -top-1.5 -right-2.5 flex items-center gap-0.5 px-1 py-0.5 bg-[rgba(109,158,148,.4)] border border-teal-dim text-teal text-[9px] font-semibold cursor-pointer hover:bg-[rgba(109,158,148,.6)] transition-colors"
                              onClick={(e) => { e.stopPropagation(); toggleOr(orKey) }}
                            >
                              ◈ {grp.items.length}
                            </button>
                          } />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
