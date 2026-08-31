import { useEffect, useState } from "react"

export type PresenceStats = {
  online: number
  visits: number
}

const SESSION_KEY = "gf-session"
const VISITOR_KEY = "gf-visitor"
const BEAT_MS = 12_000

export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0"
  if (n < 1000) return String(Math.floor(n))
  if (n < 1_000_000) {
    const k = n / 1000
    const digits = k >= 10 ? k.toFixed(0) : k.toFixed(1)
    return `${digits.replace(/\.0$/, "")}k`
  }
  const m = n / 1_000_000
  const digits = m >= 10 ? m.toFixed(0) : m.toFixed(1)
  return `${digits.replace(/\.0$/, "")}M`
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `id_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

function readId(storage: Storage | undefined, key: string): string {
  try {
    const existing = storage?.getItem(key)
    if (existing && existing.length >= 8) return existing
    const next = randomId()
    storage?.setItem(key, next)
    return next
  } catch {
    return randomId()
  }
}

async function postPresence(payload: Record<string, unknown>, keepalive = false): Promise<PresenceStats | null> {
  try {
    const response = await fetch("/api/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive,
    })
    if (!response.ok) return null
    const data = (await response.json()) as PresenceStats
    if (typeof data.online !== "number" || typeof data.visits !== "number") return null
    return data
  } catch {
    return null
  }
}

export function usePresence(): PresenceStats | null {
  const [stats, setStats] = useState<PresenceStats | null>(null)

  useEffect(() => {
    const sessionId = readId(window.sessionStorage, SESSION_KEY)
    const visitorId = readId(window.localStorage, VISITOR_KEY)
    let active = true

    async function beat(left = false) {
      const next = await postPresence({ sessionId, visitorId, left }, left)
      if (!left && active && next) setStats(next)
    }

    void beat()
    const timer = window.setInterval(() => void beat(), BEAT_MS)

    function onVisibility() {
      if (document.visibilityState === "hidden") void beat(true)
      else void beat()
    }

    function onLeave() {
      void beat(true)
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onLeave)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onLeave)
      void beat(true)
    }
  }, [])

  return stats
}
