'use client'

import { useState, useEffect, useRef } from 'react'
import type { Incident, Gateway } from './types'
import { mockIncidents, mockGateway } from './mock-data'
import type { LiveEvent } from '@/components/dashboard/event-log'

// ──────────────────────────────────────────────
// Types matching server.js device shape
// ──────────────────────────────────────────────
interface LiveDevice {
  deviceId: string
  alarm: boolean
  eventType: string
  source: string
  smoke: number
  battery: number
  lastSeen: string | null
  status: 'online' | 'offline'
  rssi: number
  snr: number
  sf: number
  dataRate: string
  uptime: number
  frequency: number | string
  sequence: number
  totalAlarms: number
  gatewayId: string
  location: {
    building: string
    floor: string
    zone: string
    district: string
    lat: number
    lng: number
  }
}

// ──────────────────────────────────────────────
// Device → Incident conversion
// ──────────────────────────────────────────────
function deviceToIncident(device: LiveDevice, receivedAt: Date): Incident {
  const priority =
    device.alarm ? 'critical'
    : device.totalAlarms > 0 ? 'high'
    : 'medium'

  const status: Incident['status'] =
    device.alarm ? 'active'
    : device.totalAlarms > 0 ? 'acknowledged'
    : 'resolved'

  const alarmSource =
    device.source === 'facp'
      ? 'Галын Дохиоллын FACP Реле'
      : device.source === 'button'
      ? 'Галын Дохиоллын Гар Товчлуур'
      : 'Галын Дохиоллын Систем'

  const detectedAt = new Date(receivedAt.getTime() - 5000)
  const bridgedAt  = new Date(receivedAt.getTime() - 3000)

  return {
    id: `INC-${device.deviceId.toUpperCase()}`,
    priority,
    status,
    building: device.location.building,
    district: device.location.district || 'Улаанбаатар',
    floor: device.location.floor,
    zone: device.location.zone,
    alarmSource,
    timeDetected: detectedAt,
    timeBridged: bridgedAt,
    timeReceived: receivedAt,
    coordinates: [device.location.lat, device.location.lng],
  }
}

function devicesToGateway(devices: LiveDevice[], base: Gateway): Gateway {
  const active = devices.find(d => d.rssi !== 0 && d.status === 'online')
  if (!active) return base
  return {
    ...base,
    rssi: active.rssi,
    snr: active.snr,
    battery: active.battery,
    lastHeartbeat: new Date(),
    status: 'online',
    name: active.gatewayId
      ? `LoRa Гарц — ${active.gatewayId}`
      : base.name,
  }
}

// ──────────────────────────────────────────────
// Local override type (acknowledge / resolve)
// ──────────────────────────────────────────────
interface StatusOverride {
  status: Incident['status']
  timeAcknowledged?: Date
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────
export function useLiveData() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [gateway, setGateway]     = useState<Gateway>({ ...mockGateway, lastHeartbeat: new Date(0) })
  const [isLive, setIsLive]       = useState(false)
  const [overrides, setOverrides] = useState<Record<string, StatusOverride>>({})
  const [events, setEvents]       = useState<LiveEvent[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  // ── Acknowledge: active → acknowledged ──────
  const acknowledgeIncident = (id: string) => {
    setOverrides(prev => ({
      ...prev,
      [id]: { status: 'acknowledged', timeAcknowledged: new Date() },
    }))
  }

  // ── Resolve: → resolved ─────────────────────
  const resolveIncident = (id: string) => {
    setOverrides(prev => ({
      ...prev,
      [id]: { status: 'resolved' },
    }))
  }

  useEffect(() => {
    let destroyed = false

    function connect() {
      if (destroyed) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!destroyed) setIsLive(true)
      }

      ws.onmessage = (ev) => {
        if (destroyed) return
        try {
          const msg = JSON.parse(ev.data as string)
          const now = new Date()

          if (msg.type === 'init') {
            const devList: LiveDevice[] = Object.values(msg.devices || {})
            if (devList.length > 0) {
              const liveIncidents = devList
                .filter(d => d.status === 'online' || d.totalAlarms > 0)
                .map(d => deviceToIncident(d, now))
              setIncidents(liveIncidents)
              setGateway(prev => devicesToGateway(devList, prev))
            }
            if (msg.history) setEvents((msg.history as LiveEvent[]).slice(0, 100))
          }

          if (msg.type === 'update') {
            const devList: LiveDevice[] = Object.values(msg.devices || {})
            if (devList.length > 0) {
              const liveIncidents = devList
                .filter(d => d.status === 'online' || d.totalAlarms > 0)
                .map(d => deviceToIncident(d, now))

              // Шинэ alarm ирвэл override арилгана
              setOverrides(prev => {
                const next = { ...prev }
                liveIncidents.forEach(inc => {
                  if (inc.status === 'active') delete next[inc.id]
                })
                return next
              })

              setIncidents(liveIncidents)
              setGateway(prev => devicesToGateway(devList, prev))
            }
            if (msg.event) {
              setEvents(prev => [msg.event as LiveEvent, ...prev].slice(0, 100))
            }
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        if (destroyed) return
        setIsLive(false)
        setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      destroyed = true
      wsRef.current?.close()
    }
  }, [])

  // Override-г incident-тэй нийлүүлэх
  const mergedIncidents = incidents.map(inc => {
    const ov = overrides[inc.id]
    if (!ov) return inc
    return {
      ...inc,
      status: ov.status,
      timeAcknowledged: ov.timeAcknowledged ?? inc.timeAcknowledged,
    }
  })

  return { incidents: mergedIncidents, gateway, isLive, events, acknowledgeIncident, resolveIncident }
}
