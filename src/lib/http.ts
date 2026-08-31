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
