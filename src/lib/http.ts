export function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError"
  }
  return error instanceof Error && (error.name === "AbortError" || error.message === "Scan cancelled")
}

export function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  const error = new Error("Scan cancelled")
  error.name = "AbortError"
  throw error
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      const error = new Error("Scan cancelled")
      error.name = "AbortError"
      reject(error)
    }
    if (!signal) return
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

export function rewriteToProxy(next: string, proxyBase: string, publicHosts: string[]): string {
  if (!next) return next
  if (!next.startsWith("http")) {
    const base = proxyBase.replace(/\/$/, "")
    return next.startsWith("/") ? `${base}${next}` : `${base}/${next}`
  }
  try {
    const url = new URL(next)
    if (publicHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return `${proxyBase.replace(/\/$/, "")}${url.pathname}${url.search}`
    }
  } catch {
    return next
  }
  return next
}

export function summarizeHttpBody(body: string, max = 180): string {
  const trimmed = body.trim()
  if (!trimmed) return ""
  if (/^\s*</.test(trimmed)) {
    if (/cloudflare|attention required|captcha|cf-error|just a moment/i.test(trimmed)) {
      return "blocked by Cloudflare"
    }
    return "HTML error page"
  }
  return trimmed.slice(0, max)
}

function expertStatus(message: string): number {
  const match = message.match(/StellarExpert (\d{3})/)
  return match ? Number(match[1]) : 0
}

export function isRetryableExpertError(error: unknown): boolean {
  const status = expertStatus(errorMessage(error))
  if (!status) return true
  return status === 402 || status === 429 || status >= 500
}

export function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error
  if (error instanceof Error) {
    if (error.message && error.message !== "[object Object]") return error.message
    if (error.cause) return errorMessage(error.cause)
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    if (typeof record.message === "string" && record.message !== "[object Object]") {
      return record.message
    }
    if (typeof record.detail === "string") return record.detail
    try {
      const text = JSON.stringify(error)
      if (text && text !== "{}" && text !== "null") return text.slice(0, 240)
    } catch {
      // ignore
    }
  }
  return "Unknown error"
}
