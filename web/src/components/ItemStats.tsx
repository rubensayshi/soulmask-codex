import type { StatEntry } from '../lib/types'

const STAT_NAMES: Record<string, string> = {
  Attack: 'Attack',
  Defense: 'Defense',
  Crit: 'Critical Chance',
  CritDamageInc: 'Critical Damage',
  CritDamageDec: 'Critical Damage Reduction',
  CritDef: 'Critical Defense',
  DamageInc: 'Damage Bonus',
  DamageDec: 'Damage Reduction',
  MaxHealth: 'Max Health',
  HealthRecover: 'Health Regen',
  MaxTiLi: 'Max Stamina',
  TiLiRecover: 'Stamina Regen',
  TiLiWakenJianMian: 'Stamina Reduction',
  MaxTenacity: 'Max Tenacity',
  WeakenTenacityDefense: 'Tenacity Defense',
  MaxFood: 'Max Food',
  MaxWater: 'Max Water',
  MaxFuZhong: 'Max Carry Weight',
  SpeedRate: 'Movement Speed',
  AttackSpeed: 'Attack Speed',
  WuQiDamage: 'Weapon Damage',
  WuQiDamageInc: 'Weapon Damage Bonus',
  WuQiDamageDec: 'Weapon Damage Taken',
  WuQiDamageDecIgnore: 'Armor Penetration',
  WuQiDamageIncAgainstDun: 'Damage vs Shields',
  WuQiDunDamageDec: 'Shield Damage Taken',
  WuQiEventMagnitude: 'Weapon Effect Power',
  BlockWeakenTenacityDefense: 'Block Tenacity',
  BaTi: 'Poise',
  ShengYinRatio: 'Noise Level',
  WenDuBaoNuan: 'Cold Insulation',
  WenDuSanRe: 'Heat Dissipation',
  WenDuAdd: 'Temperature Bonus',
  YinBiValue: 'Stealth',
  HanKang: 'Cold Resistance',
  YanKang: 'Heat Resistance',
  FuKang: 'Corrosion Resistance',
  DuKang: 'Poison Resistance',
  ZhuangBeiFangDu: 'Poison Defense',
  ZhuangBeiFangFuShe: 'Radiation Defense',
  BleedingDamageCarried: 'Bleed Damage',
  BleedingDamageDecRate: 'Bleed Resistance',
  ParalysisDamageCarried: 'Paralysis Damage',
  ParalysisDamageDecRate: 'Paralysis Resistance',
  FallSleepDamageCarried: 'Sleep Damage',
  FallSleepDamageDecRate: 'Sleep Resistance',
  PoisoningDamageDecRate: 'Poisoning Resistance',
  FallDamageDec: 'Fall Damage Reduction',
  HeadMaxHP: 'Head Max HP',
  BodyMaxHP: 'Body Max HP',
  LeftArmMaxHP: 'Left Arm Max HP',
  LeftLegMaxHP: 'Left Leg Max HP',
}

const PERCENTAGE_STATS = new Set([
  'Crit', 'CritDamageInc', 'CritDamageDec', 'CritDef',
  'DamageInc', 'DamageDec', 'WuQiDamageInc', 'WuQiDamageDec',
  'WuQiDamageDecIgnore', 'WuQiDamageIncAgainstDun',
  'AttackSpeed', 'TiLiWakenJianMian', 'WeakenTenacityDefense',
  'BleedingDamageDecRate', 'ParalysisDamageDecRate',
  'FallSleepDamageDecRate', 'PoisoningDamageDecRate',
  'FallDamageDec', 'ZhuangBeiFangDu', 'ZhuangBeiFangFuShe',
  'CritDef', 'ShengYinRatio',
])

function formatValue(attr: string, value: number, op?: string | null): string {
  const isMultiplicative = op === 'Multiplicitive' || op === 'Multiplicative'
  if (isMultiplicative || PERCENTAGE_STATS.has(attr)) {
    return `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
  }
  const rounded = Math.round(value * 100) / 100
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

interface Props {
  stats: StatEntry[]
}

function mergeStats(stats: StatEntry[]): StatEntry[] {
  const merged = new Map<string, StatEntry>()
  for (const s of stats) {
    const key = `${s.attr}:${s.op ?? ''}`
    const existing = merged.get(key)
    if (existing) {
      existing.value += s.value
    } else {
      merged.set(key, { ...s })
    }
  }
  return [...merged.values()]
}

export default function ItemStats({ stats }: Props) {
  if (!stats.length) return null
  const rows = mergeStats(stats)

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-0 text-[12px] mb-4">
      {rows.map((s, i) => (
        <div key={i} className="flex items-center justify-between py-[4px] border-b border-hair">
          <span className="text-text-dim">{STAT_NAMES[s.attr] ?? s.attr}</span>
          <span className="font-medium text-text tabular-nums">{formatValue(s.attr, s.value, s.op)}</span>
        </div>
      ))}
    </div>
  )
}
