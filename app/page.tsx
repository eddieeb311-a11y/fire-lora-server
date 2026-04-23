'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Navigation, Wifi, FlameKindling, CheckCheck, Phone } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { IncidentQueue } from '@/components/dashboard/incident-queue'
import { IncidentDetails } from '@/components/dashboard/incident-details'
import { SignalIndicator } from '@/components/dashboard/signal-indicator'
import { EventLog } from '@/components/dashboard/event-log'
import { mockResponsePoints } from '@/lib/mock-data'
import { useLiveData } from '@/lib/use-live-data'
import { useAlarmSound } from '@/hooks/use-alarm-sound'

// Dynamic import for map to avoid SSR issues with Leaflet
const ResponseMap = dynamic(
  () => import('@/components/dashboard/response-map').then(mod => mod.ResponseMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[oklch(0.1_0.005_260)]">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--signal-blue)] border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Газрын зураг ачааллаж байна...</p>
        </div>
      </div>
    )
  }
)

export default function EmergencyDashboard() {
  const { incidents, gateway, isLive, events, acknowledgeIncident, resolveIncident } = useLiveData()
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)

  // Alarm дуу — active incident байвал тоглуулна
  const hasActiveAlarm = incidents.some(i => i.status === 'active')
  useAlarmSound(hasActiveAlarm)

  // Auto-select first active incident, then first incident overall
  const firstActiveId = incidents.find(i => i.status === 'active')?.id ?? null
  const effectiveId   = selectedIncidentId ?? firstActiveId ?? incidents[0]?.id ?? null

  const selectedIncident  = incidents.find(i => i.id === effectiveId) || null
  const nearestResponse   = mockResponsePoints.find(r => r.isNearest) || null

  const handleAcknowledge = () => {
    if (effectiveId) acknowledgeIncident(effectiveId)
  }
  const handleEscalate = () => {
    // Хүлээн авч, resolved болгоно (нэмэлт хүч явсан = дуусгавар)
    if (effectiveId) resolveIncident(effectiveId)
  }

  // Test alarm / test-ok API дуудалт
  const triggerTestAlarm = () => fetch('/api/test-alarm', { method: 'POST' }).catch(() => {})
  const triggerTestOk    = () => fetch('/api/test-ok',    { method: 'POST' }).catch(() => {})

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <DashboardHeader incidents={incidents} isLive={isLive} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Incident Queue */}
        <aside className="w-80 flex-shrink-0 border-r border-border overflow-hidden">
          <IncidentQueue
            incidents={incidents}
            selectedId={effectiveId}
            onSelect={setSelectedIncidentId}
          />
        </aside>

        {/* Center - Map */}
        <main className="relative flex-1 overflow-hidden">
          <ResponseMap
            incident={selectedIncident}
            responsePoints={mockResponsePoints}
            gateway={gateway}
          />

          {/* Signal Path Indicator */}
          <SignalIndicator isActive={!!selectedIncident} />

          {/* Test товч + 101 */}
          <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
            <button
              onClick={triggerTestAlarm}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--alert-critical)]/20 border border-[var(--alert-critical)]/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--alert-critical)] hover:bg-[var(--alert-critical)]/30 transition-colors"
            >
              <FlameKindling className="h-3 w-3" />
              Туршилтын Дохио
            </button>
            <button
              onClick={triggerTestOk}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--status-online)]/20 border border-[var(--status-online)]/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--status-online)] hover:bg-[var(--status-online)]/30 transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Хэвийн Байдал
            </button>
            <a
              href="tel:101"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--signal-blue)]/20 border border-[var(--signal-blue)]/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--signal-blue)] hover:bg-[var(--signal-blue)]/30 transition-colors"
            >
              <Phone className="h-3 w-3" />
              101 Дуудах
            </a>
          </div>

          {/* Live / Mock indicator */}
          <div className="absolute top-4 right-4 z-[1000]">
            <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
              isLive
                ? 'bg-[var(--status-online)]/20 border border-[var(--status-online)]/40 text-[var(--status-online)]'
                : 'bg-muted/80 border border-border text-muted-foreground'
            }`}>
              <Wifi className="h-3 w-3" />
              {isLive ? 'Шууд LoRa Холболт' : 'Туршилтын Өгөгдөл'}
            </div>
          </div>

          {/* Operational Status Banner */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            {selectedIncident && nearestResponse ? (
              <div className="rounded-lg bg-card/95 px-5 py-2.5 backdrop-blur-sm border border-[var(--alert-critical)]/40 shadow-lg flex items-center gap-3">
                <span className="flex h-2 w-2 rounded-full bg-[var(--alert-critical)] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--alert-critical)]">
                  Гал Түймэр Идэвхтэй
                </span>
                <span className="h-3.5 w-px bg-border" />
                <Navigation className="h-3 w-3 text-[var(--status-online)]" />
                <span className="text-xs font-medium text-foreground">
                  {nearestResponse.name}
                </span>
                <span className="text-xs text-muted-foreground">томилогдсон</span>
                <span className="h-3.5 w-px bg-border" />
                <span className="font-mono text-sm font-bold text-[var(--status-online)]">
                  {nearestResponse.eta} мин
                </span>
              </div>
            ) : (
              <div className="rounded-lg bg-card/95 px-4 py-2 backdrop-blur-sm border border-border shadow-lg">
                <p className="text-xs font-medium text-muted-foreground">
                  Идэвхтэй осол байхгүй — Систем хянаж байна
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Right Panel - Incident Details */}
        <aside className="w-96 flex-shrink-0 border-l border-border overflow-hidden">
          <IncidentDetails
            incident={selectedIncident}
            nearestResponse={nearestResponse}
            gateway={gateway}
            onAcknowledge={handleAcknowledge}
            onEscalate={handleEscalate}
          />
        </aside>
      </div>

      {/* Event Log — доор нуугдах/гарах */}
      <EventLog events={events} />
    </div>
  )
}
