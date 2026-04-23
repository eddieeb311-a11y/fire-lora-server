'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Navigation } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { IncidentQueue } from '@/components/dashboard/incident-queue'
import { IncidentDetails } from '@/components/dashboard/incident-details'
import { SignalIndicator } from '@/components/dashboard/signal-indicator'
import { mockIncidents, mockResponsePoints, mockGateway } from '@/lib/mock-data'

// Dynamic import for map to avoid SSR issues with Leaflet
const ResponseMap = dynamic(
  () => import('@/components/dashboard/response-map').then(mod => mod.ResponseMap),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[oklch(0.1_0.005_260)]">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--signal-blue)] border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    )
  }
)

export default function EmergencyDashboard() {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    mockIncidents[0]?.id || null
  )

  const selectedIncident = mockIncidents.find(i => i.id === selectedIncidentId) || null
  const nearestResponse = mockResponsePoints.find(r => r.isNearest) || null

  const handleAcknowledge = () => {
    // In a real app, this would update the incident status
    console.log('[v0] Acknowledging incident:', selectedIncidentId)
  }

  const handleEscalate = () => {
    // In a real app, this would escalate the incident
    console.log('[v0] Escalating incident:', selectedIncidentId)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <DashboardHeader />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Incident Queue */}
        <aside className="w-80 flex-shrink-0 border-r border-border overflow-hidden">
          <IncidentQueue
            incidents={mockIncidents}
            selectedId={selectedIncidentId}
            onSelect={setSelectedIncidentId}
          />
        </aside>

        {/* Center - Map */}
        <main className="relative flex-1 overflow-hidden">
          <ResponseMap
            incident={selectedIncident}
            responsePoints={mockResponsePoints}
            gateway={mockGateway}
          />
          
          {/* Signal Path Indicator */}
          <SignalIndicator isActive={!!selectedIncident} />

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
            gateway={mockGateway}
            onAcknowledge={handleAcknowledge}
            onEscalate={handleEscalate}
          />
        </aside>
      </div>
    </div>
  )
}
