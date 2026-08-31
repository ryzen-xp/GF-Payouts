import { formatAmount } from "./amounts.ts"
import { parseMilestoneDescription } from "./milestone.ts"
import { walletRolesForEscrow } from "./match.ts"
import { payoutStatus } from "./status.ts"
import type { Escrow, MilestoneRow, WalletRole } from "./types.ts"

export function rowsForEscrow(opts: {
  escrowId: string
  escrow: Escrow
  wallet: string
  decimals: number
  extraRoles?: WalletRole[]
  txHash?: string
  createdAt?: string
  onlyWalletMilestones?: boolean
}): MilestoneRow[] {
  const roles = walletRolesForEscrow(opts.escrow, opts.wallet, opts.extraRoles)

  return opts.escrow.milestones.flatMap((milestone, index) => {
    if (opts.onlyWalletMilestones && milestone.receiver !== opts.wallet) {
      return []
    }
    if (opts.onlyWalletMilestones && roles.length === 0 && milestone.receiver !== opts.wallet) {
      return []
    }

    const parsed = parseMilestoneDescription(milestone.description)
    const status = payoutStatus(milestone.flags, milestone.status)
    return [
      {
        escrowId: opts.escrowId,
        campaign: opts.escrow.title,
        campaignDescription: opts.escrow.description,
        engagementId: opts.escrow.engagement_id,
        project: parsed.project,
        milestoneTitle: parsed.title || milestone.description,
        milestoneIndex: index,
        amount: milestone.amount,
        amountDisplay: formatAmount(milestone.amount, opts.decimals),
        status,
        payoutStatus: status,
        flags: milestone.flags,
        receiver: milestone.receiver,
        roles: opts.escrow.roles,
        trustline: opts.escrow.trustline.address,
        decimals: opts.decimals,
        evidence: milestone.evidence,
        issueUrl: parsed.issueUrl,
        prUrl: parsed.prUrl,
        walletRoles:
          milestone.receiver === opts.wallet && !roles.includes("receiver")
            ? [...roles, "receiver"]
            : roles,
        txHash: opts.txHash,
        createdAt: opts.createdAt,
      } satisfies MilestoneRow,
    ]
  })
}

export function compareRowsNewestFirst(a: MilestoneRow, b: MilestoneRow): number {
  const ta = a.createdAt ? Date.parse(a.createdAt) : Number.NaN
  const tb = b.createdAt ? Date.parse(b.createdAt) : Number.NaN
  const sa = Number.isFinite(ta) ? ta : 0
  const sb = Number.isFinite(tb) ? tb : 0
  if (sb !== sa) return sb - sa
  if (a.campaign !== b.campaign) return a.campaign.localeCompare(b.campaign)
  return a.milestoneIndex - b.milestoneIndex
}
