import { describe, expect, it } from "vitest"
import { formatAmount, toBigInt } from "./amounts.ts"
import { withOrigin } from "./network.ts"
import { errorMessage } from "./http.ts"
import { parseMilestoneDescription } from "./milestone.ts"
import { parseEscrow } from "./escrow.ts"
import { walletRolesForEscrow } from "./match.ts"
import { compareRowsNewestFirst, rowsForEscrow } from "./rows.ts"
import { payoutStatus } from "./status.ts"

const sampleEscrow = {
  description: "Reward distribution to contributors of Trustless-OSS for Third Campaign",
  engagement_id: "b7Pg635y*l91AVh#^i^5Zw2Z*%JDYz%V0Pv",
  platform_fee: 0,
  receiver_memo: 0,
  title: "Third Campaign - Trustless-OSS",
  trustline: { address: "CCW67US3MI75" },
  roles: {
    approver: "GC6TAPPROVER",
    dispute_resolver: "GC5LDISPUTE",
    platform: "GC6TAPPROVER",
    release_signer: "GC6TAPPROVER",
    service_provider: "GC6TAPPROVER",
  },
  milestones: [
    {
      amount: 800000000n,
      description:
        "[ OpenAPI ] : Apply Swagger documentation to all API endpoints&Toss-Backend&https://github.com/Trustless-OSS/Toss-Backend/issues/7&https://github.com/Trustless-OSS/Toss-Backend/pull/10",
      evidence: "",
      flags: { approved: false, disputed: false, released: false, resolved: false },
      receiver: "GBUMRECEIVER",
      status: "pending",
    },
    {
      amount: 1000000000n,
      description: "Other work&Other-Repo",
      evidence: "",
      flags: { approved: true, disputed: false, released: true, resolved: false },
      receiver: "GCFJOTHER",
      status: "completed",
    },
  ],
}

describe("formatAmount", () => {
  it("renders USDC 7-decimal amounts", () => {
    expect(formatAmount(800000000n, 7)).toBe("80")
    expect(formatAmount(1000000000n, 7)).toBe("100")
    expect(formatAmount(15000000n, 7)).toBe("1.5")
  })

  it("coerces i128-like values", () => {
    expect(toBigInt("800000000")).toBe(800000000n)
    expect(toBigInt(12)).toBe(12n)
  })
})

describe("parseMilestoneDescription", () => {
  it("splits title, project, issue, and PR", () => {
    const parsed = parseMilestoneDescription(sampleEscrow.milestones[0].description)
    expect(parsed.title).toContain("OpenAPI")
    expect(parsed.project).toBe("Toss-Backend")
    expect(parsed.issueUrl).toContain("/issues/7")
    expect(parsed.prUrl).toContain("/pull/10")
  })
})

describe("escrow matching", () => {
  it("parses a native-like escrow map", () => {
    const parsed = parseEscrow(sampleEscrow)
    expect(parsed?.title).toBe("Third Campaign - Trustless-OSS")
    expect(parsed?.milestones).toHaveLength(2)
  })

  it("tags a receiver and hides other milestones", () => {
    const roles = walletRolesForEscrow(sampleEscrow, "GBUMRECEIVER")
    expect(roles).toEqual(["receiver"])
    const rows = rowsForEscrow({
      escrowId: "CADTESCROW",
      escrow: sampleEscrow,
      wallet: "GBUMRECEIVER",
      decimals: 7,
      onlyWalletMilestones: true,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.amountDisplay).toBe("80")
    expect(rows[0]?.project).toBe("Toss-Backend")
  })

  it("does not return rows for an unrelated wallet", () => {
    expect(walletRolesForEscrow(sampleEscrow, "GUNRELATED")).toEqual([])
  })

  it("orders newest campaign rows first", () => {
    const newer = { ...sampleEscrow.milestones[0], receiver: "GBUMRECEIVER" }
    const olderRow = rowsForEscrow({
      escrowId: "COLD",
      escrow: { ...sampleEscrow, milestones: [newer] },
      wallet: "GBUMRECEIVER",
      decimals: 7,
      createdAt: "2026-05-01T00:00:00.000Z",
      onlyWalletMilestones: true,
    })[0]
    const newerRow = rowsForEscrow({
      escrowId: "CNEW",
      escrow: { ...sampleEscrow, milestones: [newer] },
      wallet: "GBUMRECEIVER",
      decimals: 7,
      createdAt: "2026-08-31T00:00:00.000Z",
      onlyWalletMilestones: true,
    })[0]
    expect(compareRowsNewestFirst(newerRow!, olderRow!)).toBeLessThan(0)
    expect([newerRow, olderRow].sort(compareRowsNewestFirst).map((row) => row?.escrowId)).toEqual([
      "CNEW",
      "COLD",
    ])
  })
})

describe("withOrigin", () => {
  it("turns a vite proxy path into a URL the SDK can construct", () => {
    const rpcUrl = withOrigin("/rpc", "http://localhost:5173")
    expect(rpcUrl).toBe("http://localhost:5173/rpc")
    expect(() => new URL(rpcUrl)).not.toThrow()
    expect(() => new URL("/rpc")).toThrow()
    expect(withOrigin("/testnet/rpc", "http://localhost:5173")).toBe(
      "http://localhost:5173/testnet/rpc",
    )
  })
})

describe("errorMessage", () => {
  it("does not stringify objects as [object Object]", () => {
    expect(errorMessage({ message: "rpc failed", status: 500 })).toBe("rpc failed")
    expect(errorMessage({ code: 1, detail: "timeout" })).toBe("timeout")
    expect(errorMessage({ foo: "bar" })).toContain("foo")
  })
})

describe("payoutStatus", () => {
  it("maps flags to released / disputed / pending", () => {
    expect(
      payoutStatus(
        { approved: false, disputed: false, released: false, resolved: false },
        "pending",
      ),
    ).toBe("pending")
    expect(
      payoutStatus(
        { approved: true, disputed: false, released: true, resolved: false },
        "completed",
      ),
    ).toBe("released")
    expect(
      payoutStatus(
        { approved: false, disputed: true, released: false, resolved: false },
        "pending",
      ),
    ).toBe("disputed")
    expect(
      payoutStatus(
        { approved: false, disputed: true, released: false, resolved: true },
        "pending",
      ),
    ).toBe("resolved")
  })
})
