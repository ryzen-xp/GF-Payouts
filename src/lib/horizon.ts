import { rewriteToProxy, throwIfAborted } from "./http.ts"
import { MAX_OPERATION_PAGES, OPERATIONS_PAGE_SIZE } from "./network.ts"

export type HorizonOperation = {
  id: string
  paging_token: string
  type: string
  transaction_hash: string
  created_at: string
  source_account: string
  function?: string
  parameters?: Array<{ type: string; value: string }>
  address?: string
  from?: string
  to?: string
  asset_type?: string
  asset_code?: string
}

type HorizonPage = {
  _embedded?: { records?: HorizonOperation[] }
  _links?: { next?: { href?: string } }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal)
  const response = await fetch(url, { signal })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Horizon ${response.status}: ${body.slice(0, 200)}`)
  }
  return (await response.json()) as T
}

function nextHorizonUrl(next: string | undefined, horizonUrl: string): string | undefined {
  if (!next) return undefined
  return rewriteToProxy(next, horizonUrl, ["horizon.stellar.org", "horizon-testnet.stellar.org"])
}

export async function fetchAccountOperations(
  horizonUrl: string,
  account: string,
  onPage?: (count: number) => void,
  signal?: AbortSignal,
): Promise<HorizonOperation[]> {
  const ops: HorizonOperation[] = []
  let url: string | undefined =
    `${horizonUrl.replace(/\/$/, "")}/accounts/${account}/operations` +
    `?limit=${OPERATIONS_PAGE_SIZE}&order=desc&include_failed=false`

  for (let page = 0; page < MAX_OPERATION_PAGES && url; page += 1) {
    const data = await getJson<HorizonPage>(url, signal)
    const records = data._embedded?.records ?? []
    if (records.length === 0) break
    ops.push(...records)
    onPage?.(ops.length)
    if (records.length < OPERATIONS_PAGE_SIZE) break
    url = nextHorizonUrl(data._links?.next?.href, horizonUrl)
  }
  return ops
}

export async function fetchTransactionOperations(
  horizonUrl: string,
  txHash: string,
  signal?: AbortSignal,
): Promise<HorizonOperation[]> {
  const data = await getJson<HorizonPage>(
    `${horizonUrl.replace(/\/$/, "")}/transactions/${txHash}/operations?limit=50`,
    signal,
  )
  return data._embedded?.records ?? []
}

export async function accountExists(
  horizonUrl: string,
  account: string,
  signal?: AbortSignal,
): Promise<boolean> {
  throwIfAborted(signal)
  try {
    const response = await fetch(`${horizonUrl.replace(/\/$/, "")}/accounts/${account}`, { signal })
    return response.ok
  } catch (error) {
    if (signal?.aborted) throw error
    return false
  }
}
