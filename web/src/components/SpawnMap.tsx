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

interface Props {
  groups: SpawnGroup[]
  compact?: boolean
}

export default function SpawnMap({ groups, compact }: Props) {
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

    L.imageOverlay('/map-cloud-mist.jpg', MAP_BOUNDS).addTo(map)

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
  }, [groups])

  return (
    <div className={compact ? '' : 'mb-4'}>
      <div
        ref={containerRef}
        className="w-full border border-hair bg-panel"
        style={{ aspectRatio: compact ? '1 / 1' : '4 / 3', maxHeight: compact ? undefined : 600, cursor: 'default' }}
      />
      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {groups.map((g, i) => (
            <div key={g.creature} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
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
