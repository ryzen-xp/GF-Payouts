export const config = { runtime: "edge" }

const UPSTREAM = "https://api.stellar.expert"

function cors(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() })
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", ...cors() },
    })
  }

  try {
    const incoming = new URL(request.url)
    const marker = "/api/expert"
    const at = incoming.pathname.indexOf(marker)
    const suffix =
      at >= 0 ? incoming.pathname.slice(at + marker.length) : incoming.pathname.replace(/^\/expert/, "")
    const dest = `${UPSTREAM}${suffix || "/"}${incoming.search}`
    const upstream = await fetch(dest, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://stellar.expert/",
        Origin: "https://stellar.expert",
      },
    })
    const body = await upstream.arrayBuffer()
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "public, s-maxage=45, stale-while-revalidate=120",
        ...cors(),
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: "Explorer proxy failed" }), {
      status: 502,
      headers: { "content-type": "application/json", ...cors() },
    })
  }
}
