export interface Graph {
  items: Item[]
  recipes: Recipe[]
  stations: Station[]
}

export type ItemRole = 'final' | 'intermediate' | 'raw' | 'standalone'

export interface Item {
  id: string
  s?: string | null          // slug
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
  mask?: number | null
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

export interface BuffModifier {
  attribute: string
  value: number | null
  op: 'add' | 'multiply' | 'divide' | 'override'
  duration_seconds?: number
  over_seconds?: number
  computed?: boolean
}

export interface ItemBuffs {
  modifiers: BuffModifier[]
  buff_name_zh?: string
  buff_desc_zh?: string
  duration_seconds?: number
  has_unextractable_effects?: boolean
}

export interface BuffedItem {
  id: string
  name_en: string | null
  name_zh: string | null
  category: string | null
  icon_path: string | null
  slug: string | null
  buffs: ItemBuffs
}
