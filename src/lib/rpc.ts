import {
  Account,
  Address,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk"
import { parseEscrow } from "./escrow.ts"
import type { Escrow, NetworkConfig } from "./types.ts"

function escrowKey(): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Escrow")])
}

function escrowKeySymbol(): xdr.ScVal {
  return xdr.ScVal.scvSymbol("Escrow")
}

function extractContractData(entry: rpc.Api.LedgerEntryResult): unknown {
  if (entry.val.type !== "contractData") return null
  return scValToNative(entry.val.contractData.val)
}

export function createRpc(network: NetworkConfig): rpc.Server {
  const rpcUrl = network.rpcUrl
  return new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://") || rpcUrl.startsWith("/"),
  })
}

export async function readEscrowStorage(
  server: rpc.Server,
  contractId: string,
): Promise<Escrow | null> {
  for (const key of [escrowKey(), escrowKeySymbol()]) {
    try {
      const entry = await server.getContractData(contractId, key, rpc.Durability.Persistent)
      const parsed = parseEscrow(extractContractData(entry))
      if (parsed) return parsed
    } catch {
      // try the next key encoding
    }
  }
  return null
}

export async function simulateGetEscrow(
  server: rpc.Server,
  network: NetworkConfig,
  contractId: string,
): Promise<Escrow | null> {
  const source = new Account(Keypair.random().publicKey(), "0")
  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: network.passphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "get_escrow",
        args: [],
      }),
    )
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return null
  return parseEscrow(scValToNative(sim.result.retval))
}

export async function simulateGetEscrowByContractId(
  server: rpc.Server,
  network: NetworkConfig,
  factoryId: string,
  contractId: string,
): Promise<Escrow | null> {
  const source = new Account(Keypair.random().publicKey(), "0")
  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: network.passphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: factoryId,
        function: "get_escrow_by_contract_id",
        args: [Address.fromString(contractId).toScVal()],
      }),
    )
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return null
  return parseEscrow(scValToNative(sim.result.retval))
}

export async function loadEscrow(
  server: rpc.Server,
  network: NetworkConfig,
  contractId: string,
): Promise<Escrow | null> {
  const fromStorage = await readEscrowStorage(server, contractId)
  if (fromStorage) return fromStorage
  const fromCall = await simulateGetEscrow(server, network, contractId)
  if (fromCall) return fromCall
  return simulateGetEscrowByContractId(server, network, network.factoryId, contractId)
}

export async function loadTokenDecimals(
  server: rpc.Server,
  network: NetworkConfig,
  tokenContract: string,
  fallback = 7,
): Promise<number> {
  if (!tokenContract) return fallback
  try {
    const source = new Account(Keypair.random().publicKey(), "0")
    const tx = new TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: network.passphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: tokenContract,
          function: "decimals",
          args: [],
        }),
      )
      .setTimeout(30)
      .build()
    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      const value = scValToNative(sim.result.retval)
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0 && n <= 18) return n
    }
  } catch {
    // keep fallback
  }
  return fallback
}

export async function listTwInitEvents(
  server: rpc.Server,
  startLedger: number,
): Promise<Array<{ contractId: string }>> {
  const topic = nativeToScVal("tw_init", { type: "symbol" }).toXdr("base64")
  const found: Array<{ contractId: string }> = []
  const filters = [{ type: "contract" as const, topics: [[topic]] }]
  let page = await server.getEvents({
    startLedger,
    filters,
    limit: 100,
  })
  for (let i = 0; i < 20; i += 1) {
    for (const event of page.events) {
      const contractId = event.contractId?.contractId()
      if (contractId) found.push({ contractId })
    }
    if (!page.events.length || !page.cursor) break
    page = await server.getEvents({
      cursor: page.cursor,
      filters,
      limit: 100,
    })
  }
  return found
}
