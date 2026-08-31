import { isAbortError, rewriteToProxy, sleep, throwIfAborted } from "./http.ts"
import type { NetworkConfig } from "./types.ts"

export type ExpertTx = {
  hash: string
  ts?: number
  paging_token?: string
  body?: string
  meta?: string
}

type ExpertPage = {
  _embedded?: { records?: ExpertTx[] }
  _links?: { next?: { href?: string } }
}

async function getJson(url: string, signal?: AbortSignal): Promise<ExpertPage> {
  let lastError = "unknown"
  for (let attempt = 0; attempt < 5; attempt += 1) {
    throwIfAborted(signal)
    try {
      const response = await fetch(url, {
        signal,
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://stellar.expert/",
          Origin: "https://stellar.expert",
        },
      })
      if (response.status === 402 || response.status === 429) {
        lastError = `StellarExpert ${response.status}`
        await sleep(3000 * 2 ** attempt, signal)
        continue
      }
      if (!response.ok) {
        const body = await response.text()
        const err = new Error(`StellarExpert ${response.status}: ${body.slice(0, 180)}`)
        if (response.status < 500) throw err
        lastError = err.message
        await sleep(800 * 2 ** attempt, signal)
        continue
      }
      return (await response.json()) as ExpertPage
    } catch (error) {
      if (isAbortError(error)) throw error
      lastError = error instanceof Error ? error.message : String(error)
      await sleep(800 * 2 ** attempt, signal)
    }
  }
  throw new Error(lastError)
}

export async function fetchFactoryTxs(
  network: NetworkConfig,
  onPage?: (count: number) => void,
  signal?: AbortSignal,
): Promise<ExpertTx[]> {
  const txs: ExpertTx[] = []
  let url =
    `${network.expertApi.replace(/\/$/, "")}/explorer/${network.name === "testnet" ? "testnet" : "public"}/tx` +
    `?account=${network.factoryId}&limit=40&order=desc`

  for (let page = 0; page < 50 && url; page += 1) {
    throwIfAborted(signal)
    const data = await getJson(url, signal)
    const records = data._embedded?.records ?? []
    if (records.length === 0) break
    txs.push(
      ...records.map((record) => ({
        hash: record.hash,
        ts: record.ts,
        paging_token: record.paging_token,
        body: record.body,
        meta: record.meta,
      })),
    )
    onPage?.(txs.length)
    const next = data._links?.next?.href
    if (!next || records.length < 40) break
    url = rewriteToProxy(next, network.expertApi, ["stellar.expert", "api.stellar.expert"])
    await sleep(150, signal)
  }
  return txs
}
