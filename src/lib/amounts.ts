export const DEFAULT_TOKEN_DECIMALS = 7

export function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value))
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value)
  if (value && typeof value === "object" && "toString" in value) {
    const text = String(value)
    if (/^-?\d+$/.test(text)) return BigInt(text)
  }
  return 0n
}

export function formatAmount(amount: bigint, decimals = DEFAULT_TOKEN_DECIMALS): string {
  const negative = amount < 0n
  const abs = negative ? -amount : amount
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const frac = abs % base
  const fracText = frac.toString().padStart(decimals, "0").replace(/0+$/, "")
  const body = fracText.length > 0 ? `${whole}.${fracText}` : whole.toString()
  return negative ? `-${body}` : body
}

export function sumAmounts(values: Iterable<bigint>): bigint {
  let total = 0n
  for (const value of values) total += value
  return total
}
