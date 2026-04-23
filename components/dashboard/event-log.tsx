'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Flame, Radio, Heart, ChevronUp, ChevronDown, Filter } from 'lucide-react'

export interface LiveEvent {
  deviceId:      string
  eventType:     string
  source:        string
  locationLabel: string
  battery:       number
  rssi:          number
  sequence:      number
  alarm:         boolean
  time:          string
  timestamp:     string
}

interface EventLogProps {
  events: LiveEvent[]
}

const EVENT_ICON = {
  alarm:     { icon: Flame,  color: 'text-[var(--alert-critical)]',  bg: 'bg-[var(--alert-critical)]/10',  label: 'ДОХИОЛОЛ' },
  test:      { icon: Radio,  color: 'text-[var(--signal-blue)]',     bg: 'bg-[var(--signal-blue)]/10',     label: 'ТУРШИЛТ'  },
  heartbeat: { icon: Heart,  color: 'text-[var(--status-online)]',   bg: 'bg-[var(--status-online)]/10',   label: 'ХЭВИЙН'   },
}

type Filter = 'all' | 'alarm' | 'test'

export function EventLog({ events }: EventLogProps) {
  const [open, setOpen]     = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = events.filter(e =>
    filter === 'all' ? true : e.eventType === filter
  )

  const alarmCount = events.filter(e => e.eventType === 'alarm').length

  return (
    <div className={cn(
      'flex-shrink-0 border-t border-border bg-card transition-all duration-200',
      open ? 'h-48' : 'h-9'
    )}>
      {/* Толгой — нээх/хаах */}
      <div
        className="flex h-9 cursor-pointer items-center gap-3 px-4 select-none"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          ҮЙЛ ЯВДЛЫН ТҮҮХ
        </span>
        <span className="flex h-4 w-5 items-center justify-center rounded-full bg-secondary font-mono text-[9px] font-bold text-muted-foreground">
          {events.length}
        </span>
        {alarmCount > 0 && (
          <span className="flex h-4 items-center gap-1 rounded-full bg-[var(--alert-critical)]/20 px-2 text-[9px] font-bold text-[var(--alert-critical)]">
            <Flame className="h-2.5 w-2.5" /> {alarmCount}
          </span>
        )}

        {/* Шүүлтүүр */}
        {open && (
          <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {(['all', 'alarm', 'test'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors',
                  filter === f
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50'
                )}
              >
                {f === 'all' ? 'Бүгд' : f === 'alarm' ? 'Дохиолол' : 'Туршилт'}
              </button>
            ))}
          </div>
        )}

        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </span>
      </div>

      {/* Жагсаалт */}
      {open && (
        <div className="h-[calc(100%-36px)] overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Үйл явдал байхгүй
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((ev, i) => {
                const meta = EVENT_ICON[ev.eventType as keyof typeof EVENT_ICON] ?? EVENT_ICON.heartbeat
                const Icon = meta.icon
                return (
                  <div key={i} className={cn(
                    'flex items-center gap-2 rounded px-2 py-1.5',
                    meta.bg
                  )}>
                    <Icon className={cn('h-3 w-3 flex-shrink-0', meta.color)} />
                    <span className={cn('text-[9px] font-bold uppercase tracking-wide w-16 flex-shrink-0', meta.color)}>
                      {meta.label}
                    </span>
                    <span className="truncate text-[10px] text-foreground">{ev.locationLabel || ev.deviceId}</span>
                    <span className="ml-auto flex-shrink-0 font-mono text-[9px] text-muted-foreground">{ev.time?.slice(11, 19) ?? '--'}</span>
                    <span className="flex-shrink-0 text-[9px] text-muted-foreground">{ev.rssi} dBm</span>
                    <span className="flex-shrink-0 text-[9px] text-muted-foreground">{ev.battery}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
