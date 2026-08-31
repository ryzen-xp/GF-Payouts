import { StrKey } from "@stellar/stellar-sdk"

export function isAccount(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address)
}

export function isContract(address: string): boolean {
  return StrKey.isValidContract(address)
}

export function shortAddress(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

export function normalizeAddress(raw: string): string {
  return raw.trim().replace(/\s+/g, "")
}
