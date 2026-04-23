import type { Graph, BuffedItem } from './types'

export async function fetchGraph(etag: string | null): Promise<
  { status: 'notModified' } | { status: 'loaded'; graph: Graph; etag: string }
> {
  const headers: Record<string, string> = {}
  if (etag) headers['If-None-Match'] = etag
  const res = await fetch('/api/graph', { headers })
  if (res.status === 304) return { status: 'notModified' }
  if (!res.ok) throw new Error(`graph: ${res.status}`)
  const newEtag = res.headers.get('ETag') || ''
  const graph = (await res.json()) as Graph
  graph.items = graph.items.filter(i => i.cat !== 'tip')
  return { status: 'loaded', graph, etag: newEtag }
}

export interface SearchHit {
  id: string
  name_en: string | null
  name_zh: string | null
  category: string | null
}

export async function fetchFoodBuffs(): Promise<BuffedItem[]> {
  const res = await fetch('/api/food-buffs')
  if (!res.ok) throw new Error(`food-buffs: ${res.status}`)
  return res.json()
}

export async function search(q: string, limit = 50): Promise<SearchHit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  if (!res.ok) throw new Error(`search: ${res.status}`)
  const hits: SearchHit[] = await res.json()
  return hits.filter(h => h.category !== 'tip')
}
