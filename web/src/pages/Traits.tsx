import { useEffect, useMemo, useState, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { fetchTraits } from '../lib/api'
import type { Trait } from '../lib/types'
import {
  classifyFamily, pickBuilderTrait, deriveClanLock,
  clanLockingTraitId, canAddTrait, computeSlotFills, encodeBuild,
  decodeBuild, saveBuild, loadBuild, saveBuilderMode, loadBuilderMode,
  type TraitFamilyLike,
} from '../lib/traitBuilder'
import TraitBuilderPanel from '../components/TraitBuilderPanel'

const SOURCE_TABS = [
  { key: 'all',              label: 'All',         subtitle: 'Every trait',             color: '#8aa074' },
  { key: 'Normal',           label: 'Combat',      subtitle: 'Battle & survival',       color: '#b85050' },
  { key: 'BornBuLuoCiTiao',  label: 'Tribe Born',  subtitle: 'Tribal conditions',       color: '#b8a060' },
  { key: 'BornChuShen',      label: 'Origin',      subtitle: 'Birth traits',            color: '#9b7db8' },
  { key: 'ChengHao',         label: 'Title',       subtitle: 'Achievement awards',      color: '#7a9db5' },
  { key: 'XiHao',            label: 'Preference',  subtitle: 'Likes & affinities',      color: '#6ea09a' },
] as const

type SourceKey = typeof SOURCE_TABS[number]['key']

const CLAN_META: Record<string, { label: string; color: string }> = {
  claw: { label: 'Claw', color: '#b85050' },
  flint: { label: 'Flint', color: '#7a9db5' },
  fang: { label: 'Fang', color: '#6ea09a' },
  wolf: { label: 'Wolf', color: '#8a8ab5' },
  horn: { label: 'Horn', color: '#b8a060' },
  exile: { label: 'Exile', color: '#a67a52' },
  dlc: { label: 'DLC', color: '#9b7db8' },
  heretic: { label: 'Heretic', color: '#c47070' },
}

const PROFICIENCY_LABELS: Record<string, string> = {
  DaJian: 'Greatsword', Dao: 'Sword', Mao: 'Spear', Gong: 'Bow',
  DunPai: 'Shield', Chui: 'Hammer', QuanTao: 'Gauntlet', ShuangDao: 'Dual Blade',
  FaMu: 'Logging', CaiKuang: 'Mining', ZhongZhi: 'Planting', CaiShou: 'Gathering',
  BuZhuo: 'Trapping', YangZhi: 'Breeding', TuZai: 'Butchering',
  FangZhi: 'Weaving', ZhiTao: 'Pottery', PaoMu: 'Carpentry', QieShi: 'Masonry',
  JianZhu: 'Construction', RouPi: 'Leatherwork', PouJie: 'Dissecting', RongLian: 'Smelting',
  QiJu: 'Furniture', WuQi: 'Weaponry', JiaZhou: 'Armorsmithing', LianJin: 'Alchemy',
  ZhuBao: 'Jewelry', PengRen: 'Cooking', YanMo: 'Grinding',
}

const TIER_META: Record<string, { label: string; color: string; bg: string }> = {
  S: { label: 'S-tier', color: '#e74c3c', bg: 'rgba(231,76,60,.12)' },
  A: { label: 'A-tier', color: '#e67e22', bg: 'rgba(230,126,34,.10)' },
  B: { label: 'B-tier', color: '#9b59b6', bg: 'rgba(155,89,182,.10)' },
  C: { label: 'C-tier', color: '#9a9a9a', bg: 'rgba(154,154,154,.08)' },
  D: { label: 'D-tier', color: '#7a6a5a', bg: 'rgba(122,106,90,.10)' },
  F: { label: 'F-tier', color: '#8a4444', bg: 'rgba(138,68,68,.10)' },
}

interface TraitFamily {
  learnedId: string
  name: string
  tiers: Trait[]
  source: string
  isDlc: boolean
  isNegative: boolean
  clan: string | null
  communityTier: string | null
  communityNote: string | null
  effectiveTier: string
  isBorn: boolean
}

const BORN_TOOLTIPS: Record<string, string> = {
  BornBuLuoCiTiao: 'Tribal trait — determined at birth by the tribesman\'s tribe',
  BornChuShen: 'Origin trait — determined at birth by the tribesman\'s class',
  XiHao: 'Preference — innate like or dislike, cannot be learned',
  XingGe: 'Personality type — innate, cannot be changed',
  ChengHao: 'Title — earned through gameplay achievements',
  JingLi: 'Experience trait — acquired through specific events',
  Normal: 'Birth trait — innate, cannot be learned by other tribesmen',
}

type DescSegment = { type: 'text'; value: string } | { type: 'variable'; values: string[] }

function mergeDescriptions(descriptions: string[]): DescSegment[] {
  if (descriptions.length <= 1) {
    return [{ type: 'text', value: descriptions[0] || '' }]
  }
  const numPattern = /(-?\d+\.?\d*%?x?)/g
  const tokenize = (s: string) => {
    const tokens: { text: boolean; value: string }[] = []
    let last = 0
    for (const m of s.matchAll(numPattern)) {
      if (m.index! > last) tokens.push({ text: true, value: s.slice(last, m.index!) })
      tokens.push({ text: false, value: m[0] })
      last = m.index! + m[0].length
    }
    if (last < s.length) tokens.push({ text: true, value: s.slice(last) })
    return tokens
  }
  const allTokens = descriptions.map(tokenize)
  const baseLen = allTokens[0].length
  const sameLength = allTokens.every(t => t.length === baseLen)
  if (!sameLength) {
    return [{ type: 'text', value: descriptions[0] || '' }]
  }
  const segments: DescSegment[] = []
  for (let i = 0; i < baseLen; i++) {
    const base = allTokens[0][i]
    if (base.text) {
      segments.push({ type: 'text', value: base.value })
    } else {
      const values = allTokens.map(t => t[i].value)
      const allSame = values.every(v => v === values[0])
      if (allSame) {
        segments.push({ type: 'text', value: values[0] })
      } else {
        segments.push({ type: 'variable', values })
      }
    }
  }
  return segments
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

function Ornament({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 14 14" className="w-[14px] h-[14px] flex-shrink-0" fill="none" stroke={color} strokeWidth="1" strokeLinecap="square">
      <path d="M7 1 L13 7 L7 13 L1 7 Z" />
      <path d="M7 4 L10 7 L7 10 L4 7 Z" fill={color} stroke="none" opacity=".6" />
    </svg>
  )
}

function TierDiamond({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className="flex-shrink-0">
      <path d="M10 1 L19 10 L10 19 L1 10 Z" fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} />
      <path d="M10 6 L14 10 L10 14 L6 10 Z" fill={color} fillOpacity={0.8} stroke="none" />
    </svg>
  )
}

function StarPips({ star, max = 3 }: { star: number; max?: number }) {
  return (
    <span className="flex gap-[3px] items-center">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="w-[7px] h-[7px] rotate-45 border"
          style={{
            backgroundColor: i < star ? '#b8a060' : 'transparent',
            borderColor: i < star ? '#b8a060' : '#4a5040',
          }}
        />
      ))}
    </span>
  )
}

export default function Traits() {
  const [traits, setTraits] = useState<Trait[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SourceKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dlcFilter, setDlcFilter] = useState<'all' | 'base' | 'dlc'>('all')
  const [signFilter, setSignFilter] = useState<'all' | 'buff' | 'debuff'>('all')
  const [clanFilter, setClanFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Builder state
  const [builderMode, setBuilderMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('build')) return true
    return loadBuilderMode()
  })
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const params = new URLSearchParams(window.location.search)
    const buildParam = params.get('build')
    if (buildParam) return buildParam.split(',').filter(Boolean)
    return loadBuild()
  })
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [fitsFilter, setFitsFilter] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetchTraits()
      .then(setTraits)
      .finally(() => setLoading(false))
  }, [])

  const families = useMemo(() => {
    const map = new Map<string, TraitFamily>()
    for (const t of traits) {
      const key = (t.learned_id && t.learned_id !== '0')
        ? t.learned_id
        : `name:${t.name_en || t.name_zh || t.id}:${t.source || ''}`
      if (!map.has(key)) {
        const src = t.source || 'Normal'
        const hasLearnedId = !!(t.learned_id && t.learned_id !== '0')
        map.set(key, {
          learnedId: key,
          name: t.name_en || t.name_zh || t.id,
          tiers: [],
          source: src,
          isDlc: t.is_dlc,
          isNegative: t.is_negative,
          clan: t.clan,
          communityTier: t.community_tier,
          communityNote: t.community_note,
          effectiveTier: t.community_tier || (t.is_negative ? 'D' : 'C'),
          isBorn: (src !== 'Normal' && src !== 'ChengHao' && src !== 'JingLi') || (src === 'Normal' && !hasLearnedId),
        })
      }
      const fam = map.get(key)!
      fam.tiers.push(t)
      if (t.community_tier && !fam.communityTier) {
        fam.communityTier = t.community_tier
        fam.communityNote = t.community_note
        fam.effectiveTier = t.community_tier
      }
    }
    for (const fam of map.values()) {
      fam.tiers.sort((a, b) => a.star - b.star)
    }
    const arr = Array.from(map.values())
    const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 }
    arr.sort((a, b) => {
      const aT = tierOrder[a.effectiveTier] ?? 3
      const bT = tierOrder[b.effectiveTier] ?? 3
      if (aT !== bT) return aT - bT
      const aMax = Math.max(...a.tiers.map(t => t.star))
      const bMax = Math.max(...b.tiers.map(t => t.star))
      if (aMax !== bMax) return bMax - aMax
      return a.name.localeCompare(b.name, 'zh')
    })
    return arr
  }, [traits])

  // --- Builder derived state ---

  const traitsById = useMemo(() => {
    const m = new Map<string, Trait>()
    for (const t of traits) m.set(t.id, t)
    return m
  }, [traits])

  const familyByTraitId = useMemo(() => {
    const m = new Map<string, TraitFamilyLike>()
    for (const fam of families) {
      for (const t of fam.tiers) m.set(t.id, fam)
    }
    return m
  }, [families])

  useEffect(() => {
    if (traits.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const buildParam = params.get('build')
    if (buildParam) {
      const valid = decodeBuild(buildParam, traitsById)
      setSelectedIds(valid)
      const url = new URL(window.location.href)
      url.searchParams.delete('build')
      history.replaceState(null, '', url.pathname + url.search)
    } else {
      setSelectedIds(prev => prev.filter(id => traitsById.has(id)))
    }
  }, [traits, traitsById])

  useEffect(() => { saveBuild(selectedIds) }, [selectedIds])
  useEffect(() => { saveBuilderMode(builderMode) }, [builderMode])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const lockedClan = useMemo(() => deriveClanLock(selectedIds, familyByTraitId), [selectedIds, familyByTraitId])
  const lockedByTraitIdVal = useMemo(() => clanLockingTraitId(selectedIds, familyByTraitId), [selectedIds, familyByTraitId])
  const slotFills = useMemo(() => computeSlotFills(selectedIds, familyByTraitId), [selectedIds, familyByTraitId])

  const builderCanAdd = useCallback((traitId: string) => {
    return canAddTrait(traitId, traitsById, familyByTraitId, slotFills, lockedClan)
  }, [traitsById, familyByTraitId, slotFills, lockedClan])

  const disabledFamilies = useMemo(() => {
    if (!builderMode) return new Set<string>()
    const s = new Set<string>()
    for (const fam of families) {
      const cat = classifyFamily(fam)
      if (!cat) { s.add(fam.learnedId); continue }
      const trait = pickBuilderTrait(fam)
      if (selectedIds.includes(trait.id)) continue
      if (!builderCanAdd(trait.id).canAdd) s.add(fam.learnedId)
    }
    return s
  }, [builderMode, families, selectedIds, builderCanAdd])

  const addTrait = useCallback((traitId: string) => {
    if (selectedIds.includes(traitId)) return
    if (!builderCanAdd(traitId).canAdd) return
    setSelectedIds(prev => [...prev, traitId])
  }, [selectedIds, builderCanAdd])

  const removeTrait = useCallback((traitId: string) => {
    setSelectedIds(prev => prev.filter(id => id !== traitId))
  }, [])

  const clearAll = useCallback(() => setSelectedIds([]), [])

  const shareBuild = useCallback(() => {
    if (selectedIds.length === 0) return
    const url = new URL(window.location.href)
    url.searchParams.set('build', encodeBuild(selectedIds))
    navigator.clipboard.writeText(url.toString()).then(() => {
      setToast('Build link copied')
    }).catch(() => {
      setToast('Could not copy link')
    })
  }, [selectedIds])

  const filtered = useMemo(() => {
    let result = families
    if (activeTab !== 'all') {
      result = result.filter(f => f.source === activeTab)
    }
    if (dlcFilter === 'base') {
      result = result.filter(f => !f.isDlc)
    } else if (dlcFilter === 'dlc') {
      result = result.filter(f => f.isDlc)
    }
    if (signFilter === 'buff') {
      result = result.filter(f => !f.isNegative)
    } else if (signFilter === 'debuff') {
      result = result.filter(f => f.isNegative)
    }
    if (clanFilter !== 'all') {
      result = result.filter(f => f.clan === clanFilter)
    }
    if (tierFilter !== 'all') {
      result = result.filter(f => f.communityTier === tierFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(f => {
        return f.tiers.some(t =>
          (t.name_en && t.name_en.toLowerCase().includes(q)) ||
          (t.name_zh && t.name_zh.includes(q)) ||
          (t.description_en && t.description_en.toLowerCase().includes(q)) ||
          (t.description_zh && t.description_zh.toLowerCase().includes(q))
        )
      })
    }
    if (builderMode && fitsFilter) {
      result = result.filter(fam => {
        const cat = classifyFamily(fam)
        if (!cat) return false
        const trait = pickBuilderTrait(fam)
        return selectedIds.includes(trait.id) || !disabledFamilies.has(fam.learnedId)
      })
    }
    if (builderMode) {
      result = [...result].sort((a, b) => {
        const aOff = disabledFamilies.has(a.learnedId) ? 1 : 0
        const bOff = disabledFamilies.has(b.learnedId) ? 1 : 0
        return aOff - bOff
      })
    }
    return result
  }, [families, activeTab, dlcFilter, signFilter, clanFilter, tierFilter, searchQuery, builderMode, fitsFilter, selectedIds, disabledFamilies])

  const availableClans = useMemo(() => {
    const tabFamilies = activeTab === 'all' ? families : families.filter(f => f.source === activeTab)
    const clans = new Set<string>()
    for (const f of tabFamilies) {
      if (f.clan) clans.add(f.clan)
    }
    return Array.from(clans).sort()
  }, [families, activeTab])

  const activeCat = SOURCE_TABS.find(t => t.key === activeTab)!
  const rgb = hexToRgb(activeCat.color)

  if (loading) return <div className="p-8 text-text-dim">Loading traits...</div>

  return (
    <>
      <Helmet>
        <title>Tribesman traits - Soulmask Codex</title>
        <meta name="description" content="Complete reference of all tribesman traits (NaturalGifts) in Soulmask, including combat, tribe-born, DLC, and preference traits." />
      </Helmet>

      <div className="flex gap-0">
      <div className={`flex-1 min-w-0 ${!builderMode || panelCollapsed ? 'max-w-5xl' : ''}`}>
        {/* Page header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-[28px] font-bold text-text tracking-[.03em] mb-1">
              Tribesman{' '}
              <span className="font-display italic font-semibold" style={{ color: activeCat.color }}>
                Traits
              </span>
            </h1>
            <p className="text-[12px] text-text-mute italic font-display">
              {traits.length} traits across {families.length} families — combat, personality, origin, and more.
            </p>
          </div>
          <button
            onClick={() => setBuilderMode(prev => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 border transition-colors flex-shrink-0 mt-1"
            style={builderMode
              ? { borderColor: 'rgba(138,160,116,.5)', color: '#8aa074', backgroundColor: 'rgba(138,160,116,.08)' }
              : { borderColor: '#373c32', color: '#6b7163' }
            }
          >
            <span className="text-[10px] uppercase tracking-wider2 font-semibold">Builder</span>
            <span
              className="relative inline-block w-7 h-3.5 rounded-full transition-colors"
              style={{ backgroundColor: builderMode ? '#5a6e48' : '#373c32' }}
            >
              <span
                className="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all"
                style={{
                  left: builderMode ? 14 : 2,
                  backgroundColor: builderMode ? '#8aa074' : '#6b7163',
                }}
              />
            </span>
          </button>
        </div>

        {/* Category tabs */}
        <div className="grid grid-cols-2 md:flex border-b border-hair mb-0">
          {SOURCE_TABS.map(tab => {
            const count = tab.key === 'all'
              ? families.length
              : families.filter(f => f.source === tab.key).length
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative md:flex-1 flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 text-left transition-colors border-b border-hair md:border-b-0 ${
                  active ? 'bg-panel' : 'hover:bg-panel/50'
                }`}
                style={active ? {
                  borderTop: `2px solid ${tab.color}`,
                  borderLeft: '1px solid var(--color-hair, #373c32)',
                  borderRight: '1px solid var(--color-hair, #373c32)',
                  marginBottom: -1,
                } : undefined}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tab.color, opacity: active ? 1 : 0.35 }}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[12px] font-semibold uppercase tracking-wider2 ${active ? '' : 'text-text-mute'}`}
                    style={active ? { color: tab.color } : undefined}
                  >
                    {tab.label}
                  </div>
                  <div className="text-[10px] text-text-dim truncate hidden md:block">{tab.subtitle}</div>
                </div>
                <span
                  className="text-[11px] tabular-nums px-1.5 py-0.5 border"
                  style={active
                    ? { borderColor: `rgba(${hexToRgb(tab.color)},.4)`, color: tab.color }
                    : { borderColor: 'var(--color-hair, #373c32)', color: 'var(--color-text-dim, #6b7163)' }
                  }
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sub-header row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-3 border-b border-hair">
          <div className="text-[11px] text-text-mute uppercase tracking-wider2">
            <span style={{ color: activeCat.color }}>{'◆'}</span>
            {' '}{activeCat.label} — {activeCat.subtitle} · {filtered.length} traits
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search traits..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1 rounded bg-panel border border-hair text-[12px] text-text w-48 placeholder:text-text-faint focus:border-hair-strong focus:outline-none transition-colors"
            />
            <div className="flex gap-1">
              {(['all', 'buff', 'debuff'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setSignFilter(v)}
                  className="px-2.5 py-[3px] text-[10px] tracking-[.08em] uppercase font-medium border transition-colors"
                  style={signFilter === v
                    ? { borderColor: v === 'debuff' ? 'rgba(184,80,80,.5)' : v === 'buff' ? 'rgba(138,160,116,.5)' : '#4a5040', color: v === 'debuff' ? '#b85050' : v === 'buff' ? '#8aa074' : '#d8dcc8', backgroundColor: v === 'debuff' ? 'rgba(184,80,80,.1)' : v === 'buff' ? 'rgba(138,160,116,.1)' : '#363c33' }
                    : { borderColor: '#373c32', color: '#6b7163' }
                  }
                >
                  {v === 'all' ? 'All' : v === 'buff' ? 'Buff' : 'Debuff'}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['all', 'base', 'dlc'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setDlcFilter(v)}
                  className={`px-2.5 py-[3px] text-[10px] tracking-[.08em] uppercase font-medium border transition-colors ${
                    dlcFilter === v
                      ? 'border-hair-strong text-text bg-panel-lift'
                      : 'border-hair text-text-dim hover:text-text hover:border-hair-strong'
                  }`}
                >
                  {v === 'all' ? 'All' : v === 'base' ? 'Base' : 'DLC'}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['all', 'S', 'A', 'B'] as const).map(v => {
                const meta = v !== 'all' ? TIER_META[v] : null
                const active = tierFilter === v
                return (
                  <button
                    key={v}
                    onClick={() => setTierFilter(v)}
                    className="px-2.5 py-[3px] text-[10px] tracking-[.08em] uppercase font-medium border transition-colors flex items-center gap-1"
                    style={active
                      ? { borderColor: meta ? `rgba(${hexToRgb(meta.color)},.5)` : '#4a5040', color: meta?.color ?? '#d8dcc8', backgroundColor: meta?.bg ?? '#363c33' }
                      : { borderColor: '#373c32', color: meta?.color ?? '#6b7163', opacity: 0.7 }
                    }
                  >
                    {meta && <TierDiamond color={meta.color} size={8} />}
                    {v === 'all' ? 'All' : v}
                  </button>
                )
              })}
            </div>
            {builderMode && (
              <button
                onClick={() => setFitsFilter(v => !v)}
                className="px-2.5 py-[3px] text-[10px] tracking-[.08em] uppercase font-medium border transition-colors"
                style={fitsFilter
                  ? { borderColor: 'rgba(138,160,116,.5)', color: '#8aa074', backgroundColor: 'rgba(138,160,116,.1)' }
                  : { borderColor: '#373c32', color: '#6b7163' }
                }
              >
                Fits build
              </button>
            )}
          </div>
        </div>

        {/* Clan filter */}
        {availableClans.length > 0 && (
          <div className="flex items-center gap-2 py-2 border-b border-hair">
            <span className="text-[9px] uppercase tracking-[.1em] text-text-faint mr-1">Clan</span>
            <button
              onClick={() => setClanFilter('all')}
              className="px-2.5 py-[3px] text-[10px] tracking-[.08em] uppercase font-medium border transition-colors"
              style={clanFilter === 'all'
                ? { borderColor: '#4a5040', color: '#d8dcc8', backgroundColor: '#363c33' }
                : { borderColor: '#373c32', color: '#6b7163' }
              }
            >
              All
            </button>
            {availableClans.map(c => {
              const meta = CLAN_META[c]
              if (!meta) return null
              const active = clanFilter === c
              return (
                <button
                  key={c}
                  onClick={() => setClanFilter(active ? 'all' : c)}
                  className="px-2.5 py-[3px] text-[10px] tracking-[.08em] uppercase font-medium border transition-colors flex items-center gap-1.5"
                  style={active
                    ? { borderColor: `rgba(${hexToRgb(meta.color)},.5)`, color: meta.color, backgroundColor: `rgba(${hexToRgb(meta.color)},.1)` }
                    : { borderColor: '#373c32', color: '#6b7163' }
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color, opacity: active ? 1 : 0.4 }} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Trait list */}
        <div className="mt-4 space-y-[2px]">
          {filtered.map(fam => {
            const isExpanded = expandedId === fam.learnedId
            const topTier = fam.tiers[fam.tiers.length - 1]
            const neg = fam.isNegative
            const sourceTab = SOURCE_TABS.find(t => t.key === fam.source)
            const famColor = sourceTab?.color ?? activeCat.color
            const accentColor = neg ? '#b85050' : famColor

            const builderTrait = pickBuilderTrait(fam)
            const isSelected = builderMode && selectedIds.includes(builderTrait.id)
            const isDisabled = builderMode && disabledFamilies.has(fam.learnedId)

            return (
              <div
                key={fam.learnedId}
                className="relative border bg-panel transition-colors"
                style={{
                  borderWidth: 1,
                  borderLeftWidth: 2,
                  borderColor: isSelected ? 'rgba(138,160,116,.4)' : 'var(--color-hair, #373c32)',
                  borderLeftColor: isSelected ? '#8aa074' : neg ? 'rgba(184,80,80,.5)' : 'transparent',
                  opacity: isDisabled ? 0.35 : 1,
                  ...(isExpanded && !isSelected ? { borderColor: `rgba(${hexToRgb(accentColor)},.3)`, borderLeftWidth: 2, borderLeftColor: neg ? 'rgba(184,80,80,.5)' : `rgba(${hexToRgb(famColor)},.3)` } : {}),
                }}
              >
                {/* Top accent line when expanded */}
                {isExpanded && (
                  <div
                    className="absolute -top-px -left-px -right-px h-[2px]"
                    style={{ background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)` }}
                  />
                )}

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : fam.learnedId)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : fam.learnedId) } }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-panel-2 transition-colors cursor-pointer"
                >
                  <StarPips star={topTier.star} />
                  <span className={`font-display text-[15px] font-semibold tracking-[.02em] min-w-0 truncate ${neg ? '' : 'text-text'}`} style={neg ? { color: '#c47070' } : undefined}>
                    {fam.name}
                  </span>
                  {fam.tiers.length > 1 && (
                    <span className="text-[10px] tabular-nums text-text-dim flex-shrink-0">
                      {fam.tiers.length} tiers
                    </span>
                  )}
                  <span className="flex-1" />
                  {neg && (
                    <span
                      className="text-[9px] px-1.5 py-[2px] uppercase tracking-[.1em] font-semibold border flex-shrink-0"
                      style={{ borderColor: 'rgba(184,80,80,.35)', color: '#b85050' }}
                    >
                      Debuff
                    </span>
                  )}
                  {fam.clan && CLAN_META[fam.clan] && fam.clan !== 'dlc' && (
                    <span
                      className="text-[9px] px-1.5 py-[2px] uppercase tracking-[.1em] font-semibold border flex-shrink-0"
                      style={{ borderColor: `rgba(${hexToRgb(CLAN_META[fam.clan].color)},.4)`, color: CLAN_META[fam.clan].color }}
                    >
                      {CLAN_META[fam.clan].label}
                    </span>
                  )}
                  {fam.isDlc && (
                    <span
                      className="text-[9px] px-1.5 py-[2px] uppercase tracking-[.1em] font-semibold border flex-shrink-0"
                      style={{ borderColor: 'rgba(155,125,184,.4)', color: '#9b7db8' }}
                    >
                      DLC
                    </span>
                  )}
                  <span
                    className="text-[9px] w-[52px] text-center py-[2px] uppercase tracking-[.1em] font-semibold border flex-shrink-0"
                    style={fam.isBorn
                      ? { borderColor: 'rgba(184,160,96,.35)', color: '#b8a060' }
                      : { borderColor: 'rgba(138,160,116,.35)', color: '#8aa074' }
                    }
                    title={fam.isBorn
                      ? (BORN_TOOLTIPS[fam.source] || 'Innate trait — cannot be learned')
                      : 'Learnable trait — tribesmen can acquire this through gameplay'
                    }
                  >
                    {fam.isBorn ? 'Born' : 'Learned'}
                  </span>
                  {(() => {
                    const tier = fam.effectiveTier
                    const meta = TIER_META[tier]
                    if (!meta) return null
                    return (
                      <span
                        className="text-[9px] px-1.5 py-[2px] uppercase tracking-[.1em] font-bold border flex-shrink-0 inline-flex items-center gap-1"
                        style={{
                          borderColor: `rgba(${hexToRgb(meta.color)},.4)`,
                          color: meta.color,
                          backgroundColor: meta.bg,
                        }}
                        title={fam.communityNote || undefined}
                      >
                        <TierDiamond color={meta.color} size={8} />
                        {meta.label}
                      </span>
                    )
                  })()}
                  {builderMode && isSelected && (
                    <span
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-sm"
                      style={{ backgroundColor: 'rgba(138,160,116,.15)', color: '#8aa074' }}
                    >
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2.5 6 L5 8.5 L9.5 3.5" />
                      </svg>
                    </span>
                  )}
                  {builderMode && !isSelected && !isDisabled && classifyFamily(fam) && (
                    <button
                      onClick={e => { e.stopPropagation(); addTrait(builderTrait.id) }}
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-sm border border-hair text-text-dim hover:text-green hover:border-green-dim transition-colors"
                      title="Add to build"
                    >
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 2.5 L6 9.5 M2.5 6 L9.5 6" />
                      </svg>
                    </button>
                  )}
                  <svg
                    className={`w-3 h-3 text-text-dim flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                  >
                    <path d="M3 5 L6 8 L9 5" />
                  </svg>
                </div>

                {isExpanded && (() => {
                  const descs = fam.tiers.map(t => t.description_en || t.description_zh || '')
                  const segments = mergeDescriptions(descs)
                  return (
                    <div className="border-t border-hair px-4 py-3"
                      style={{ background: `linear-gradient(90deg, rgba(${neg ? '184,80,80' : rgb},.04) 0%, transparent 60%)` }}
                    >
                      <p className="text-[13px] text-text-mute leading-relaxed mb-2">
                        {segments.map((seg, i) =>
                          seg.type === 'text' ? (
                            <span key={i}>{seg.value}</span>
                          ) : (
                            <span
                              key={i}
                              className="font-semibold tabular-nums"
                              style={{ color: neg ? '#c47070' : '#d8dcc8' }}
                            >
                              {seg.values.join(' / ')}
                            </span>
                          )
                        )}
                      </p>

                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-text-dim mt-2">
                        {topTier.effect_cooldown != null && topTier.effect_cooldown > 0 && (
                          <span>
                            <span className="text-text-faint uppercase tracking-[.08em] text-[9px] mr-1">CD</span>
                            <span className="tabular-nums">{topTier.effect_cooldown}s</span>
                          </span>
                        )}
                        {topTier.effect_probability != null && topTier.effect_probability < 1 && (
                          <span>
                            <span className="text-text-faint uppercase tracking-[.08em] text-[9px] mr-1">PROB</span>
                            <span className="tabular-nums">{(topTier.effect_probability * 100).toFixed(0)}%</span>
                          </span>
                        )}
                      </div>

                      {topTier.proficiencies && topTier.proficiencies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="text-[9px] uppercase tracking-[.1em] text-text-faint mr-1 self-center">Requires</span>
                          {topTier.proficiencies.map(p => (
                            <span
                              key={p}
                              className="text-[10px] tracking-[.06em] px-2 py-[2px] border"
                              style={{ borderColor: 'rgba(122,157,181,.3)', color: '#7a9db5' }}
                            >
                              {PROFICIENCY_LABELS[p] || p}
                            </span>
                          ))}
                        </div>
                      )}

                      {topTier.weapons && topTier.weapons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="text-[9px] uppercase tracking-[.1em] text-text-faint mr-1 self-center">Weapon</span>
                          {topTier.weapons.map(w => (
                            <span
                              key={w}
                              className="text-[10px] tracking-[.06em] px-2 py-[2px] border"
                              style={{ borderColor: 'rgba(166,122,82,.3)', color: '#a67a52' }}
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      )}

                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex items-center justify-center gap-3 py-16">
            <Ornament color="#4a5040" />
            <span className="text-text-dim text-[13px] italic font-display">No traits match your filters.</span>
            <Ornament color="#4a5040" />
          </div>
        )}
      </div>

      {builderMode && (
        <TraitBuilderPanel
          selectedIds={selectedIds}
          traitsById={traitsById}
          familyByTraitId={familyByTraitId}
          slotFills={slotFills}
          lockedClan={lockedClan}
          lockedByTraitId={lockedByTraitIdVal}
          collapsed={panelCollapsed}
          onRemove={removeTrait}
          onClear={clearAll}
          onShare={shareBuild}
          onToggleCollapse={() => setPanelCollapsed(v => !v)}
        />
      )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-panel border border-green-dim text-green text-[12px] font-medium rounded shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}
