import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Graph, Item } from '../lib/types'
import { primaryRecipeFor, indexItems } from '../lib/graph'
import Diamond from './Diamond'
import { useStore } from '../store'

interface Props { graph: Graph; rootId: string }

export default function FlowView({ graph, rootId }: Props) {
  const byId = useMemo(() => indexItems(graph), [graph])
  const quantity = useStore(s => s.quantity)
  const orSel    = useStore(s => s.orSel)
  const setOrSel = useStore(s => s.setOrSel)
  const navigate = useNavigate()
  const root = byId.get(rootId)
  if (!root || root.raw) {
    return <div className="h-16 flex items-center justify-center text-[11px] text-text-dim">Raw material — gathered, not crafted</div>
  }
  return (
    <div className="overflow-x-auto pb-5 mb-5">
      <FlowNode graph={graph} byId={byId} id={rootId} qty={1} multiplier={quantity}
                isRoot orSel={orSel} setOrSel={setOrSel} onNavigate={id => navigate(`/item/${id}?view=flow`)} />
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
  onNavigate: (id: string) => void
}

function FlowNode({ graph, byId, id, qty, multiplier, isRoot = false, depth = 0, orSel, setOrSel, onNavigate }: NodeProps) {
  const item = byId.get(id)
  const total = qty * multiplier
  const recipe = item && !item.raw ? primaryRecipeFor(graph, id) : undefined
  const stationName = useMemo(
    () => (recipe?.st ? graph.stations.find(s => s.id === recipe.st)?.n ?? null : null),
    [recipe, graph]
  )
  if (!item || depth > 6) return null
  const hasKids = !!recipe && recipe.groups.length > 0
  const size = isRoot ? 52 : 42

  const diamond = (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <Diamond
        item={item}
        size={size}
        variant={isRoot ? 'root' : item.raw ? 'raw' : 'default'}
        onClick={() => !item.raw && onNavigate(item.id)}
      />
      <div className="flex flex-col items-center gap-[1px]">
        <span className={`text-[10px] text-center leading-tight max-w-[88px] ${
          isRoot ? 'text-text text-[11px]' : item.raw ? 'text-raw' : 'text-text-muted'
        }`}>
          {item.n ?? item.nz ?? item.id}
        </span>
        <span className={`text-[10px] font-bold tabular-nums ${item.raw ? 'text-raw' : 'text-gold'}`}>×{total}</span>
        {stationName && <span className="text-[9px] text-text-dim">{stationName}</span>}
      </div>
    </div>
  )

  if (!hasKids || !recipe) return diamond

  return (
    <div className="flex items-center">
      {diamond}
      <div className="w-7 h-px bg-gold-dim flex-shrink-0" />
      <div className="flex flex-col gap-2 relative flow-branch">
        {recipe.groups.map((grp, gi) =>
          grp.kind === 'all'
            ? grp.items.map(ing => (
              <div key={`${gi}-${ing.id}`} className="flex items-center relative flow-branch-item">
                <div className="ml-[14px]">
                  <FlowNode graph={graph} byId={byId} id={ing.id} qty={ing.q * qty} multiplier={multiplier}
                            depth={depth + 1} orSel={orSel} setOrSel={setOrSel} onNavigate={onNavigate} />
                </div>
              </div>
            ))
            : (
              <div key={gi} className="flex items-center relative flow-branch-item">
                <div className="ml-[14px] p-2 bg-or-bg border border-or-border min-w-[140px]">
                  <div className="text-[8px] text-or tracking-wider2 uppercase mb-1 font-semibold">Choose one</div>
                  {grp.items.map((alt, ai) => {
                    const altItem = byId.get(alt.id)
                    const active = (orSel[`${recipe.id}:${gi}`] ?? 0) === ai
                    return (
                      <div
                        key={alt.id}
                        className={`py-1 px-1.5 border flex items-center justify-between gap-1 my-[2px] cursor-pointer transition-colors ${
                          active ? 'bg-[rgba(144,128,204,.14)] border-or' : 'border-transparent hover:bg-[rgba(144,128,204,.1)] hover:border-or-border'
                        }`}
                        onClick={() => setOrSel(`${recipe.id}:${gi}`, ai)}
                      >
                        <span className="text-[11px] text-text">{altItem?.n ?? altItem?.nz ?? alt.id}</span>
                        <span className="text-[10px] font-semibold text-or">×{alt.q * qty * multiplier}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  )
}
