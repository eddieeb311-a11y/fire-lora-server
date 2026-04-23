'use client'

import { formatDistanceToNow, format } from 'date-fns'
import { mn } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Incident, ResponsePoint, Gateway } from '@/lib/types'
import {
  Flame,
  Building2,
  Layers,
  Clock,
  Radio,
  Navigation,
  Battery,
  Signal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Route,
  Zap,
  Truck
} from 'lucide-react'

interface IncidentDetailsProps {
  incident: Incident | null
  nearestResponse: ResponsePoint | null
  gateway: Gateway
  onAcknowledge: () => void
  onEscalate: () => void
}

const PRIORITY_CODE: Record<'critical' | 'high' | 'medium', string> = {
  critical: 'P1',
  high: 'P2',
  medium: 'P3',
}

const PRIORITY_LABEL: Record<'critical' | 'high' | 'medium', string> = {
  critical: 'ЯАРАЛТАЙ',
  high: 'ӨНДӨР',
  medium: 'ДУНД',
}

function getSignalQuality(rssi: number): { label: string; color: string } {
  if (rssi >= -70) return { label: 'Хүчтэй Дохио', color: 'var(--status-online)' }
  if (rssi >= -85) return { label: 'Сайн Дохио', color: 'var(--status-online)' }
  if (rssi >= -100) return { label: 'Дунд Дохио', color: 'var(--warning-amber)' }
  return { label: 'Сул Дохио', color: 'var(--alert-critical)' }
}

export function IncidentDetails({
  incident,
  nearestResponse,
  gateway,
  onAcknowledge,
  onEscalate,
}: IncidentDetailsProps) {
  if (!incident) {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Flame className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Дуудлага сонгогдоогүй байна</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Дэлгэрэнгүй мэдээлэл харахын тулд дуудлагын дарааллаас сонгоно уу
            </p>
          </div>
        </div>
      </div>
    )
  }

  const alarmAge = formatDistanceToNow(incident.timeDetected, { locale: mn })
  const isActive = incident.status === 'active'

  const bridgeLatencyMs = incident.timeBridged.getTime() - incident.timeDetected.getTime()
  const bridgeLatency = bridgeLatencyMs < 1000
    ? `${bridgeLatencyMs}мс`
    : `${(bridgeLatencyMs / 1000).toFixed(1)}с`
  const signalQuality = getSignalQuality(gateway.rssi)

  // Хариу арга хэмжээний цаглабар
  const timelineSteps = [
    {
      label: 'Дохио Ажиллав',
      time: incident.timeDetected,
      completed: true,
      icon: Flame,
      color: 'var(--alert-critical)',
    },
    {
      label: 'LoRa Гүүр Дамжуулав',
      time: incident.timeBridged,
      completed: true,
      icon: Radio,
      color: 'var(--signal-blue)',
    },
    {
      label: 'Дуудлага Хүлээн Авагч Хүлээн авав',
      time: incident.timeReceived,
      completed: true,
      icon: Activity,
      color: 'var(--status-online)',
    },
    {
      label: 'Дуудлага Хүлээн Авагч Зөвшөөрсөн',
      time: incident.timeAcknowledged,
      completed: !!incident.timeAcknowledged,
      icon: CheckCircle2,
      color: incident.timeAcknowledged ? 'var(--status-online)' : 'var(--muted-foreground)',
    },
  ]

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Гарчиг */}
      <div className="border-b border-border p-4">
        <div className={cn(
          'mb-3 rounded-lg p-3',
          isActive ? 'bg-[var(--alert-critical)]/10 glow-critical' : 'bg-[var(--warning-amber)]/10'
        )}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className={cn(
                'h-5 w-5 flex-shrink-0',
                isActive ? 'text-[var(--alert-critical)] animate-pulse' : 'text-[var(--warning-amber)]'
              )} />
              <span className={cn(
                'text-base font-bold uppercase tracking-wide leading-tight',
                isActive ? 'text-[var(--alert-critical)] text-glow-critical' : 'text-[var(--warning-amber)]'
              )}>
                Гал түймрийн Дохиолол · {isActive ? 'Идэвхтэй' : 'Хүлээн авсан'}
              </span>
            </div>
            <span className={cn(
              'flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold',
              isActive ? 'bg-[var(--alert-critical)]/20 text-[var(--alert-critical)]' : 'bg-[var(--warning-amber)]/20 text-[var(--warning-amber)]'
            )}>
              {PRIORITY_CODE[incident.priority]} · {PRIORITY_LABEL[incident.priority]}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
            {incident.id}
          </div>
        </div>

        {/* Байршлын мэдээлэл */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <div>
              <div className="font-semibold text-foreground">{incident.building}</div>
              <div className="text-sm text-muted-foreground">{incident.district}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{incident.floor}-р давхар</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{incident.zone}</span>
            </div>
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className={cn(isActive ? 'text-[var(--alert-critical)]' : 'text-[var(--warning-amber)]')}>
                {alarmAge}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Гүйлгэх контент */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Дуудлага — хамгийн чухал */}
        {nearestResponse && (
          <div className="rounded-lg border border-[var(--status-online)]/35 bg-[var(--status-online)]/8 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--status-online)]">
                Гал Унтраах Аврах Ангийн Илгэлт
              </div>
              <div className="flex items-center gap-1.5 rounded bg-[var(--status-online)]/15 px-2 py-0.5">
                <Truck className="h-2.5 w-2.5 text-[var(--status-online)]" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--status-online)]">
                  Аврах Анги Замдаа
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--status-online)]/20">
                <Navigation className="h-5 w-5 text-[var(--status-online)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-semibold text-foreground">{nearestResponse.name}</div>
                <div className="text-xs text-muted-foreground">Аюулт үзэгдлээс {nearestResponse.distance} км</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-mono text-2xl font-bold leading-none text-[var(--status-online)]">
                  {nearestResponse.eta}
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--status-online)]/70">
                  мин ирэх
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Дохиоллын Эх Үүсвэр */}
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Галын Дохиоллын Эх Үүсвэр
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--alert-critical)]/20">
                <AlertTriangle className="h-3.5 w-3.5 text-[var(--alert-critical)]" />
              </div>
              <span className="text-sm font-medium text-foreground">{incident.alarmSource}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Дамжуулалт +{bridgeLatency}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <div className="rounded bg-card px-2 py-1.5">
              <div className="text-muted-foreground mb-0.5">FACP Илрүүлсэн</div>
              <div className="font-mono font-medium text-foreground">{format(incident.timeDetected, 'HH:mm:ss')}</div>
            </div>
            <div className="rounded bg-card px-2 py-1.5">
              <div className="text-muted-foreground mb-0.5">LoRa Дамжуулсан</div>
              <div className="font-mono font-medium text-foreground">{format(incident.timeBridged, 'HH:mm:ss')}</div>
            </div>
            <div className="rounded bg-card px-2 py-1.5">
              <div className="text-muted-foreground mb-0.5">Консол Хүлээн авсан</div>
              <div className="font-mono font-medium text-foreground">{format(incident.timeReceived, 'HH:mm:ss')}</div>
            </div>
          </div>
        </div>

        {/* Хариу Арга Хэмжээний Цаг */}
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Хариу Арга Хэмжээний Цаглабар
          </div>
          <div className="relative">
            <div className="absolute left-3 top-3 h-[calc(100%-24px)] w-0.5 bg-border" />
            <div className="space-y-3">
              {timelineSteps.map((step, index) => (
                <div key={index} className="relative flex items-center gap-3">
                  <div
                    className={cn(
                      'relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                      step.completed ? 'bg-card' : 'bg-muted'
                    )}
                    style={{
                      borderColor: step.color,
                      borderWidth: step.completed ? '2px' : '1px',
                    }}
                  >
                    <step.icon
                      className="h-3 w-3"
                      style={{ color: step.completed ? step.color : 'var(--muted-foreground)' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      step.completed ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {step.label}
                    </div>
                    {step.time && (
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {format(step.time, 'HH:mm:ss.SSS')}
                      </div>
                    )}
                    {!step.time && !step.completed && (
                      <div className="text-[10px] text-muted-foreground/60">Дуудлага хүлээн авагчийн хариу хүлээж байна</div>
                    )}
                  </div>
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: step.color }} />
                  ) : (
                    <div className="h-4 w-4 flex-shrink-0 rounded-full border border-dashed border-muted-foreground/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LoRa Гарц */}
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            LoRa Дамжуулагч Гарц
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[var(--signal-blue)]/20">
              <Radio className="h-3.5 w-3.5 text-[var(--signal-blue)]" />
            </div>
            <span className="text-sm font-medium text-foreground truncate">{gateway.name}</span>
            <span className="ml-auto flex-shrink-0 flex items-center gap-1 text-xs">
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                gateway.status === 'online' ? 'bg-[var(--status-online)]' : 'bg-[var(--warning-amber)]'
              )} />
              <span className={cn(
                'font-medium uppercase tracking-wide',
                gateway.status === 'online' ? 'text-[var(--status-online)]' : 'text-[var(--warning-amber)]'
              )}>
                {gateway.status === 'online' ? 'Идэвхтэй' : 'Офлайн'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="font-mono">{gateway.id}</span>
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1">
              <Battery className="h-3 w-3" />
              {gateway.battery}%
            </span>
            <span className="flex items-center gap-1">
              <Signal className="h-3 w-3" />
              {gateway.rssi} dBm
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              SNR {gateway.snr} dB
            </span>
            <span
              className="flex items-center gap-1 font-semibold"
              style={{ color: signalQuality.color }}
            >
              · {signalQuality.label}
            </span>
          </div>
          <div className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Сүүлийн холболт {formatDistanceToNow(gateway.lastHeartbeat, { addSuffix: true, locale: mn })}
          </div>
        </div>
      </div>

      {/* Үйлдлийн товчууд */}
      <div className="border-t border-border p-4 space-y-2">
        <Button
          className={cn(
            'w-full font-bold uppercase tracking-wide',
            isActive
              ? 'bg-[var(--status-online)] hover:bg-[var(--status-online)]/90 text-white shadow-[0_0_12px_var(--status-online-glow)]'
              : 'bg-secondary text-muted-foreground'
          )}
          disabled={!isActive}
          onClick={onAcknowledge}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Дуудлага Хүлээн Авах
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="border-[var(--warning-amber)]/50 font-semibold text-[var(--warning-amber)] hover:bg-[var(--warning-amber)]/10"
            onClick={onEscalate}
          >
            <ArrowUpRight className="mr-1.5 h-4 w-4" />
            Нэмэлт Хүч Дуудах
          </Button>
          <Button
            variant="outline"
            className="border-[var(--signal-blue)]/50 font-semibold text-[var(--signal-blue)] hover:bg-[var(--signal-blue)]/10"
          >
            <Route className="mr-1.5 h-4 w-4" />
            Маршрут Харах
          </Button>
        </div>
      </div>
    </div>
  )
}
