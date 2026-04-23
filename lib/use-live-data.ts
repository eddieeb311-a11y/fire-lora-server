'use client'

import { useState, useEffect, useRef } from 'react'
import type { Incident, Gateway } from './types'
import { mockIncidents, mockGateway } from './mock-data'

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
// Hook
// ──────────────────────────────────────────────
export function useLiveData() {
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents)
  const [gateway, setGateway]     = useState<Gateway>(mockGateway)
  const [isLive, setIsLive]       = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

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

          if (msg.type === 'init' || msg.type === 'update') {
            const devList: LiveDevice[] = Object.values(msg.devices || {})
            if (devList.length > 0) {
              const liveIncidents = devList
                .filter(d => d.status === 'online' || d.totalAlarms > 0)
                .map(d => deviceToIncident(d, now))
              // Always show something — fall back to mock if no live data yet
              setIncidents(liveIncidents.length > 0 ? liveIncidents : mockIncidents)
              setGateway(prev => devicesToGateway(devList, prev))
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

  return { incidents, gateway, isLive }
}
