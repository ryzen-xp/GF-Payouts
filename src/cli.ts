import { lookupWallet } from "./lib/indexer.ts"
import { getNetwork } from "./lib/network.ts"
import { shortAddress } from "./lib/addresses.ts"

const wallet = process.argv[2]
if (!wallet) {
  console.error("Usage: npm run lookup -- G... [deployerG...]")
  process.exit(1)
}

const networkName = process.env.NETWORK === "testnet" ? "testnet" : "mainnet"
const network = getNetwork(networkName)
const deployers = process.argv.slice(3)

const result = await lookupWallet(network, {
  wallet,
  deployerAccounts: deployers,
  onProgress: (p) => {
    const line = p.detail ? `${p.stage} — ${p.detail}` : p.stage
    process.stderr.write(`${line}\n`)
  },
})

console.table(
  result.rows.map((row) => ({
    campaign: row.campaign,
    project: row.project,
    milestone: row.milestoneTitle.slice(0, 60),
    amount: row.amountDisplay,
    status: row.status,
    flags: [
      row.flags.released ? "released" : "",
      row.flags.approved ? "approved" : "",
    ]
      .filter(Boolean)
      .join(",") || "-",
    role: row.walletRoles.join(","),
    receiver: shortAddress(row.receiver),
    escrow: shortAddress(row.escrowId, 6, 4),
  })),
)

console.log(
  `escrows=${result.summary.escrowCount} milestones=${result.summary.rowCount} total=${result.summary.total} pending=${result.summary.pending}`,
)
for (const warning of result.summary.warnings) console.warn(warning)
