export interface Graph {
  items: Item[]
  recipes: Recipe[]
  stations: Station[]
}

export type ItemRole = 'final' | 'intermediate' | 'raw' | 'standalone'

export interface StatEntry {
  attr: string
  value: number
  op: string | null
  qlo?: number[]
  qhi?: number[]
}

export interface Item {
  id: string
  s?: string | null          // slug
  n: string | null           // name_en
  nz: string | null          // name_zh
  cat: string | null
  role: ItemRole
  ic?: string | null
  de?: string | null         // description_en
  dz?: string | null         // description_zh
  w?: number | null          // weight
  dur?: number | null        // durability
  stats?: StatEntry[] | null // equipment stats
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

export interface DropSource {
  source_name: string
  source_type: string
  probability: number
  qty_min: number
  qty_max: number
}

export interface TechUnlock {
  id: string
  name_en: string | null
  name_zh: string | null
  required_mask_level: number | null
  parent_name_en?: string | null
  parent_name_zh?: string | null
}

export interface SeedSourceEntry {
  type: string
  description: string
  locations?: string[]
  notes?: string
  qty?: string
  recommended?: boolean
}

export interface SeedSource {
  name_en: string
  map: 'base' | 'dlc' | 'both'
  grindable: boolean
  grinder_input?: string
  fertilizer?: string
  temp_growth?: string
  temp_optimal?: string
  sources: SeedSourceEntry[]
}

export interface SpawnPoint {
  lat: number
  lon: number
}

export interface SpawnGroup {
  creature: string
  level: string
  spawns: SpawnPoint[]
}

export interface SpawnMapData {
  map: 'base' | 'dlc'
  groups: SpawnGroup[]
}

export interface ItemDetail {
  id: string
  drop_sources: DropSource[]
  tech_unlocked_by: TechUnlock[]
  seed_source?: SeedSource
  spawn_locations?: SpawnMapData[]
}

export interface TechRecipeLink {
  recipe_id: string
  item_id: string
  item_name: string
  item_name_zh?: string | null
  item_slug?: string | null
  item_icon?: string | null
}

export interface TechSubNode {
  id: string
  name: string
  name_zh?: string | null
  slug?: string | null
  awareness_level?: number | null
  points?: number | null
  depends_on?: string[]
  recipes: TechRecipeLink[]
}

export interface TechMainNode {
  id: string
  name: string
  name_zh?: string | null
  slug?: string | null
  awareness_level?: number | null
  icon_path?: string | null
  depends_on?: string[]
  sub_nodes: TechSubNode[]
}

export interface TechTier {
  id: string
  name: string
  awareness_level: number
  columns: TechMainNode[][]
}

export interface TechTreeResponse {
  tiers: TechTier[]
  untiered: TechMainNode[]
}

export type TechMode = 'survival' | 'soldier' | 'management'

export interface Trait {
  id: string
  star: number
  name_zh: string | null
  name_en: string | null
  description_zh: string | null
  description_en: string | null
  description_vague_zh: string | null
  source: string | null
  effect: string | null
  effect_attr: string | null
  effect_value: number | null
  effect_is_percentage: boolean
  effect_probability: number | null
  effect_cooldown: number | null
  learned_id: string | null
  upgrade_id: string | null
  base_weight: number | null
  is_dlc: boolean
  is_negative: boolean
  clan: string | null
  community_tier: string | null
  community_tags: string[] | null
  community_note: string | null
  proficiencies: string[] | null
  conditions: string[] | null
  weapons: string[] | null
}
