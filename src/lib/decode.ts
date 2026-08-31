import { scValToNative, xdr } from "@stellar/stellar-sdk"

export function decodeScVal(base64: string): unknown {
  const scv = xdr.ScVal.fromXdr(base64, "base64")
  return scValToNative(scv)
}

export function decodeFunctionName(params: Array<{ type?: string; value?: string }>): {
  contractId: string | null
  functionName: string | null
  args: unknown[]
} {
  if (params.length < 2 || !params[0]?.value || !params[1]?.value) {
    return { contractId: null, functionName: null, args: [] }
  }
  const contractId = String(decodeScVal(params[0].value) ?? "")
  const functionName = String(decodeScVal(params[1].value) ?? "")
  const args = params.slice(2).map((param) => (param.value ? decodeScVal(param.value) : null))
  return { contractId, functionName, args }
}

export const FACTORY_DEPLOY_FN = "tw_new_multi_release_escrow"
export const INITIALIZE_FN = "initialize_escrow"

export const ESCROW_TOUCH_FNS = new Set([
  "get_escrow",
  "fund_escrow",
  "update_escrow",
  "approve_milestone",
  "dispute_milestone",
  "initialize_escrow",
  "extend_contract_ttl",
  "change_milestone_status",
  "release_milestone_funds",
  "withdraw_remaining_funds",
  "resolve_milestone_dispute",
  "get_escrow_by_contract_id",
])
