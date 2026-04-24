import { useEffect, useRef } from 'react'
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

const MAP_IMAGES: Record<string, string> = {
  base: '/map-cloud-mist.jpg',
  dlc: '/map-shifting-sands.jpg',
}

const MAP_LABELS: Record<string, string> = {
  base: 'Cloud & Mist',
  dlc: 'Shifting Sands',
}

interface Props {
  groups: SpawnGroup[]
  mapType?: 'base' | 'dlc'
  compact?: boolean
}

export default function SpawnMap({ groups, mapType = 'base', compact }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

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
    groups.forEach((group, gi) => {
      const color = COLORS[gi % COLORS.length]
      group.spawns.forEach(pt => {
        allPts.push(L.latLng(pt.lat, pt.lon))
        L.circleMarker([pt.lat, pt.lon], {
          radius: compact ? 3 : 5,
          color: '#000',
          fillColor: color,
          fillOpacity: 0.85,
          weight: 1.5,
          opacity: 0.5,
        }).addTo(map)
      })
    })

    if (allPts.length > 0) {
      const spawnBounds = L.latLngBounds(allPts)
      const baseZoom = map.getZoom()
      const maxStep = compact ? 0.5 : 1
      let bestZoom = baseZoom
      for (let step = maxStep; step >= 0.1; step -= 0.1) {
        map.setView(spawnBounds.getCenter(), baseZoom + step)
        if (map.getBounds().contains(spawnBounds)) {
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
  }, [groups, mapType])

  return (
    <div className={compact ? '' : 'mb-4'}>
      <div
        ref={containerRef}
        className="w-full bg-panel"
        style={{ aspectRatio: compact ? '1 / 1' : '4 / 3', maxHeight: compact ? undefined : 600, cursor: 'default' }}
      />
      {groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {groups.map((g, i) => (
            <div key={g.creature} className="flex items-center gap-1 text-[10px]">
              <span
                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-text">{g.creature}</span>
              {g.level && (
                <span className="text-text-dim">Lv {g.level}</span>
              )}
              <span className="text-text-mute tabular-nums">({g.spawns.length})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
