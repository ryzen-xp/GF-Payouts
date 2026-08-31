export const config = { runtime: "edge" }

const UPSTREAM = "https://api.stellar.expert"

function cors(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  }
}

function destFrom(request: Request): string {
  const url = new URL(request.url)
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
    const dest = destFrom(request)
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
