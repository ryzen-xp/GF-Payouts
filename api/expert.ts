export const config = { runtime: "nodejs", maxDuration: 20 }

const UPSTREAM = "https://api.stellar.expert"

const UPSTREAM_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://stellar.expert/",
  Origin: "https://stellar.expert",
  "Accept-Language": "en-US,en;q=0.9",
}

type NodeReq = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
}

type NodeRes = {
  statusCode: number
  setHeader: (name: string, value: string) => void
  end: (body?: string | Buffer) => void
}

function cors(res: NodeRes) {
  res.setHeader("access-control-allow-origin", "*")
  res.setHeader("access-control-allow-methods", "GET, OPTIONS")
}

function destFrom(req: NodeReq): string {
  const host = String(req.headers.host ?? "localhost")
  const url = new URL(req.url ?? "/", `https://${host}`)
  const pathParam = url.searchParams.get("path")
  url.searchParams.delete("path")
  let suffix = pathParam ?? ""
  if (!suffix) {
    const marker = "/api/expert"
    const at = url.pathname.indexOf(marker)
    suffix =
      at >= 0 ? url.pathname.slice(at + marker.length) : url.pathname.replace(/^\/expert/, "")
  }
  if (suffix && !suffix.startsWith("/")) suffix = `/${suffix}`
  const query = url.searchParams.toString()
  return `${UPSTREAM}${suffix || "/"}${query ? `?${query}` : ""}`
}

export default async function handler(req: NodeReq, res: NodeRes) {
  cors(res)
  if (req.method === "OPTIONS") {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== "GET") {
    res.statusCode = 405
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  try {
    const upstream = await fetch(destFrom(req), { headers: UPSTREAM_HEADERS })
    const body = Buffer.from(await upstream.arrayBuffer())
    res.statusCode = upstream.status
    res.setHeader(
      "content-type",
      upstream.headers.get("content-type") ?? "application/json",
    )
    res.setHeader("cache-control", "public, s-maxage=45, stale-while-revalidate=120")
    res.end(body)
  } catch {
    res.statusCode = 502
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ error: "Explorer proxy failed" }))
  }
}
