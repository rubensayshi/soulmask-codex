import { useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { primaryRecipeFor } from '../lib/graph'
import ItemHeader from '../components/ItemHeader'
import QtyControl from '../components/QtyControl'
import TreeView from '../components/TreeView'
import FlowView from '../components/FlowView'
import RawMatsCollapsible from '../components/RawMats'

export default function Item() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const view = params.get('view') === 'tree' ? 'tree' : 'flow'

  const pushVisit  = useStore(s => s.pushVisit)
  const resetOrSel = useStore(s => s.resetOrSel)
  const graph      = useStore(s => s.graph)

  useEffect(() => { if (id) { pushVisit(id); resetOrSel() } }, [id, pushVisit, resetOrSel])

  const item = useMemo(() => graph?.items.find(i => i.id === id), [graph, id])
  const recipe = useMemo(() => graph && id ? primaryRecipeFor(graph, id) : undefined, [graph, id])
  const station = useMemo(
    () => recipe?.st ? graph?.stations.find(s => s.id === recipe.st) : undefined,
    [graph, recipe]
  )

  if (!graph) return <div>Loading…</div>
  if (!item) return <div>Item not found: {id}</div>

  return (
    <div>
      <ItemHeader item={item} recipe={recipe} station={station} />
      {recipe && <QtyControl />}
      {recipe && (
        <>
          <SectionHeader label="Ingredients" color="gold" />
          {view === 'tree'
            ? <TreeView graph={graph} rootId={item.id} />
            : <FlowView graph={graph} rootId={item.id} />}
          <RawMatsCollapsible graph={graph} rootId={item.id} />
        </>
      )}
    </div>
  )
}

function SectionHeader({ label, color }: { label: string; color: 'gold' | 'jade' }) {
  const diamondColor = color === 'gold' ? 'border-gold-dim bg-gold-dim' : 'border-jade-border bg-jade-border'
  return (
    <div className="flex items-center gap-2 mt-0.5 mb-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-border" />
      <div className={`w-2 h-2 rotate-45 border ${diamondColor}`} />
      <div className="text-[9px] tracking-wider2 uppercase text-text-dim font-semibold whitespace-nowrap">{label}</div>
      <div className={`w-2 h-2 rotate-45 border ${diamondColor}`} />
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
