export interface Graph {
  items: Item[]
  recipes: Recipe[]
  stations: Station[]
}

export type ItemRole = 'final' | 'intermediate' | 'raw' | 'standalone'

export interface Item {
  id: string
  n: string | null           // name_en
  nz: string | null          // name_zh
  cat: string | null
  role: ItemRole
  ic?: string | null
}

export interface Recipe {
  id: string
  out: string
  outQ: number
  st?: string | null
  t?: number | null
  prof?: string | null
  profXp?: number | null
  awXp?: number | null
  lvl?: number | null
  groups: Group[]
}

export interface Group {
  kind: 'all' | 'one_of'
  items: { id: string; q: number }[]
}

export interface Station {
  id: string
  n: string | null
}
