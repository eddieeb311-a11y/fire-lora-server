'use client'

import { formatDistanceToNow, format } from 'date-fns'
import { mn } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Incident } from '@/lib/types'
import {
  Flame,
  AlertTriangle,
  AlertCircle,
  Building2,
  Clock,
  Radio,
  Layers
} from 'lucide-react'

const PRIORITY_CODE: Record<Incident['priority'], string> = {
  critical: 'P1',
  high: 'P2',
  medium: 'P3',
}

const PRIORITY_LABEL: Record<Incident['priority'], string> = {
  critical: 'ЯАРАЛТАЙ',
  high: 'ӨНДӨР',
  medium: 'ДУНД',
}

interface IncidentQueueProps {
  incidents: Incident[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function IncidentQueue({ incidents, selectedId, onSelect }: IncidentQueueProps) {
  const getPriorityIcon = (priority: Incident['priority']) => {
    switch (priority) {
      case 'critical':
        return <Flame className="h-4 w-4" />
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getPriorityStyles = (priority: Incident['priority'], isSelected: boolean) => {
    const base = 'border-l-4'
    switch (priority) {
      case 'critical':
        return cn(base, 'border-l-[var(--alert-critical)]', isSelected && 'bg-[var(--alert-critical)]/10')
      case 'high':
        return cn(base, 'border-l-[var(--warning-amber)]', isSelected && 'bg-[var(--warning-amber)]/10')
      default:
        return cn(base, 'border-l-[var(--signal-blue)]', isSelected && 'bg-[var(--signal-blue)]/10')
    }
  }

  const getStatusBadge = (status: Incident['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--alert-critical)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--alert-critical)] animate-pulse" />
            Идэвхтэй
          </span>
        )
      case 'acknowledged':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--warning-amber)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning-amber)]" />
            Хүлээн авсан
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--status-online)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-online)]" />
            Шийдвэрлэсэн
          </span>
        )
    }
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Гарчиг */}
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--alert-critical)]/20">
              <Radio className="h-4 w-4 text-[var(--alert-critical)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Дуудлагын Дараалал</h2>
              <p className="text-[10px] text-muted-foreground">Улаанбаатар · Бүх Дүүрэг</p>
            </div>
          </div>
          <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--alert-critical)] px-2">
            <span className="text-xs font-bold text-white">
              {incidents.filter(i => i.status === 'active').length}
            </span>
          </div>
        </div>
      </div>

      {/* Ослын жагсаалт */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {incidents.map((incident) => {
            const isSelected = selectedId === incident.id
            return (
              <button
                key={incident.id}
                onClick={() => onSelect(incident.id)}
                className={cn(
                  'w-full rounded-lg bg-card p-3 text-left transition-all hover:bg-accent',
                  getPriorityStyles(incident.priority, isSelected),
                  isSelected && 'ring-1 ring-[var(--alert-critical)]/50'
                )}
              >
                {/* Ач холбогдол & Статус */}
                <div className="mb-2 flex items-center justify-between">
                  <div className={cn(
                    'flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-bold tracking-wide',
                    incident.priority === 'critical' && 'bg-[var(--alert-critical)]/20 text-[var(--alert-critical)]',
                    incident.priority === 'high' && 'bg-[var(--warning-amber)]/20 text-[var(--warning-amber)]',
                    incident.priority === 'medium' && 'bg-[var(--signal-blue)]/20 text-[var(--signal-blue)]'
                  )}>
                    {getPriorityIcon(incident.priority)}
                    {PRIORITY_CODE[incident.priority]} · {PRIORITY_LABEL[incident.priority]}
                  </div>
                  {getStatusBadge(incident.status)}
                </div>

                {/* Барилгын мэдээлэл */}
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    {incident.building}
                  </div>
                  <div className="mt-0.5 pl-5 space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {incident.district}
                    </p>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <Layers className="h-2.5 w-2.5" />
                      {incident.floor}-р давхар · {incident.zone}
                    </p>
                  </div>
                </div>

                {/* Цагийн мэдээлэл */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(incident.timeDetected, { addSuffix: true, locale: mn })}
                  </span>
                  <span className="font-mono">{format(incident.timeDetected, 'HH:mm')}</span>
                </div>

                {/* Дохиоллын эх үүсвэр + ID */}
                <div className="mt-2 border-t border-border pt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground truncate">{incident.alarmSource}</span>
                  <span className="font-mono text-[9px] text-muted-foreground/50 flex-shrink-0">{incident.id}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Доод статистик */}
      <div className="border-t border-sidebar-border p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-[var(--alert-critical)]">
              {incidents.filter(i => i.status === 'active').length}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Идэвхтэй</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--warning-amber)]">
              {incidents.filter(i => i.status === 'acknowledged').length}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Хүлээн авсан</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--status-online)]">
              {incidents.filter(i => i.status === 'resolved').length}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Шийдвэрлэсэн</div>
          </div>
        </div>
      </div>
    </div>
  )
}
