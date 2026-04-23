'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Flame,
  Radio,
  Wifi,
  Bell,
  Settings,
  User,
  ShieldAlert
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mockIncidents } from '@/lib/mock-data'

export function DashboardHeader() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const activeCount = mockIncidents.filter(i => i.status === 'active').length
  const totalCount = mockIncidents.length

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Logo & Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--alert-critical)]/20 glow-critical">
          <Flame className="h-5 w-5 text-[var(--alert-critical)]" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            FireBridge
          </h1>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            УБ Галын Хариу Арга Хэмжээний Сүлжээ
          </p>
        </div>
      </div>

      {/* Center Status */}
      <div className="flex items-center gap-4">
        {/* Active incident alert — most prominent */}
        <div className="flex items-center gap-2 rounded-md bg-[var(--alert-critical)]/15 border border-[var(--alert-critical)]/35 px-3 py-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--alert-critical)]" />
          <span className="flex h-2 w-2 rounded-full bg-[var(--alert-critical)] animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--alert-critical)]">
            {activeCount} Гал Түймэр Идэвхтэй · Нийт {totalCount}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-[var(--signal-blue)]" />
          <span className="text-xs font-medium text-muted-foreground">3 Дамжуулагч Идэвхтэй</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-[var(--status-online)]" />
          <span className="text-xs font-medium text-muted-foreground">LoRaWAN Холбоо</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Time Display */}
        <div className="rounded-lg bg-secondary px-3 py-1.5">
          <div className="font-mono text-sm font-semibold text-foreground">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {format(currentTime, 'yyyy.MM.dd')} · УЦ UTC+8
          </div>
        </div>

        <div className="h-8 w-px bg-border" />

        {/* Notification Bell */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--alert-critical)] text-[10px] font-bold text-white">
            3
          </span>
        </Button>

        {/* Settings */}
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>

        {/* User */}
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  )
}
