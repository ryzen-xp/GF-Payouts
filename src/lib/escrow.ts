import { toBigInt } from "./amounts.ts"
import type { Escrow, Flags, Milestone, Roles } from "./types.ts"

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value)
}

function asBool(value: unknown): boolean {
  return value === true
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function pick(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return undefined
}

export function parseFlags(value: unknown): Flags {
  const record = asRecord(value)
  return {
    approved: asBool(record.approved),
    disputed: asBool(record.disputed),
    released: asBool(record.released),
    resolved: asBool(record.resolved),
  }
}

export function parseRoles(value: unknown): Roles {
  const record = asRecord(value)
  return {
    approver: asString(pick(record, "approver")),
    dispute_resolver: asString(pick(record, "dispute_resolver", "disputeResolver")),
    platform: asString(pick(record, "platform")),
    release_signer: asString(pick(record, "release_signer", "releaseSigner")),
    service_provider: asString(pick(record, "service_provider", "serviceProvider")),
  }
}

export function parseMilestone(value: unknown): Milestone {
  const record = asRecord(value)
  return {
    amount: toBigInt(pick(record, "amount")),
    description: asString(pick(record, "description")),
    evidence: asString(pick(record, "evidence")),
    flags: parseFlags(pick(record, "flags")),
    receiver: asString(pick(record, "receiver")),
    status: asString(pick(record, "status")) || "pending",
  }
}

export function parseEscrow(value: unknown): Escrow | null {
  let payload: unknown = value
  if (Array.isArray(value) && value.length === 1) payload = value[0]
  const record = asRecord(payload)
  if (!pick(record, "title") && !pick(record, "milestones")) return null

  const milestonesRaw = pick(record, "milestones")
  const milestones = Array.isArray(milestonesRaw)
    ? milestonesRaw.map(parseMilestone)
    : []

  const trustline = asRecord(pick(record, "trustline"))
  return {
    description: asString(pick(record, "description")),
    engagement_id: asString(pick(record, "engagement_id", "engagementId")),
    milestones,
    platform_fee: asNumber(pick(record, "platform_fee", "platformFee")),
    receiver_memo: asNumber(pick(record, "receiver_memo", "receiverMemo")),
    roles: parseRoles(pick(record, "roles")),
    title: asString(pick(record, "title")),
    trustline: { address: asString(pick(trustline, "address")) },
  }
}

export function escrowTouchesWallet(escrow: Escrow, wallet: string): boolean {
  if (Object.values(escrow.roles).includes(wallet)) return true
  return escrow.milestones.some((milestone) => milestone.receiver === wallet)
}
