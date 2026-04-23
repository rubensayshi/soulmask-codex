import type { Item } from '../lib/types'
import { useState } from 'react'
import { noRecipe } from '../lib/graph'

function iconUrl(path: string): string {
  const name = path.split('/').pop()
  return `/icons/${name}.webp`
}

type Variant = 'default' | 'root' | 'raw' | 'rust' | 'green-lit' | 'lit'

interface Props {
  item: Item | undefined
  size?: number
  variant?: Variant
  onClick?: () => void
  className?: string
}

function initials(s: string): string {
  return s.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Diamond({ item, size = 42, variant = 'default', onClick, className = '' }: Props) {
  const [err, setErr] = useState(false)
  if (!item) return null
  const label = item.n ?? item.nz ?? item.id
  const hasImg = item.ic && !err

  const terminal = noRecipe(item)
  const effVariant: Variant = variant === 'default' && terminal ? 'raw' : variant
  const modifier = {
    default:    '',
    root:       'lit',
    raw:        'raw',
    rust:       'rust',
    'green-lit':'green-lit',
    lit:        'lit',
  }[effVariant]

  const hover = onClick && !terminal ? 'hover:border-green hover:-translate-y-px transition-all' : 'transition-colors'
  const cursor = onClick && !terminal ? 'cursor-pointer' : ''

  return (
    <div
      className={`tile ${modifier} ${hover} ${cursor} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      {hasImg ? (
        <img
          src={iconUrl(item.ic as string)}
          alt={label}
          style={{ width: '82%', height: '82%', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }}
          className="object-contain"
          onError={() => setErr(true)}
        />
      ) : (
        <span className="tile-initials" style={{ fontSize: Math.round(size * 0.34) }}>
          {initials(label)}
        </span>
      )}
    </div>
  )
}
