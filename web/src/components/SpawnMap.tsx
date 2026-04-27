import { useMemo, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { SpawnGroup } from '../lib/types'

const COLORS = [
  '#7ec8e3', // light blue
  '#e8a87c', // warm salmon
  '#a8d8d0', // mint
  '#c4a4d4', // lavender
  '#d4a04a', // gold
  '#d47070', // coral
  '#b0d4e8', // powder
  '#a4c8e0', // steel
]

const MAP_BOUNDS: L.LatLngBoundsExpression = [[-4096, 0], [0, 4096]]

const CDN_BASE = import.meta.env.VITE_ICON_BASE || '/icons'

const MAP_IMAGES: Record<string, string> = {
  base: `${CDN_BASE}/map-cloud-mist.jpg`,
  dlc: `${CDN_BASE}/map-shifting-sands.jpg`,
}

function parseLevelLow(level: string): number {
  const m = level.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

interface CreatureSummary {
  creature: string
  color: string
  levelRange: string
  count: number
}

interface Props {
  groups: SpawnGroup[]
  mapType?: 'base' | 'dlc'
  compact?: boolean
}

export default function SpawnMap({ groups, mapType = 'base', compact }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  const creatureColorMap = useMemo(() => {
    const creatures = [...new Set(groups.map(g => g.creature))]
    const m = new Map<string, string>()
    creatures.forEach((c, i) => m.set(c, COLORS[i % COLORS.length]))
    return m
  }, [groups])

  const legend: CreatureSummary[] = useMemo(() => {
    const m = new Map<string, { levels: string[], count: number }>()
    for (const g of groups) {
      let entry = m.get(g.creature)
      if (!entry) { entry = { levels: [], count: 0 }; m.set(g.creature, entry) }
      if (g.level) entry.levels.push(g.level)
      entry.count += g.spawns.length
    }
    return [...m.entries()].map(([creature, { levels, count }]) => {
      let levelRange = ''
      if (levels.length > 0) {
        const nums = levels.flatMap(l => l.split(/\s*-\s*/).map(Number)).filter(n => !isNaN(n))
        if (nums.length > 0) levelRange = `${Math.min(...nums)} – ${Math.max(...nums)}`
      }
      return { creature, color: creatureColorMap.get(creature)!, levelRange, count }
    })
  }, [groups, creatureColorMap])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomSnap: 0.1,
      minZoom: -5,
    })

    L.imageOverlay(MAP_IMAGES[mapType] ?? MAP_IMAGES.base, MAP_BOUNDS).addTo(map)

    map.fitBounds(MAP_BOUNDS)

    const allPts: L.LatLng[] = []
    const sorted = [...groups].sort((a, b) => parseLevelLow(a.level) - parseLevelLow(b.level))
    sorted.forEach(group => {
      const color = creatureColorMap.get(group.creature) ?? COLORS[0]
      const label = group.level ? `${group.creature} Lv ${group.level}` : group.creature
      group.spawns.forEach(pt => {
        allPts.push(L.latLng(pt.lat, pt.lon))
        L.circleMarker([pt.lat, pt.lon], {
          radius: compact ? 3 : 5,
          color: '#000',
          fillColor: color,
          fillOpacity: 0.85,
          weight: 1.5,
          opacity: 0.5,
        }).bindTooltip(label, { direction: 'top', offset: [0, -6] }).addTo(map)
      })
    })

    if (allPts.length > 0) {
      const spawnBounds = L.latLngBounds(allPts)
      const padLat = Math.max((spawnBounds.getNorth() - spawnBounds.getSouth()) * 0.15, 80)
      const padLng = Math.max((spawnBounds.getEast() - spawnBounds.getWest()) * 0.15, 80)
      const paddedBounds = L.latLngBounds(
        [spawnBounds.getSouth() - padLat, spawnBounds.getWest() - padLng],
        [spawnBounds.getNorth() + padLat, spawnBounds.getEast() + padLng],
      )
      const baseZoom = map.getZoom()
      const maxStep = compact ? 0.5 : 1
      let bestZoom = baseZoom
      for (let step = maxStep; step >= 0.1; step -= 0.1) {
        map.setView(spawnBounds.getCenter(), baseZoom + step)
        if (map.getBounds().contains(paddedBounds)) {
          bestZoom = baseZoom + step
          break
        }
      }
      if (bestZoom > baseZoom) {
        map.setView(spawnBounds.getCenter(), bestZoom)
      } else {
        map.fitBounds(MAP_BOUNDS)
      }
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [groups, mapType, creatureColorMap])

  return (
    <div className={compact ? '' : 'mb-4'}>
      <div
        ref={containerRef}
        className="w-full bg-panel"
        style={{ aspectRatio: compact ? '1 / 1' : '4 / 3', maxHeight: compact ? undefined : 600, cursor: 'default' }}
      />
      {legend.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {legend.map(l => (
            <div key={l.creature} className="flex items-center gap-1 text-[10px]">
              <span
                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: l.color }}
              />
              <span className="text-text">{l.creature}</span>
              {l.levelRange && (
                <span className="text-text-dim">Lv {l.levelRange}</span>
              )}
              <span className="text-text-mute tabular-nums">({l.count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
