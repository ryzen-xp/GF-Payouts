export function payoutStatus(flags: {
  approved: boolean
  disputed: boolean
  released: boolean
  resolved: boolean
}, status: string): string {
  if (flags.released) return "released"
  if (flags.disputed && !flags.resolved) return "disputed"
  if (flags.resolved) return "resolved"
  const normalized = (status || "pending").toLowerCase()
  if (normalized === "rejected" || normalized === "reject") return "rejected"
  if (flags.approved) return "approved"
  return normalized || "pending"
}
