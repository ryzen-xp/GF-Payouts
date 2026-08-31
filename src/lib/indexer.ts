import { isAccount, isContract, normalizeAddress } from "./addresses.ts"
import { formatAmount, sumAmounts } from "./amounts.ts"
import {
  decodeFunctionName,
  ESCROW_TOUCH_FNS,
  FACTORY_DEPLOY_FN,
  INITIALIZE_FN,
} from "./decode.ts"
import { bytesFromUnknown, contractIdFromFactorySalt } from "./derive-contract-id.ts"
import { parseInvokesFromEnvelope, parseReturnContractId } from "./envelope.ts"
import { parseEscrow } from "./escrow.ts"
import { fetchFactoryTxs, type ExpertTx } from "./expert.ts"
import { accountExists, fetchAccountOperations, fetchTransactionOperations, type HorizonOperation } from "./horizon.ts"
import { errorMessage, isAbortError, throwIfAborted } from "./http.ts"
import { walletInvolved } from "./match.ts"
import { DEFAULT_DECIMALS } from "./network.ts"
import { compareRowsNewestFirst, rowsForEscrow } from "./rows.ts"
import { createRpc, listTwInitEvents, loadEscrow, loadTokenDecimals } from "./rpc.ts"
import type {
  Escrow,
  LookupProgress,
  LookupResult,
  NetworkConfig,
  ScanMode,
  WalletRole,
} from "./types.ts"

export type LookupOptions = {
  wallet: string
  scanMode?: ScanMode
  extraContractIds?: string[]
  deployerAccounts?: string[]
  onProgress?: (progress: LookupProgress) => void
  signal?: AbortSignal
}

type FoundEscrow = {
  contractId: string
  snapshot?: Escrow
  signer?: boolean
  txHash?: string
  createdAt?: string
}

function emit(
  onProgress: LookupOptions["onProgress"],
  stage: string,
  detail?: string,
  percent?: number,
) {
  onProgress?.({ stage, detail, percent })
}

function addFound(map: Map<string, FoundEscrow>, next: FoundEscrow) {
  const prev = map.get(next.contractId)
  if (!prev) {
    map.set(next.contractId, next)
    return
  }
  map.set(next.contractId, {
    ...prev,
    ...next,
    snapshot: next.snapshot ?? prev.snapshot,
    signer: next.signer || prev.signer,
    txHash: prev.txHash ?? next.txHash,
    createdAt: prev.createdAt ?? next.createdAt,
  })
}

type DecodedInvoke = {
  contractId: string | null
  functionName: string | null
  args: unknown[]
}

function ingestDecoded(
  found: Map<string, FoundEscrow>,
  decoded: DecodedInvoke,
  network: NetworkConfig,
  scannedWallet: string,
  sourceAccount: string,
  txHash?: string,
  createdAt?: string,
  returnedContractId?: string,
) {
  if (!decoded.contractId || !decoded.functionName) return

  if (decoded.functionName === FACTORY_DEPLOY_FN) {
    const signer = String(decoded.args[0] ?? "")
    const salt = bytesFromUnknown(decoded.args[2])
    const snapshot = parseEscrow(decoded.args[4]) ?? undefined
    let contractId = returnedContractId && isContract(returnedContractId) ? returnedContractId : undefined
    if (!contractId && salt && salt.length === 32) {
      try {
        contractId = contractIdFromFactorySalt(decoded.contractId, salt, network.passphrase)
      } catch {
        contractId = undefined
      }
    }
    if (contractId) {
      addFound(found, {
        contractId,
        snapshot,
        signer: signer === scannedWallet || sourceAccount === scannedWallet,
        txHash,
        createdAt,
      })
    }
    return
  }

  if (decoded.functionName === INITIALIZE_FN) {
    addFound(found, {
      contractId: decoded.contractId,
      snapshot: parseEscrow(decoded.args[0]) ?? undefined,
      signer: sourceAccount === scannedWallet,
      txHash,
      createdAt,
    })
    return
  }

  if (ESCROW_TOUCH_FNS.has(decoded.functionName) && isContract(decoded.contractId)) {
    addFound(found, {
      contractId: decoded.contractId,
      signer: sourceAccount === scannedWallet,
      txHash,
      createdAt,
    })
  }
}

function ingestInvoke(
  found: Map<string, FoundEscrow>,
  op: HorizonOperation,
  network: NetworkConfig,
  scannedWallet: string,
) {
  if (op.type !== "invoke_host_function" || !op.parameters) return
  ingestDecoded(
    found,
    decodeFunctionName(op.parameters),
    network,
    scannedWallet,
    op.source_account,
    op.transaction_hash,
    op.created_at,
  )
}

function ingestExpertTx(
  found: Map<string, FoundEscrow>,
  tx: ExpertTx,
  network: NetworkConfig,
  scannedWallet: string,
) {
  if (!tx.body) return
  const createdAt = tx.ts ? new Date(tx.ts * 1000).toISOString() : undefined
  const returnedContractId = parseReturnContractId(tx.meta)
  for (const invoke of parseInvokesFromEnvelope(tx.body)) {
    ingestDecoded(
      found,
      invoke,
      network,
      scannedWallet,
      invoke.sourceAccount,
      tx.hash,
      createdAt,
      returnedContractId,
    )
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
  onTick?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = []
  let index = 0
  let done = 0
  async function run() {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await worker(items[current] as T)
      done += 1
      onTick?.(done, items.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()))
  return results
}

function yieldToUi(signal?: AbortSignal) {
  throwIfAborted(signal)
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

export async function lookupWallet(
  network: NetworkConfig,
  options: LookupOptions,
): Promise<LookupResult> {
  const wallet = normalizeAddress(options.wallet)
  const scanMode: ScanMode = options.scanMode ?? "factory"
  const signal = options.signal
  const warnings: string[] = []
  if (!isAccount(wallet)) {
    throw new Error("Enter a Stellar account address starting with G")
  }
  if (scanMode === "deployer") {
    const deployers = (options.deployerAccounts ?? []).map(normalizeAddress).filter(isAccount)
    if (deployers.length === 0) {
      throw new Error("Add at least one deployer account (G…) to scan")
    }
  }
  if (scanMode === "escrow") {
    const ids = (options.extraContractIds ?? []).map(normalizeAddress).filter(isContract)
    if (ids.length === 0) {
      throw new Error("Add at least one escrow contract ID (C…)")
    }
  }

  throwIfAborted(signal)
  emit(options.onProgress, "Checking account", wallet, 4)
  try {
    const exists = await accountExists(network.horizonUrl, wallet, signal)
    if (!exists) warnings.push("Horizon has no account record for this address yet.")
  } catch (error) {
    if (isAbortError(error)) throw error
    warnings.push("Could not reach Horizon to check this account.")
  }

  const found = new Map<string, FoundEscrow>()
  const accountsToScan =
    scanMode === "escrow"
      ? []
      : [
          wallet,
          ...(options.deployerAccounts ?? []).map(normalizeAddress).filter(isAccount),
        ]
  const uniqueAccounts = [...new Set(accountsToScan)]

  if (scanMode === "factory") {
    if (!isContract(network.factoryId)) {
      warnings.push(
        "No factory contract is set for this network. Add a C… factory ID under Advanced.",
      )
    } else {
      try {
      emit(options.onProgress, "Scanning factory deployments", network.factoryId, 8)
      const factoryTxs = await fetchFactoryTxs(
        network,
        (count) => {
          emit(
            options.onProgress,
            "Scanning factory deployments",
            `${count} txs`,
            Math.min(32, 8 + count / 40),
          )
        },
        signal,
      )
      const withEnvelope = factoryTxs.filter((tx) => tx.body)
      const withoutEnvelope = factoryTxs.filter((tx) => !tx.body)
      emit(
        options.onProgress,
        "Decoding factory envelopes",
        `0 / ${withEnvelope.length}`,
        34,
      )
      for (let i = 0; i < withEnvelope.length; i += 1) {
        throwIfAborted(signal)
        try {
          ingestExpertTx(found, withEnvelope[i] as ExpertTx, network, wallet)
        } catch {
          // skip a single malformed envelope
        }
        if (i === withEnvelope.length - 1 || i % 25 === 0) {
          const ratio = withEnvelope.length ? (i + 1) / withEnvelope.length : 1
          emit(
            options.onProgress,
            "Decoding factory envelopes",
            `${i + 1} / ${withEnvelope.length}`,
            34 + ratio * 28,
          )
          await yieldToUi(signal)
        }
      }
      if (withoutEnvelope.length > 0) {
        emit(
          options.onProgress,
          "Fetching remaining factory operations",
          `0 / ${withoutEnvelope.length}`,
          64,
        )
        await mapPool(
          withoutEnvelope,
          8,
          async (tx) => {
            throwIfAborted(signal)
            try {
              const ops = await fetchTransactionOperations(network.horizonUrl, tx.hash, signal)
              for (const op of ops) ingestInvoke(found, op, network, wallet)
            } catch (error) {
              if (isAbortError(error)) throw error
            }
          },
          (done, total) => {
            emit(
              options.onProgress,
              "Fetching remaining factory operations",
              `${done} / ${total}`,
              64 + (total ? (done / total) * 6 : 6),
            )
          },
        )
      }
    } catch (error) {
      if (isAbortError(error)) throw error
      warnings.push(
        `Factory scan skipped: ${errorMessage(error)}`,
      )
      }
    }
  }

  for (const account of uniqueAccounts) {
    throwIfAborted(signal)
    emit(options.onProgress, "Scanning Horizon operations", account, 72)
    try {
      const ops = await fetchAccountOperations(
        network.horizonUrl,
        account,
        (count) => {
          emit(options.onProgress, "Scanning Horizon operations", `${account} · ${count} ops`, 74)
        },
        signal,
      )
      for (const op of ops) ingestInvoke(found, op, network, wallet)
    } catch (error) {
      if (isAbortError(error)) throw error
      warnings.push(
        `Could not read operations for ${account}: ${errorMessage(error)}`,
      )
    }
  }

  for (const raw of options.extraContractIds ?? []) {
    const id = normalizeAddress(raw)
    if (isContract(id)) addFound(found, { contractId: id })
  }

  const rpcServer = createRpc(network)
  if (scanMode === "factory" && isContract(network.factoryId)) {
    try {
      throwIfAborted(signal)
      emit(options.onProgress, "Scanning recent events", undefined, 78)
      const health = await rpcServer.getHealth()
      const events = await listTwInitEvents(rpcServer, health.oldestLedger)
      for (const event of events) addFound(found, { contractId: event.contractId })
    } catch (error) {
      if (isAbortError(error)) throw error
      warnings.push(
        `RPC event scan skipped: ${errorMessage(error)}`,
      )
    }
  }

  const contractIds = [...found.keys()].filter((contractId) => {
    const meta = found.get(contractId)
    if (!meta?.snapshot) return true
    return walletInvolved(meta.snapshot, wallet, meta.signer ? ["signer"] : [])
  })
  emit(
    options.onProgress,
    "Loading live escrow state",
    `0 / ${contractIds.length}`,
    82,
  )

  const live = await mapPool(
    contractIds,
    8,
    async (contractId) => {
      throwIfAborted(signal)
      try {
        const escrow = await loadEscrow(rpcServer, network, contractId)
        return { contractId, escrow }
      } catch (error) {
        if (isAbortError(error)) throw error
        return { contractId, escrow: null }
      }
    },
    (done, total) => {
      emit(
        options.onProgress,
        "Loading live escrow state",
        `${done} / ${total}`,
        82 + (total ? (done / total) * 16 : 16),
      )
    },
  )

  const decimalsCache = new Map<string, number>()
  async function decimalsFor(trustline: string): Promise<number> {
    if (!trustline) return DEFAULT_DECIMALS
    const cached = decimalsCache.get(trustline)
    if (cached !== undefined) return cached
    const value = await loadTokenDecimals(rpcServer, network, trustline, DEFAULT_DECIMALS)
    decimalsCache.set(trustline, value)
    return value
  }

  const rows = []
  let matchedEscrows = 0
  for (const item of live) {
    const meta = found.get(item.contractId)
    const escrow = item.escrow ?? meta?.snapshot
    if (!escrow) continue
    const extraRoles: WalletRole[] = meta?.signer ? ["signer"] : []
    if (!walletInvolved(escrow, wallet, extraRoles)) continue
    matchedEscrows += 1
    const decimals = await decimalsFor(escrow.trustline.address).catch(() => DEFAULT_DECIMALS)
    rows.push(
      ...rowsForEscrow({
        escrowId: item.contractId,
        escrow,
        wallet,
        decimals,
        extraRoles,
        txHash: meta?.txHash,
        createdAt: meta?.createdAt,
        onlyWalletMilestones: true,
      }),
    )
  }

  rows.sort(compareRowsNewestFirst)

  if (found.size === 0) {
    warnings.push(
      "No escrow contracts were found from the factory or this wallet’s transactions.",
    )
  }

  const decimals = rows[0]?.decimals ?? DEFAULT_DECIMALS
  const total = sumAmounts(rows.map((row) => row.amount))
  const released = sumAmounts(rows.filter((row) => row.payoutStatus === "released").map((row) => row.amount))
  const rejected = sumAmounts(rows.filter((row) => row.payoutStatus === "rejected").map((row) => row.amount))
  const pending = total - released - rejected

  emit(options.onProgress, "Done", `${rows.length} milestones`, 100)

  return {
    rows,
    summary: {
      wallet,
      escrowCount: matchedEscrows,
      rowCount: rows.length,
      total,
      released,
      pending,
      rejected,
      decimals,
      warnings,
    },
  }
}

export function formatSummaryAmount(amount: bigint, decimals: number): string {
  return formatAmount(amount, decimals)
}
