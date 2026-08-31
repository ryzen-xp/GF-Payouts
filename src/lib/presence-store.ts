export type PresenceStats = {
  online: number
  visits: number
}

export type PresenceTick = {
  sessionId: string
  visitorId: string
  left?: boolean
}

export const PRESENCE_TTL_MS = 45_000

const ID = /^[A-Za-z0-9_-]{8,80}$/

type MemoryState = {
  sessions: Map<string, number>
  visitors: Set<string>
  visits: number
}

const globalStore = globalThis as typeof globalThis & { __gfPresence?: MemoryState }

function memory(): MemoryState {
  if (!globalStore.__gfPresence) {
    globalStore.__gfPresence = { sessions: new Map(), visitors: new Set(), visits: 0 }
  }
  return globalStore.__gfPresence
}

export function resetMemoryPresence() {
  globalStore.__gfPresence = { sessions: new Map(), visitors: new Set(), visits: 0 }
}

export function parsePresenceTick(body: unknown): PresenceTick | null {
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  if (!ID.test(String(record.sessionId ?? "")) || !ID.test(String(record.visitorId ?? ""))) {
    return null
  }
  return {
    sessionId: String(record.sessionId),
    visitorId: String(record.visitorId),
    left: record.left === true,
  }
}

function prune(state: MemoryState, now: number) {
  for (const [id, seen] of state.sessions) {
    if (now - seen > PRESENCE_TTL_MS) state.sessions.delete(id)
  }
}

export function tickMemory(input: PresenceTick, now = Date.now()): PresenceStats {
  const state = memory()
  prune(state, now)
  if (input.left) {
    state.sessions.delete(input.sessionId)
  } else {
    state.sessions.set(input.sessionId, now)
    if (!state.visitors.has(input.visitorId)) {
      state.visitors.add(input.visitorId)
      state.visits += 1
    }
  }
  return { online: state.sessions.size, visits: state.visits }
}

export function snapshotMemory(now = Date.now()): PresenceStats {
  const state = memory()
  prune(state, now)
  return { online: state.sessions.size, visits: state.visits }
}

function env(name: string): string | undefined {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    return proc?.env?.[name]
  } catch {
    return undefined
  }
}

function redisEnv(): { url: string; token: string } | null {
  if (env("VITEST")) return null
  const url = env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL")
  const token = env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN")
  if (!url || !token) return null
  return { url, token }
}

async function redis(commands: unknown[][]): Promise<unknown[] | null> {
  const env = redisEnv()
  if (!env) return null
  try {
    const response = await fetch(env.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    })
    if (!response.ok) return null
    const data: unknown = await response.json()
    if (!Array.isArray(data)) return null
    return data.map((row) => {
      if (row && typeof row === "object" && "result" in row) {
        return (row as { result: unknown }).result
      }
      return row
    })
  } catch {
    return null
  }
}

function asCount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export async function snapshotPresence(): Promise<PresenceStats> {
  const now = Date.now()
  const rows = await redis([
    ["ZREMRANGEBYSCORE", "gf:online", 0, now - PRESENCE_TTL_MS],
    ["ZCARD", "gf:online"],
    ["GET", "gf:visits"],
  ])
  if (!rows) return snapshotMemory(now)
  return { online: asCount(rows[1]), visits: asCount(rows[2]) }
}

export async function tickPresence(input: PresenceTick): Promise<PresenceStats> {
  const now = Date.now()
  const commands: unknown[][] = input.left
    ? [["ZREM", "gf:online", input.sessionId]]
    : [["ZADD", "gf:online", now, input.sessionId]]
  commands.push(["ZREMRANGEBYSCORE", "gf:online", 0, now - PRESENCE_TTL_MS], ["ZCARD", "gf:online"])
  if (!input.left) {
    commands.push(["SET", `gf:v:${input.visitorId}`, "1", "NX", "EX", "31536000"])
  }
  commands.push(["GET", "gf:visits"])
  const rows = await redis(commands)
  if (!rows) return tickMemory(input, now)

  let visits = asCount(rows[rows.length - 1])
  const created = !input.left && rows[3] === "OK"
  if (created) {
    const inc = await redis([["INCR", "gf:visits"]])
    if (inc) visits = asCount(inc[0])
    else visits += 1
  }
  return { online: asCount(rows[2]), visits }
}

export async function handlePresence(
  method: string,
  body: unknown,
): Promise<{ status: number; json: PresenceStats | { error: string } }> {
  const verb = method.toUpperCase()
  if (verb === "OPTIONS") return { status: 204, json: { error: "" } }
  if (verb === "GET") return { status: 200, json: await snapshotPresence() }
  if (verb !== "POST") return { status: 405, json: { error: "Method not allowed" } }
  const tick = parsePresenceTick(body)
  if (!tick) return { status: 400, json: { error: "Bad request" } }
  return { status: 200, json: await tickPresence(tick) }
}
