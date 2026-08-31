import { Address, StrKey, hash, xdr } from "@stellar/stellar-sdk"

export function bytesFromUnknown(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return Uint8Array.from(value)
  }
  if (
    value &&
    typeof value === "object" &&
    "length" in value &&
    typeof (value as { length: unknown }).length === "number"
  ) {
    try {
      return Uint8Array.from(value as ArrayLike<number>)
    } catch {
      return null
    }
  }
  return null
}

export function contractIdFromFactorySalt(
  factory: string,
  salt: Uint8Array,
  networkPassphrase: string,
): string {
  const networkId = hash(networkPassphrase)
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(factory).toScAddress(),
          salt,
        }),
      ),
    }),
  )
  return StrKey.encodeContract(hash(preimage.toXdr()))
}
