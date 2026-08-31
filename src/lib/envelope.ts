import { Address, StrKey, scValToNative, xdr } from "@stellar/stellar-sdk"

export type EnvelopeInvoke = {
  contractId: string
  functionName: string
  args: unknown[]
  sourceAccount: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>
  return null
}

function muxedToG(value: unknown): string {
  const record = asRecord(value)
  if (!record) return ""
  const ed = record.ed25519
  const bytes =
    ed instanceof Uint8Array
      ? ed
      : asRecord(ed)?.value instanceof Uint8Array
        ? (asRecord(ed)?.value as Uint8Array)
        : null
  if (!bytes || bytes.length !== 32) return ""
  return StrKey.encodeEd25519PublicKey(bytes)
}

function txFromEnvelope(env: Record<string, unknown>): Record<string, unknown> | null {
  const v1 = asRecord(env.v1)
  if (v1) return asRecord(v1.tx)
  const feeBump = asRecord(env.feeBump)
  const innerWrap = feeBump ? asRecord(feeBump.tx) : null
  const innerTx = innerWrap ? asRecord(innerWrap.innerTx) : null
  const innerV1 = innerTx ? asRecord(innerTx.v1) : null
  if (innerV1) return asRecord(innerV1.tx)
  const v0 = asRecord(env.v0)
  return v0 ? asRecord(v0.tx) : null
}

function functionNameOf(value: unknown): string {
  if (typeof value === "string") return value
  const record = asRecord(value)
  if (record?.bytes instanceof Uint8Array) {
    return new TextDecoder().decode(record.bytes)
  }
  return String(value ?? "")
}

function contractIdOf(value: unknown): string {
  try {
    return Address.fromScAddress(value as Parameters<typeof Address.fromScAddress>[0]).toString()
  } catch {
    const record = asRecord(value)
    const contractId = record ? asRecord(record.contractId) : null
    const bytes = contractId?.value
    if (bytes instanceof Uint8Array) return StrKey.encodeContract(bytes)
    return ""
  }
}

export function parseInvokesFromEnvelope(bodyBase64: string): EnvelopeInvoke[] {
  const env = asRecord(xdr.TransactionEnvelope.fromXdr(bodyBase64, "base64"))
  if (!env) return []
  const tx = txFromEnvelope(env)
  if (!tx || !Array.isArray(tx.operations)) return []
  const txSource = muxedToG(tx.sourceAccount)
  const invokes: EnvelopeInvoke[] = []
  for (const operation of tx.operations) {
    const op = asRecord(operation)
    const body = op ? asRecord(op.body) : null
    const ihf = body ? asRecord(body.invokeHostFunctionOp) : null
    const hostFunction = ihf ? asRecord(ihf.hostFunction) : null
    const invoke = hostFunction ? asRecord(hostFunction.invokeContract) : null
    if (!invoke || !Array.isArray(invoke.args)) continue
    invokes.push({
      contractId: contractIdOf(invoke.contractAddress),
      functionName: functionNameOf(invoke.functionName),
      args: invoke.args.map((arg) => scValToNative(arg as Parameters<typeof scValToNative>[0])),
      sourceAccount: muxedToG(op?.sourceAccount) || txSource,
    })
  }
  return invokes
}

export function parseReturnContractId(metaBase64: string | undefined): string | undefined {
  if (!metaBase64) return undefined
  try {
    const meta = asRecord(xdr.TransactionMeta.fromXdr(metaBase64, "base64"))
    const version = asRecord(meta?.v4) ?? asRecord(meta?.v3)
    const sorobanMeta = version ? asRecord(version.sorobanMeta) : null
    if (!sorobanMeta?.returnValue) return undefined
    const native = scValToNative(sorobanMeta.returnValue as Parameters<typeof scValToNative>[0])
    if (Array.isArray(native) && typeof native[0] === "string") return native[0]
    if (typeof native === "string") return native
  } catch {
    return undefined
  }
  return undefined
}
