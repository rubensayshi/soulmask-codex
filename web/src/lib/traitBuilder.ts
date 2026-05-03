import type { Trait } from './types'

export interface SlotCategory {
  key: string
  label: string
  sourceKey: string
  max: number
}

export const SLOT_CATEGORIES: SlotCategory[] = [
  { key: 'tribeBorn',     label: 'Tribe born',   sourceKey: 'BornBuLuoCiTiao', max: 4 },
  { key: 'combatLearned', label: 'Talents',       sourceKey: 'Normal',          max: 6 },
  { key: 'experience',    label: 'Experience',    sourceKey: 'JingLi',          max: 1 },
  { key: 'origin',        label: 'Origin',      sourceKey: 'BornChuShen',     max: 1 },
  { key: 'title',         label: 'Title',        sourceKey: 'ChengHao',        max: 1 },
  { key: 'personality',   label: 'Personality',  sourceKey: 'XingGe',          max: 1 },
  { key: 'preferences',   label: 'Preferences',  sourceKey: 'XiHao',           max: 3 },
]

export interface TraitFamilyLike {
  source: string
  isNegative: boolean
  isBorn: boolean
  clan: string | null
  tiers: Trait[]
}

export function classifyFamily(fam: TraitFamilyLike): string | null {
  if (fam.isNegative) return null
  switch (fam.source) {
    case 'BornChuShen':     return 'origin'
    case 'XingGe':          return 'personality'
    case 'BornBuLuoCiTiao': return 'tribeBorn'
    case 'ChengHao':        return 'title'
    case 'XiHao':           return 'preferences'
    case 'JingLi':          return 'experience'
    case 'Normal':          return fam.isBorn ? null : 'combatLearned'
    default:                return null
  }
}

export function pickBuilderTrait(fam: TraitFamilyLike): Trait {
  return fam.tiers[fam.tiers.length - 1]
}

export function deriveClanLock(
  selectedIds: string[],
  familyByTraitId: Map<string, TraitFamilyLike>,
): string | null {
  for (const id of selectedIds) {
    const fam = familyByTraitId.get(id)
    if (fam?.clan && fam.clan !== 'dlc') return fam.clan
  }
  return null
}

export function clanLockingTraitId(
  selectedIds: string[],
  familyByTraitId: Map<string, TraitFamilyLike>,
): string | null {
  for (const id of selectedIds) {
    const fam = familyByTraitId.get(id)
    if (fam?.clan && fam.clan !== 'dlc') return id
  }
  return null
}

export interface ConstraintResult {
  canAdd: boolean
  reason?: 'negative' | 'no_category' | 'slot_full' | 'clan_locked' | 'wrong_clan_pool'
}

export function computeSlotFills(
  selectedIds: string[],
  familyByTraitId: Map<string, TraitFamilyLike>,
): Map<string, string[]> {
  const fills = new Map<string, string[]>()
  for (const cat of SLOT_CATEGORIES) fills.set(cat.key, [])
  for (const id of selectedIds) {
    const fam = familyByTraitId.get(id)
    if (!fam) continue
    const cat = classifyFamily(fam)
    if (!cat) continue
    fills.get(cat)!.push(id)
  }
  return fills
}

export function canAddTrait(
  traitId: string,
  traitsById: Map<string, Trait>,
  familyByTraitId: Map<string, TraitFamilyLike>,
  slotFills: Map<string, string[]>,
  lockedClan: string | null,
): ConstraintResult {
  const trait = traitsById.get(traitId)
  if (!trait) return { canAdd: false, reason: 'no_category' }
  if (trait.is_negative) return { canAdd: false, reason: 'negative' }

  const fam = familyByTraitId.get(traitId)
  if (!fam) return { canAdd: false, reason: 'no_category' }

  const catKey = classifyFamily(fam)
  if (!catKey) return { canAdd: false, reason: 'no_category' }

  const cat = SLOT_CATEGORIES.find(c => c.key === catKey)!
  const filled = slotFills.get(catKey) || []
  if (filled.length >= cat.max) return { canAdd: false, reason: 'slot_full' }

  const famClan = fam.clan
  if (lockedClan && famClan && famClan !== 'dlc' && famClan !== lockedClan) {
    return { canAdd: false, reason: 'clan_locked' }
  }

  if (catKey === 'tribeBorn' && lockedClan && famClan !== lockedClan && famClan !== 'dlc') {
    return { canAdd: false, reason: 'wrong_clan_pool' }
  }

  return { canAdd: true }
}

// --- Combat / utility classification ---

const UTILITY_EFFECTS = new Set([
  // Crafting speed
  'LianJinSuDu', 'JiaZhouSuDu', 'PengRenSuDu', 'RongLianSuDu', 'WuQiSuDu',
  'FangZhiSuDu', 'PaoMuSuDu', 'RouPiSuDu', 'ZhiTaoSuDu', 'QiJuSuDu',
  'QieShiSuDu', 'JianZhuSuDu', 'YanMoSuDu', 'ZhuBaoSuDu',
  // Crafting quality / extras
  'JiaZhouPinZhiInc', 'QiJuPinZhiInc', 'WuQiPinZhiInc',
  'MakeEquipExtraProp', 'MakeWeaponExtraProp',
  // Durability
  'ToolNaiJiuReduceConsum', 'ZhuangBeiNaiJiuReduceConsum', 'WuQiNaiJiuReduceConsum',
  // Gathering / resources
  'CaiKuangRebornTimeCut', 'FaMuRebornTimeCut', 'ZuoWuCaiJiInc',
  // Carry / survival
  'BaoGuoRongLiang', 'ReduceFoodConsume', 'ReduceWaterConsume',
  // Stealth / perception
  'FootstepSound', 'AllSound', 'AlertGrowthSpeed', 'Hearing', 'Vision',
  // Misc utility
  'GainExp', 'NaturalGiftPrInc',
  // Origin — proficiency XP boosts
  'ProfExpInc',
  // Preferences (likes/dislikes, quality-of-life)
  'DongWu', 'EquipDaoJu', 'KuaiJieLanDaoJu', 'LaShi', 'QiChuang',
  'ShuiJiao', 'ShuiYu', 'TianQi', 'TiaoWu', 'TongXingPinZhi',
  'WenDu', 'XiZao', 'YingDiRenShu',
])

const UTILITY_ATTR_INC = new Set([
  'MaxFood', 'MaxWater', 'MaxFuZhong',
  // Resistance attrs (tribe born environmental resists)
  'HanKang', 'YanKang', 'FuKang', 'DuKang', 'DuDamageDec',
])

export function isTraitUtility(trait: Trait): boolean {
  if (!trait.effect) return false
  if (UTILITY_EFFECTS.has(trait.effect)) return true
  if (trait.effect === 'AttrInc' && trait.effect_attr && UTILITY_ATTR_INC.has(trait.effect_attr)) return true
  return false
}

// --- URL codec ---

export function encodeBuild(selectedIds: string[]): string {
  return selectedIds.join(',')
}

export function decodeBuild(param: string, traitsById: Map<string, Trait>): string[] {
  if (!param) return []
  return param.split(',').filter(id => traitsById.has(id))
}

// --- localStorage ---

const BUILD_KEY = 'traits.build'
const MODE_KEY = 'traits.builderMode'

export function saveBuild(ids: string[]): void {
  try { localStorage.setItem(BUILD_KEY, JSON.stringify(ids)) } catch {}
}

export function loadBuild(): string[] {
  try {
    const raw = localStorage.getItem(BUILD_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveBuilderMode(on: boolean): void {
  try { localStorage.setItem(MODE_KEY, on ? '1' : '0') } catch {}
}

export function loadBuilderMode(): boolean {
  try { return localStorage.getItem(MODE_KEY) === '1' } catch { return false }
}
