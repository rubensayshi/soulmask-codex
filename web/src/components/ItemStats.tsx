import type { StatEntry } from '../lib/types'

const STAT_NAMES: Record<string, string> = {
  Attack: 'Attack',
  Defense: 'Defense',
  Crit: 'Critical Chance',
  CritDamageInc: 'Critical Damage',
  CritDef: 'Critical Defense',
  MaxHealth: 'Max Health',
  HealthRecover: 'Health Regen',
  MaxTiLi: 'Max Stamina',
  TiLiRecover: 'Stamina Regen',
  TiLiWakenJianMian: 'Stamina Reduction',
  MaxFood: 'Max Food',
  MaxWater: 'Max Water',
  MaxFuZhong: 'Max Carry Weight',
  SpeedRate: 'Movement Speed',
  WuQiDamage: 'Weapon Damage',
  WuQiDamageInc: 'Weapon Damage Bonus',
  WuQiDamageDec: 'Weapon Damage Taken',
  WuQiDamageIncAgainstDun: 'Damage vs Shields',
  WuQiDunDamageDec: 'Shield Damage Taken',
  WuQiEventMagnitude: 'Weapon Effect Power',
  DamageDec: 'Damage Reduction',
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
  ZhuangBeiFangDu: 'Equipment Poison Def',
  ZhuangBeiFangFuShe: 'Equipment Radiation Def',
  BleedingDamageCarried: 'Bleed Damage',
  ParalysisDamageCarried: 'Paralysis Damage',
  FallSleepDamageCarried: 'Sleep Damage',
  FallDamageDec: 'Fall Damage Reduction',
  HeadMaxHP: 'Head Max HP',
  BodyMaxHP: 'Body Max HP',
  LeftArmMaxHP: 'Left Arm Max HP',
  LeftLegMaxHP: 'Left Leg Max HP',
}

function formatValue(value: number): string {
  if (Math.abs(value) < 1 && value !== 0) {
    return `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
  }
  const rounded = Math.round(value * 100) / 100
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

interface Props {
  stats: StatEntry[]
}

export default function ItemStats({ stats }: Props) {
  if (!stats.length) return null

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-0 text-[12px] mb-4">
      {stats.map((s, i) => (
        <div key={i} className="flex items-center justify-between py-[4px] border-b border-hair">
          <span className="text-text-dim">{STAT_NAMES[s.attr] ?? s.attr}</span>
          <span className="font-medium text-text tabular-nums">{formatValue(s.value)}</span>
        </div>
      ))}
    </div>
  )
}
