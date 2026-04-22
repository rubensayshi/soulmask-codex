import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from '../store'

export default function Item() {
  const { id } = useParams<{ id: string }>()
  const pushVisit = useStore(s => s.pushVisit)
  const resetOrSel = useStore(s => s.resetOrSel)
  const graph = useStore(s => s.graph)

  useEffect(() => { if (id) { pushVisit(id); resetOrSel() } }, [id, pushVisit, resetOrSel])

  if (!graph) return <div className="p-8">Loading…</div>
  const item = graph.items.find(i => i.id === id)
  if (!item) return <div className="p-8">Item not found: {id}</div>

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl text-gold">{item.n ?? item.nz ?? item.id}</h1>
      <p className="text-text-muted">Category: {item.cat ?? '—'}</p>
    </div>
  )
}
