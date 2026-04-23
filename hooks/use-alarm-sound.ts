'use client'

import { useEffect, useRef } from 'react'

/**
 * Alarm ирэхэд siren дуу тоглуулна (Web Audio API).
 * isActive=true → тоглуулна, false → зогсооно.
 */
export function useAlarmSound(isActive: boolean) {
  const audioCtxRef   = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainRef       = useRef<GainNode | null>(null)
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isActive) {
      startSound()
    } else {
      stopSound()
    }
    return () => stopSound()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive])

  function startSound() {
    if (oscillatorRef.current) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx  = audioCtxRef.current
      const gain = ctx.createGain()
      gain.gain.value = 0.25
      gain.connect(ctx.destination)

      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 880
      osc.connect(gain)
      osc.start()

      oscillatorRef.current = osc
      gainRef.current       = gain

      // Siren: 880Hz ↔ 660Hz
      const siren = () => {
        if (!oscillatorRef.current) return
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.5)
        timerRef.current = setTimeout(siren, 1000)
      }
      siren()
    } catch { /* autoplay policy — ignore */ }
  }

  function stopSound() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop() } catch { /* ignore */ }
      oscillatorRef.current.disconnect()
      oscillatorRef.current = null
    }
    if (gainRef.current) {
      gainRef.current.disconnect()
      gainRef.current = null
    }
  }
}
