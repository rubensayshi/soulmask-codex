import { create } from 'zustand'
import { fetchGraph } from '../lib/api'
import type { Graph } from '../lib/types'

const GRAPH_CACHE_KEY = 'soulmask:graph'
const ETAG_CACHE_KEY  = 'soulmask:etag'
const VISITS_KEY      = 'soulmask:visits'

interface Store {
  graph: Graph | null
  graphStatus: 'idle' | 'loading' | 'ready' | 'error'
  graphEtag: string | null
  loadGraph: () => Promise<void>

  recentVisits: string[]
  pushVisit: (id: string) => void
  clearVisits: () => void

  orSel: Record<string, number>
  setOrSel: (key: string, idx: number) => void
  resetOrSel: () => void

  quantity: number
  setQuantity: (n: number) => void
}

function loadCachedGraph(): { graph: Graph | null; etag: string | null } {
  try {
    const raw  = sessionStorage.getItem(GRAPH_CACHE_KEY)
    const etag = sessionStorage.getItem(ETAG_CACHE_KEY)
    return { graph: raw ? JSON.parse(raw) : null, etag }
  } catch {
    return { graph: null, etag: null }
  }
}

function loadVisits(): string[] {
  try { return JSON.parse(sessionStorage.getItem(VISITS_KEY) || '[]') } catch { return [] }
}

export const useStore = create<Store>((set, get) => {
  const cached = loadCachedGraph()
  return {
    graph: cached.graph,
    graphStatus: cached.graph ? 'ready' : 'idle',
    graphEtag: cached.etag,
    async loadGraph() {
      set({ graphStatus: 'loading' })
      try {
        const result = await fetchGraph(get().graphEtag)
        if (result.status === 'notModified') {
          set({ graphStatus: 'ready' })
        } else {
          sessionStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify(result.graph))
          sessionStorage.setItem(ETAG_CACHE_KEY, result.etag)
          set({ graph: result.graph, graphEtag: result.etag, graphStatus: 'ready' })
        }
      } catch {
        set({ graphStatus: 'error' })
      }
    },

    recentVisits: loadVisits(),
    pushVisit(id) {
      const curr = get().recentVisits.filter(v => v !== id)
      const next = [id, ...curr].slice(0, 20)
      sessionStorage.setItem(VISITS_KEY, JSON.stringify(next))
      set({ recentVisits: next })
    },
    clearVisits() {
      sessionStorage.removeItem(VISITS_KEY)
      set({ recentVisits: [] })
    },

    orSel: {},
    setOrSel(key, idx) { set(s => ({ orSel: { ...s.orSel, [key]: idx } })) },
    resetOrSel() { set({ orSel: {} }) },

    quantity: 1,
    setQuantity(n) { set({ quantity: Math.max(1, Math.min(99, n)) }) },
  }
})
