export const config = { runtime: "nodejs", maxDuration: 10 }

import { handlePresence } from "../src/lib/presence-store.ts"

type NodeReq = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  on: (event: "data" | "end" | "error", fn: (chunk?: Buffer) => void) => void
}

type NodeRes = {
  statusCode: number
  setHeader: (name: string, value: string) => void
  end: (body?: string | Buffer) => void
}

function readBody(req: NodeReq): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => {
      if (chunk) chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", () => reject(new Error("body")))
  })
}

export default async function handler(req: NodeReq, res: NodeRes) {
  res.setHeader("access-control-allow-origin", "*")
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS")
  res.setHeader("access-control-allow-headers", "content-type")
  res.setHeader("cache-control", "no-store")

  if (req.method === "OPTIONS") {
    res.statusCode = 204
    res.end()
    return
  }

  let body: unknown = null
  if ("body" in req && req.body && typeof req.body === "object") {
    body = req.body
  } else if (req.method === "POST") {
    try {
      const raw = await readBody(req)
      body = raw ? JSON.parse(raw) : {}
    } catch {
      res.statusCode = 400
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ error: "Bad request" }))
      return
    }
  }

  const result = await handlePresence(req.method ?? "GET", body)
  res.statusCode = result.status
  if (result.status === 204) {
    res.end()
    return
  }
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify(result.json))
}
