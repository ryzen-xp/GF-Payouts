import { describe, expect, it } from "vitest"
import { rowsToCsv, rowsToMarkdown } from "./export.ts"
import { rewriteToProxy } from "./http.ts"
import type { MilestoneRow } from "./types.ts"

const row: MilestoneRow = {
  escrowId: "CESCROW",
  campaign: "Third Campaign - Demo",
  campaignDescription: "",
  engagementId: "x",
  project: "demo-repo",
  milestoneTitle: 'Say "hello", world',
  milestoneIndex: 0,
  amount: 1000000000n,
  amountDisplay: "100",
  status: "pending",
  payoutStatus: "pending",
  flags: { approved: false, disputed: false, released: false, resolved: false },
  receiver: "GAFGRECEIVER",
  roles: {
    approver: "GAPP",
    dispute_resolver: "GDIS",
    platform: "GAPP",
    release_signer: "GAPP",
    service_provider: "GAPP",
  },
  trustline: "CUSDC",
  decimals: 7,
  evidence: "",
  issueUrl: "https://github.com/org/repo/issues/1",
  prUrl: "",
  walletRoles: ["receiver"],
}

describe("export", () => {
  it("escapes quotes in CSV", () => {
    const csv = rowsToCsv([row])
    expect(csv).toContain('"Say ""hello"", world"')
    expect(csv).toContain("100")
  })

  it("builds a markdown table with totals", () => {
    const md = rowsToMarkdown([row], {
      wallet: "GAFGRECEIVER",
      escrowCount: 1,
      rowCount: 1,
      total: 1000000000n,
      released: 0n,
      pending: 1000000000n,
      rejected: 0n,
      decimals: 7,
      warnings: [],
    })
    expect(md).toContain("| Third Campaign - Demo | demo-repo |")
    expect(md).toContain("Total: 100 USDC")
  })
})

describe("rewriteToProxy", () => {
  it("keeps expert pagination on the same-origin proxy", () => {
    expect(
      rewriteToProxy("/explorer/public/tx?cursor=1", "http://localhost:5173/expert", [
        "api.stellar.expert",
      ]),
    ).toBe("http://localhost:5173/expert/explorer/public/tx?cursor=1")
    expect(
      rewriteToProxy(
        "https://api.stellar.expert/explorer/public/tx?cursor=2",
        "http://localhost:5173/expert",
        ["api.stellar.expert"],
      ),
    ).toBe("http://localhost:5173/expert/explorer/public/tx?cursor=2")
  })
})
