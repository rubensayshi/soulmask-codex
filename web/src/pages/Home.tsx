import { Link } from 'react-router-dom'
import { useStore } from '../store'

export default function Home() {
  const graph = useStore(s => s.graph)
  const status = useStore(s => s.graphStatus)
  if (status === 'loading' || !graph) return <div className="p-8">Loading…</div>
  return (
    <div className="p-8 space-y-4">
      <h1 className="font-display text-2xl text-gold">Soulmask · Recipe Tree</h1>
      <p className="text-text-muted">
        Loaded {graph.items.length} items, {graph.recipes.length} recipes.
      </p>
      <p>
        <Link className="text-gold underline" to="/item/Daoju_Item_TieDing">
          Try Iron Ingot →
        </Link>
      </p>
    </div>
  )
}
