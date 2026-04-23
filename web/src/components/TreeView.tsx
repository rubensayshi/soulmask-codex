import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Graph, Item } from '../lib/types'
import { primaryRecipeFor, indexItems, noRecipe } from '../lib/graph'
import Icon from './Icon'
import { useStore } from '../store'

interface Props {
  graph: Graph
  rootId: string
}

export default function TreeView({ graph, rootId }: Props) {
  const byId = useMemo(() => indexItems(graph), [graph])
  const quantity = useStore(s => s.quantity)
  const orSel    = useStore(s => s.orSel)
  const setOrSel = useStore(s => s.setOrSel)

  const recipe = primaryRecipeFor(graph, rootId)
  if (!recipe) {
    return <div className="p-8 text-center text-[12px] text-text-dim italic border border-dashed border-hair bg-panel">No recipe — gathered, dropped, or scavenged</div>
  }

  return (
    <div className="mb-5">
      {recipe.groups.map((grp, gi) => {
        if (grp.kind === 'all') {
          return grp.items.map(ing => (
            <TreeNode key={`${gi}-${ing.id}`} graph={graph} id={ing.id} qty={ing.q * quantity} byId={byId} />
          ))
        }
        const orKey = `${recipe.id}:${gi}`
        const chosen = orSel[orKey] ?? 0
        return (
          <OrGroup
            key={gi}
            items={grp.items}
            chosen={chosen}
            onSelect={i => setOrSel(orKey, i)}
            byId={byId}
            graph={graph}
            multiplier={quantity}
          />
        )
      })}
    </div>
  )
}

function OrGroup({
  items, chosen, onSelect, byId, graph, multiplier,
}: {
  items: { id: string; q: number }[]
  chosen: number
  onSelect: (i: number) => void
  byId: Map<string, Item>
  graph: Graph
  multiplier: number
}) {
  const picked = items[chosen] ?? items[0]
  const subItem = byId.get(picked.id)
  const subHasRecipe = subItem && !noRecipe(subItem) && !!primaryRecipeFor(graph, picked.id)
  const [showSub, setShowSub] = useState(false)

  return (
    <div
      className="or-box relative mb-0.5 px-3 py-2.5 bg-teal-bg border border-teal-dim"
      style={{ borderLeftWidth: 2, borderLeftColor: '#6ea09a' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] tracking-widest2 uppercase text-teal font-semibold">Choose one</span>
        <div className="flex-1 h-px bg-teal-dim" />
      </div>
      {items.map((alt, ai) => {
        const altItem = byId.get(alt.id)
        const active = chosen === ai
        return (
          <div
            key={alt.id}
            className={`flex items-center gap-2.5 px-2 py-1.5 mt-0.5 cursor-pointer border transition-colors ${
              active ? 'bg-[rgba(109,158,148,.1)] border-teal-dim' : 'border-transparent hover:bg-[rgba(109,158,148,.06)]'
            }`}
            onClick={() => onSelect(ai)}
          >
            <span className={`w-3 h-3 flex-shrink-0 border flex items-center justify-center ${active ? 'bg-teal border-teal' : 'bg-bg-2 border-teal-dim'}`}>
              {active && <span className="w-1 h-1 bg-bg" />}
            </span>
            <Icon item={altItem} size={22} />
            <span className="flex-1 text-[12.5px] text-text">{altItem?.n ?? altItem?.nz ?? alt.id}</span>
            <span className="text-[12px] font-semibold text-teal tabular-nums">×{alt.q * multiplier}</span>
          </div>
        )
      })}
      {subHasRecipe && (
        <>
          <button
            onClick={() => setShowSub(s => !s)}
            className="mt-2 w-full px-2 py-[5px] bg-transparent border border-dashed border-teal-dim text-teal text-[10px] uppercase tracking-[.14em] font-semibold hover:bg-[rgba(109,158,148,.06)] hover:border-solid transition-all"
          >
            {showSub ? '▾ Hide' : '▸ Show'} ingredients for {subItem?.n ?? subItem?.nz ?? picked.id}
          </button>
          {showSub && (
            <div className="mt-2 pt-2 border-t border-dashed border-teal-dim">
              <TreeNode graph={graph} id={picked.id} qty={picked.q * multiplier} byId={byId} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface NodeProps {
  graph: Graph
  id: string
  qty: number
  byId: Map<string, Item>
}

function TreeNode({ graph, id, qty, byId }: NodeProps) {
  const item = byId.get(id)
  const terminal = item ? noRecipe(item) : true
  const recipe = item && !terminal ? primaryRecipeFor(graph, id) : undefined
  const hasKids = !!recipe && recipe.groups.some(g => g.items.length > 0)
  const [expanded, setExpanded] = useState(hasKids)
  const stationName = useMemo(() => {
    if (!recipe?.st) return null
    return graph.stations.find(s => s.id === recipe.st)?.n ?? null
  }, [graph, recipe])

  if (!item) return null

  return (
    <div className="tree-wrap">
      <div
        className={`group relative flex items-center gap-[11px] px-3 py-2 mb-0.5 border transition-colors ${
          terminal
            ? 'bg-transparent border-line-soft hover:bg-[rgba(166,122,82,.03)]'
            : 'bg-panel border-hair hover:bg-panel-2 hover:border-hair-strong'
        } ${hasKids ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => hasKids && setExpanded(v => !v)}
      >
        <span className="w-3 text-text-dim text-[10px] text-center flex-shrink-0">
          {hasKids ? (expanded ? '▾' : '▸') : ''}
        </span>
        <Icon item={item} size={30} />
        <span className={`flex-1 text-[13px] truncate ${terminal ? 'text-text-mute' : 'text-text'}`}>
          {item.n ?? item.nz ?? item.id}
        </span>
        {stationName && (
          <span className="text-[10px] tracking-[.08em] font-medium px-2 py-[3px] text-green border border-green-soft bg-green-bg flex-shrink-0">
            {stationName}
          </span>
        )}
        <span className={`text-[13px] font-semibold tabular-nums min-w-[32px] text-right flex-shrink-0 ${terminal ? 'text-rust' : 'text-green-hi'}`}>
          ×{qty}
        </span>
        {!terminal && (
          <Link
            to={`/item/${item.id}`}
            onClick={e => e.stopPropagation()}
            className="w-[22px] h-[22px] flex items-center justify-center bg-bg border border-hair text-text-mute text-[12px] opacity-0 group-hover:opacity-100 hover:border-green hover:text-green-hi transition-all flex-shrink-0"
          >→</Link>
        )}
      </div>
      {expanded && recipe && hasKids && (
        <div className="tree-kids">
          {recipe.groups.map((grp, gi) =>
            grp.items.map(ing => (
              <TreeNode key={`${gi}-${ing.id}`} graph={graph} id={ing.id} qty={ing.q * qty} byId={byId} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
