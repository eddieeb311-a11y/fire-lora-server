import type { Incident, ResponsePoint, Gateway } from './types'

export const mockIncidents: Incident[] = [
  {
    id: 'INC-2024-001',
    priority: 'critical',
    status: 'active',
    building: 'Төв Цамхаг А Блок',
    district: 'Баянгол дүүрэг',
    floor: 'B1',
    zone: 'Цахилгааны өрөө',
    alarmSource: 'Галын Дохиоллын Реле',
    timeDetected: new Date(Date.now() - 180000), // 3 мин өмнө
    timeBridged: new Date(Date.now() - 175000),
    timeReceived: new Date(Date.now() - 170000),
    coordinates: [47.9184, 106.9177],
  },
  {
    id: 'INC-2024-002',
    priority: 'high',
    status: 'acknowledged',
    building: 'Энхтайваны Өргөн Чөлөөний Цогцолбор',
    district: 'Сүхбаатар дүүрэг',
    floor: '12',
    zone: 'Серверийн өрөө',
    alarmSource: 'Галын Дохиоллын Утааны Мэдрэгч',
    timeDetected: new Date(Date.now() - 720000), // 12 мин өмнө
    timeBridged: new Date(Date.now() - 715000),
    timeReceived: new Date(Date.now() - 710000),
    timeAcknowledged: new Date(Date.now() - 600000),
    coordinates: [47.9212, 106.9234],
  },
  {
    id: 'INC-2024-003',
    priority: 'medium',
    status: 'active',
    building: 'Улсын Их Дэлгүүр',
    district: 'Чингэлтэй дүүрэг',
    floor: '3',
    zone: 'Агуулах',
    alarmSource: 'Галын Дохиоллын Дулааны Мэдрэгч',
    timeDetected: new Date(Date.now() - 420000), // 7 мин өмнө
    timeBridged: new Date(Date.now() - 415000),
    timeReceived: new Date(Date.now() - 410000),
    coordinates: [47.9156, 106.9145],
  },
]

export const mockResponsePoints: ResponsePoint[] = [
  {
    id: 'RP-001',
    name: 'Баянгол Галын Анги №1',
    type: 'fire_station',
    coordinates: [47.9134, 106.9097],
    distance: 1.2,
    eta: 4,
    isNearest: true,
  },
  {
    id: 'RP-002',
    name: 'Төв Яаралтай Тусламжийн Анги',
    type: 'emergency_center',
    coordinates: [47.9245, 106.9312],
    distance: 2.8,
    eta: 8,
    isNearest: false,
  },
  {
    id: 'RP-003',
    name: 'Сүхбаатар Галын Анги №2',
    type: 'fire_station',
    coordinates: [47.9298, 106.9187],
    distance: 3.1,
    eta: 9,
    isNearest: false,
  },
]

export const mockGateway: Gateway = {
  id: 'GW-UB-047',
  name: 'Дотоод Гарц — А Блок',
  coordinates: [47.9180, 106.9170],
  battery: 87,
  rssi: -72,
  snr: 9.5,
  lastHeartbeat: new Date(Date.now() - 15000),
  status: 'online',
}

export const consoleLocation: [number, number] = [47.9265, 106.9350]
