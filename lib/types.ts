export interface Incident {
  id: string
  priority: 'critical' | 'high' | 'medium'
  status: 'active' | 'acknowledged' | 'resolved'
  building: string
  district: string
  floor: string
  zone: string
  alarmSource: string
  timeDetected: Date
  timeReceived: Date
  timeBridged: Date
  timeAcknowledged?: Date
  coordinates: [number, number]
}

export interface ResponsePoint {
  id: string
  name: string
  type: 'fire_station' | 'emergency_center'
  coordinates: [number, number]
  distance: number
  eta: number
  isNearest: boolean
}

export interface Gateway {
  id: string
  name: string
  coordinates: [number, number]
  battery: number
  rssi: number
  snr: number
  lastHeartbeat: Date
  status: 'online' | 'offline' | 'warning'
}

export interface SignalPath {
  building: [number, number]
  gateway: [number, number]
  console: [number, number]
}
