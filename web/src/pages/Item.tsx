import { useParams } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { primaryRecipeFor, buildUsedInIndex } from '../lib/graph'
import ItemHeader from '../components/ItemHeader'
import FlowView from '../components/FlowView'
import RawMatsCollapsible from '../components/RawMats'
import UsedIn from '../components/UsedIn'

export default function Item() {
  const { id } = useParams<{ id: string }>()

  const pushVisit  = useStore(s => s.pushVisit)
  const resetOrSel = useStore(s => s.resetOrSel)
  const graph      = useStore(s => s.graph)
  const tweaks     = useStore(s => s.tweaks)

  useEffect(() => { if (id) { pushVisit(id); resetOrSel() } }, [id, pushVisit, resetOrSel])

  const item = useMemo(() => graph?.items.find(i => i.id === id), [graph, id])
  const recipe = useMemo(() => graph && id ? primaryRecipeFor(graph, id) : undefined, [graph, id])
  const station = useMemo(
    () => recipe?.st ? graph?.stations.find(s => s.id === recipe.st) : undefined,
    [graph, recipe]
  )

  const usedInIdx = useMemo(() => graph ? buildUsedInIndex(graph) : new Map<string, string[]>(), [graph])
  const byId = useMemo(() => graph ? new Map(graph.items.map(i => [i.id, i])) : new Map(), [graph])

  const { finalIds, intermediateIds } = useMemo(() => {
    if (!id) return { finalIds: [] as string[], intermediateIds: [] as string[] }
    const directRecipeIds = usedInIdx.get(id) ?? []
    const seen = new Set<string>()
    const outputIds = directRecipeIds
      .map(rid => graph?.recipes.find(r => r.id === rid))
      .filter(r => !!r)
      .map(r => r!.out)
      .filter(oid => seen.has(oid) ? false : (seen.add(oid), true))

    const finals: string[] = []
    const intermediates: string[] = []
    for (const oid of outputIds) {
      const it = byId.get(oid)
      if (!it) continue
      if (it.role === 'intermediate') intermediates.push(oid)
      else finals.push(oid)
    }
    return { finalIds: finals, intermediateIds: intermediates }
  }, [id, usedInIdx, graph, byId])

  if (!graph) return <div className="p-8 text-text-dim">Loading…</div>
  if (!item) return <div className="p-8 text-text-dim">Item not found: {id}</div>

  return (
    <div>
      <ItemHeader item={item} recipe={recipe} station={station} />
      {recipe && (
        <>
          <SectionHeader title="Materials Required" sub="Direct Ingredients" accent="green" />
          <FlowView graph={graph} rootId={item.id} />
          {tweaks.showRaw && <RawMatsCollapsible graph={graph} rootId={item.id} />}
        </>
      )}

      <SectionHeader title="Used in Final Items" sub="Weapons · Tools · Structures" accent="final" count={finalIds.length} />
      {finalIds.length > 0
        ? <UsedIn graph={graph} rootId={item.id} filterIds={finalIds} />
        : <div className="p-8 text-center text-[12px] text-text-dim italic border border-dashed border-hair bg-panel">Not used in any final item</div>}

      <SectionHeader title="Used in Intermediate Components" sub="Ingredients feeding other recipes" accent="intermediate" count={intermediateIds.length} />
      {intermediateIds.length > 0
        ? <UsedIn graph={graph} rootId={item.id} filterIds={intermediateIds} />
        : <div className="p-8 text-center text-[12px] text-text-dim italic border border-dashed border-hair bg-panel">Not used in any intermediate component</div>}
    </div>
  )
}

function Ornament({ accent }: { accent: string }) {
  const color =
    accent === 'green' ? '#8aa074' :
    accent === 'final' ? '#8aa074' :
    accent === 'intermediate' ? '#b8a060' :
    '#a67a52'
  return (
    <svg viewBox="0 0 14 14" className="w-[14px] h-[14px]" fill="none" stroke={color} strokeWidth="1" strokeLinecap="square">
      <path d="M7 1 L13 7 L7 13 L1 7 Z" />
      <path d="M7 4 L10 7 L7 10 L4 7 Z" fill={color} stroke="none" opacity=".6" />
    </svg>
  )
}

function SectionHeader({ title, sub, accent, count }: { title: string; sub: string; accent: string; count?: number }) {
  const gradient =
    accent === 'green' ? 'linear-gradient(90deg, #5a6e48 0%, transparent 100%)' :
    accent === 'final' ? 'linear-gradient(90deg, #5a6e48 0%, transparent 100%)' :
    accent === 'intermediate' ? 'linear-gradient(90deg, #7a6830 0%, transparent 100%)' :
    'linear-gradient(90deg, #6e4d2e 0%, transparent 100%)'
  const titleColor =
    accent === 'final' ? 'text-green-hi' :
    accent === 'intermediate' ? 'text-gold' :
    'text-text'
  const countColor =
    accent === 'final' ? 'text-green-hi border-green-dim' :
    accent === 'intermediate' ? 'text-gold border-gold-dim' :
    'text-text-dim border-hair'

  return (
    <div className="flex items-center gap-3.5 mt-7 mb-4">
      <Ornament accent={accent} />
      <span className={`font-display text-[16px] font-semibold tracking-[.04em] flex-shrink-0 ${titleColor}`}>{title}</span>
      <span className="text-[10px] tracking-[.14em] uppercase text-text-dim font-medium ml-1.5 flex-shrink-0">{sub}</span>
      {count != null && (
        <span className={`text-[10px] font-bold tabular-nums px-2 py-[2px] bg-panel border tracking-[.06em] flex-shrink-0 ${countColor}`}>
          {count}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: gradient }} />
    </div>
  )
}
