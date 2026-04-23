'use client'

import { cn } from '@/lib/utils'
import { Building2, Radio, Monitor, ArrowRight } from 'lucide-react'

interface SignalIndicatorProps {
  isActive: boolean
}

export function SignalIndicator({ isActive }: SignalIndicatorProps) {
  return (
    <div className="absolute bottom-4 right-4 z-[1000]">
      <div className="rounded-lg bg-card/95 p-3 backdrop-blur-sm border border-border">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
          LoRa Гүүр
        </div>
        <div className="flex items-center gap-2">
          {/* Building */}
          <div className={cn(
            'flex flex-col items-center gap-1',
            isActive && 'animate-pulse'
          )}>
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isActive ? 'bg-[var(--alert-critical)]/20' : 'bg-muted'
            )}>
              <Building2 className={cn(
                'h-4 w-4',
                isActive ? 'text-[var(--alert-critical)]' : 'text-muted-foreground'
              )} />
            </div>
            <span className="text-[9px] text-muted-foreground">Галын Дохиоллын Самбар</span>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center">
            <ArrowRight className={cn(
              'h-4 w-4',
              isActive ? 'text-[var(--signal-blue)]' : 'text-muted-foreground'
            )} />
            <span className="text-[8px] font-bold text-[var(--signal-blue)]">LoRa</span>
          </div>

          {/* Gateway */}
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isActive ? 'bg-[var(--signal-blue)]/20 glow-blue' : 'bg-muted'
            )}>
              <Radio className={cn(
                'h-4 w-4',
                isActive ? 'text-[var(--signal-blue)]' : 'text-muted-foreground'
              )} />
            </div>
            <span className="text-[9px] text-muted-foreground">LoRa GW</span>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center">
            <ArrowRight className={cn(
              'h-4 w-4',
              isActive ? 'text-[var(--status-online)]' : 'text-muted-foreground'
            )} />
            <span className="text-[8px] font-bold text-[var(--status-online)]">IP</span>
          </div>

          {/* Console */}
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isActive ? 'bg-[var(--status-online)]/20 glow-green' : 'bg-muted'
            )}>
              <Monitor className={cn(
                'h-4 w-4',
                isActive ? 'text-[var(--status-online)]' : 'text-muted-foreground'
              )} />
            </div>
            <span className="text-[9px] text-muted-foreground">Дуудлага Хүлээн Авагч</span>
          </div>
        </div>

        {isActive && (
          <div className="mt-2 rounded bg-[var(--status-online)]/10 px-2 py-1 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-online)]">
              Гүүр Идэвхтэй · Дамжуулалт Тогтоогдсон
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
