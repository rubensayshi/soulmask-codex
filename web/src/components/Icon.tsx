import { useState } from 'react'
import type { Item } from '../lib/types'
import { noRecipe } from '../lib/graph'

function iconUrl(path: string): string {
  const name = path.split('/').pop()
  return `/icons/${name}.webp`
}

function initials(name: string | null | undefined): string {
  if (!name) return '??'
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  item: Item | undefined
  size?: number
  className?: string
}

export default function Icon({ item, size = 28, className = '' }: Props) {
  const [err, setErr] = useState(false)
  if (!item) return null

  const classes = [
    'tile',
    noRecipe(item) ? 'raw' : '',
    className,
  ].filter(Boolean).join(' ')

  const style = { width: size, height: size }
  const label = item.n ?? item.nz ?? item.id
  const hasImg = item.ic && !err

  return (
    <div className={classes} style={style}>
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
