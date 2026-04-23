'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Incident, ResponsePoint, Gateway } from '@/lib/types'
import { consoleLocation } from '@/lib/mock-data'

interface ResponseMapProps {
  incident: Incident | null
  responsePoints: ResponsePoint[]
  gateway: Gateway
}

// Custom fire incident marker — triple-ring pulse for maximum visibility
const fireIcon = L.divIcon({
  className: 'fire-marker',
  html: `
    <div style="position: relative; width: 72px; height: 72px;">
      <div style="
        position: absolute; top: 50%; left: 50%;
        width: 68px; height: 68px; border-radius: 50%;
        border: 1.5px solid rgba(239,68,68,0.2);
        animation: pulse-expand 2.4s 0.9s ease-out infinite;
      "></div>
      <div style="
        position: absolute; top: 50%; left: 50%;
        width: 50px; height: 50px; border-radius: 50%;
        border: 2px solid rgba(239,68,68,0.38);
        animation: pulse-expand 2.4s 0.45s ease-out infinite;
      "></div>
      <div style="
        position: absolute; top: 50%; left: 50%;
        width: 36px; height: 36px; border-radius: 50%;
        background: radial-gradient(circle, rgba(239,68,68,0.55) 0%, transparent 70%);
        animation: pulse-expand 2.4s ease-out infinite;
      "></div>
      <div style="
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 32px; height: 32px;
        background: linear-gradient(140deg, #ef4444 0%, #b91c1c 100%);
        border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.95);
        box-shadow: 0 0 0 2px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,1), 0 0 44px rgba(239,68,68,0.6);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.3">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [72, 72],
  iconAnchor: [36, 36],
})

// Fire station marker
const stationIcon = L.divIcon({
  className: 'station-marker',
  html: `
    <div style="
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border-radius: 6px;
      border: 2px solid #86efac;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

// Nearest station marker (highlighted)
const nearestStationIcon = L.divIcon({
  className: 'nearest-station-marker',
  html: `
    <div style="position: relative; width: 36px; height: 36px;">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 36px;
        height: 36px;
        background: radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%);
        border-radius: 50%;
        animation: pulse-ring 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        border-radius: 6px;
        border: 2px solid #86efac;
        box-shadow: 0 0 15px rgba(34, 197, 94, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

// Gateway marker
const gatewayIcon = L.divIcon({
  className: 'gateway-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border-radius: 4px;
      border: 2px solid #93c5fd;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
        <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// Console marker
const consoleIcon = L.divIcon({
  className: 'console-marker',
  html: `
    <div style="
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      border-radius: 6px;
      border: 2px solid #c4b5fd;
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function MapController({ incident }: { incident: Incident | null }) {
  const map = useMap()
  
  useEffect(() => {
    if (incident) {
      map.flyTo(incident.coordinates, 14, { duration: 1 })
    }
  }, [incident, map])
  
  return null
}

export function ResponseMap({ incident, responsePoints, gateway }: ResponseMapProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[oklch(0.1_0.005_260)]">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--signal-blue)] border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    )
  }

  const nearestPoint = responsePoints.find(p => p.isNearest)
  const defaultCenter: [number, number] = incident?.coordinates || [47.9184, 106.9177]

  // Route from nearest station to incident
  const routeToIncident = incident && nearestPoint ? [
    nearestPoint.coordinates,
    [nearestPoint.coordinates[0] + 0.002, nearestPoint.coordinates[1] + 0.003] as [number, number],
    [incident.coordinates[0] - 0.001, incident.coordinates[1] - 0.002] as [number, number],
    incident.coordinates,
  ] : []

  // Signal path from building to gateway to console
  const signalPath = incident ? [
    incident.coordinates,
    gateway.coordinates,
    consoleLocation,
  ] : []

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={defaultCenter}
        zoom={14}
        className="h-full w-full"
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        <MapController incident={incident} />

        {/* Gateway coverage radius */}
        <Circle
          center={gateway.coordinates}
          radius={800}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '5, 5',
          }}
        />

        {/* Signal path (LoRaWAN visualization) */}
        {incident && signalPath.length > 0 && (
          <Polyline
            positions={signalPath}
            pathOptions={{
              color: '#3b82f6',
              weight: 2,
              opacity: 0.7,
              dashArray: '8, 12',
            }}
          />
        )}

        {/* Route glow underlay */}
        {incident && routeToIncident.length > 0 && (
          <Polyline
            positions={routeToIncident}
            pathOptions={{
              color: '#22c55e',
              weight: 14,
              opacity: 0.15,
            }}
          />
        )}

        {/* Dispatch route — animated dashed line */}
        {incident && routeToIncident.length > 0 && (
          <Polyline
            positions={routeToIncident}
            pathOptions={{
              color: '#22c55e',
              weight: 5,
              opacity: 0.95,
              dashArray: '12 5',
              className: 'response-route',
            }}
          />
        )}

        {/* Fire incident marker */}
        {incident && (
          <Marker position={incident.coordinates} icon={fireIcon}>
            <Popup className="custom-popup">
              <div className="p-1">
                <div className="font-bold text-red-600 text-sm uppercase tracking-wide">Гал Түймрийн Дохиолол Идэвхтэй</div>
                <div className="text-sm font-medium mt-0.5">{incident.building}</div>
                <div className="text-xs text-gray-500">{incident.district} · {incident.floor}-р давхар · {incident.zone}</div>
                <div className="text-xs text-gray-400 mt-1 font-mono">{incident.id}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Gateway marker */}
        <Marker position={gateway.coordinates} icon={gatewayIcon}>
          <Popup>
            <div className="p-1">
              <div className="font-bold text-blue-600 text-sm">LoRa Дамжуулагч Гарц</div>
              <div className="text-sm">{gateway.name}</div>
              <div className="text-xs text-gray-500 font-mono">ID: {gateway.id}</div>
              <div className="text-xs text-gray-400 mt-0.5">RSSI {gateway.rssi} dBm · SNR {gateway.snr} dB</div>
            </div>
          </Popup>
        </Marker>

        {/* Console marker */}
        <Marker position={consoleLocation} icon={consoleIcon}>
          <Popup>
            <div className="p-1">
              <div className="font-bold text-purple-600 text-sm">Дуудлагын Диспетчерийн Консол</div>
              <div className="text-sm text-gray-600">Улаанбаатарын Дуудлага Хүлээн Авагчийн Төв</div>
            </div>
          </Popup>
        </Marker>

        {/* Response points */}
        {responsePoints.map((point) => (
          <Marker
            key={point.id}
            position={point.coordinates}
            icon={point.isNearest ? nearestStationIcon : stationIcon}
          >
            <Popup>
              <div className="p-1">
                <div className="font-bold text-green-700 text-sm">{point.name}</div>
                <div className="text-sm text-gray-600">
                  {point.distance} км · {point.eta} мин ирэх
                </div>
                {point.isNearest && (
                  <div className="mt-1 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 font-semibold">
                    ТОМИЛОГДСОН · ЗАМДАА
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] rounded-lg bg-card/95 p-3 backdrop-blur-sm border border-border">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Тайлбар
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[var(--alert-critical)] shadow-[0_0_6px_var(--alert-critical)]" />
            <span className="text-foreground">Гал Түймрийн Дохиолол</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-[var(--status-online)]" />
            <span className="text-foreground">Гал Унтраах Аврах Анги</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-[var(--signal-blue)]" />
            <span className="text-foreground">LoRa Дамжуулагч Гарц</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4" style={{ background: 'repeating-linear-gradient(90deg, var(--signal-blue) 0, var(--signal-blue) 4px, transparent 4px, transparent 7px)' }} />
            <span className="text-foreground">Дохионы Зам</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 bg-[var(--status-online)]" />
            <span className="text-foreground">Дуудлагын Зам</span>
          </div>
        </div>
      </div>

      {/* City Label */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="rounded-lg bg-card/95 px-3 py-2 backdrop-blur-sm border border-border">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Хамрах Бүс
          </div>
          <div className="text-sm font-semibold text-foreground">
            Улаанбаатар, Монгол
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
            47.9°N 106.9°E
          </div>
        </div>
      </div>
    </div>
  )
}
