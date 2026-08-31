export const config = { runtime: "edge" }

const ID = /^[A-Za-z0-9_-]{8,80}$/
const TTL_MS = 45_000

type Stats = { online: number; visits: number }
type Memory = { sessions: Map<string, number>; visitors: Set<string>; visits: number }

const g = globalThis as typeof globalThis & { __gfPresence?: Memory }

function store(): Memory {
  if (!g.__gfPresence) {
    g.__gfPresence = { sessions: new Map(), visitors: new Set(), visits: 0 }
  }
  return g.__gfPresence
}

function prune(now: number) {
  const state = store()
  for (const [id, seen] of state.sessions) {
    if (now - seen > TTL_MS) state.sessions.delete(id)
  }
}

function snapshot(now = Date.now()): Stats {
  prune(now)
  const state = store()
  return { online: state.sessions.size, visits: state.visits }
}

function tick(
  sessionId: string,
  visitorId: string,
  left: boolean,
  now = Date.now(),
): Stats {
  prune(now)
  const state = store()
  if (left) {
    state.sessions.delete(sessionId)
  } else {
    state.sessions.set(sessionId, now)
    if (!state.visitors.has(visitorId)) {
      state.visitors.add(visitorId)
      state.visits += 1
    }
  }
  return { online: state.sessions.size, visits: state.visits }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  })
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      })
    }
    if (request.method === "GET") return json(snapshot())
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405)

    const body: unknown = await request.json().catch(() => null)
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null
    const sessionId = String(record?.sessionId ?? "")
    const visitorId = String(record?.visitorId ?? "")
    if (!ID.test(sessionId) || !ID.test(visitorId)) return json({ error: "Bad request" }, 400)
    return json(tick(sessionId, visitorId, record?.left === true))
  } catch {
    return json({ error: "Presence failed" }, 500)
  }
}
