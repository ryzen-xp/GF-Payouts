import { formatAmount } from "./amounts.ts"
import type { LookupSummary, MilestoneRow } from "./types.ts"

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function rowsToCsv(rows: MilestoneRow[]): string {
  const header = [
    "campaign",
    "project",
    "milestone",
    "index",
    "amount",
    "status",
    "flags",
    "role",
    "receiver",
    "escrow",
    "issue",
    "pr",
  ]
  const lines = [header.join(",")]
  for (const row of rows) {
    const flags = [
      row.flags.approved ? "approved" : "",
      row.flags.disputed ? "disputed" : "",
      row.flags.released ? "released" : "",
      row.flags.resolved ? "resolved" : "",
    ].filter(Boolean)
    lines.push(
      [
        csvCell(row.campaign),
        csvCell(row.project),
        csvCell(row.milestoneTitle),
        String(row.milestoneIndex),
        row.amountDisplay,
        row.payoutStatus,
        csvCell(flags.join(" ")),
        csvCell(row.walletRoles.join(" ")),
        row.receiver,
        row.escrowId,
        row.issueUrl,
        row.prUrl,
      ].join(","),
    )
  }
  return `${lines.join("\n")}\n`
}

export function rowsToMarkdown(rows: MilestoneRow[], summary: LookupSummary): string {
  const total = formatAmount(summary.total, summary.decimals)
  const released = formatAmount(summary.released, summary.decimals)
  const pending = formatAmount(summary.pending, summary.decimals)
  const rejected = formatAmount(summary.rejected, summary.decimals)
  const lines = [
    `# GrantFox payouts`,
    ``,
    `- Wallet: \`${summary.wallet}\``,
    `- Escrows: ${summary.escrowCount}`,
    `- Milestones: ${summary.rowCount}`,
    `- Total: ${total} USDC`,
    `- Released: ${released} · Open: ${pending} · Rejected: ${rejected}`,
    ``,
    `| Campaign | Project | Milestone | Amount | Status | Receiver |`,
    `| --- | --- | --- | ---: | --- | --- |`,
  ]
  for (const row of rows) {
    const title = row.milestoneTitle.replace(/\|/g, "/")
    lines.push(
      `| ${row.campaign || "Untitled"} | ${row.project || "—"} | ${title} | ${row.amountDisplay} | ${row.payoutStatus} | ${row.receiver} |`,
    )
  }
  return `${lines.join("\n")}\n`
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function printResults() {
  window.print()
}
