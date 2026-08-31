import { beforeEach, describe, expect, it } from "vitest"
import { formatCount } from "./presence.ts"
import {
  handlePresence,
  parsePresenceTick,
  resetMemoryPresence,
  snapshotMemory,
  tickMemory,
} from "./presence-store.ts"

describe("formatCount", () => {
  it("compacts thousands", () => {
    expect(formatCount(0)).toBe("0")
    expect(formatCount(12)).toBe("12")
    expect(formatCount(1284)).toBe("1.3k")
    expect(formatCount(12_000)).toBe("12k")
  })
})

describe("presence store", () => {
  beforeEach(() => {
    resetMemoryPresence()
  })

  it("rejects short ids", () => {
    expect(parsePresenceTick({ sessionId: "abc", visitorId: "visitor-1" })).toBeNull()
  })

  it("counts a unique visitor once and live sessions", () => {
    const visitor = { sessionId: "session-aaaa", visitorId: "visitor-bbbb" }
    expect(tickMemory(visitor, 1_000).visits).toBe(1)
    expect(tickMemory(visitor, 2_000)).toEqual({ online: 1, visits: 1 })
    expect(
      tickMemory({ sessionId: "session-cccc", visitorId: "visitor-bbbb" }, 3_000),
    ).toEqual({ online: 2, visits: 1 })
    expect(tickMemory({ ...visitor, left: true }, 4_000)).toEqual({ online: 1, visits: 1 })
  })

  it("drops stale sessions", () => {
    tickMemory({ sessionId: "session-aaaa", visitorId: "visitor-bbbb" }, 1)
    expect(snapshotMemory(80_000)).toEqual({ online: 0, visits: 1 })
  })

  it("handles POST through the HTTP helper", async () => {
    const result = await handlePresence("POST", {
      sessionId: "session-zzzz",
      visitorId: "visitor-yyyy",
    })
    expect(result.status).toBe(200)
    expect(result.json).toEqual({ online: 1, visits: 1 })
  })
})
