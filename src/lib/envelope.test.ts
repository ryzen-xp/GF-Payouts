import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { bytesFromUnknown, contractIdFromFactorySalt } from "./derive-contract-id.ts"
import { parseInvokesFromEnvelope } from "./envelope.ts"
import { parseEscrow } from "./escrow.ts"

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015"
const FACTORY = "CB2HSK3BTB5LCNDZNBMHELPI3DLS724GKFVFQQOXZBOYU2CIPAR5QDMD"

const factoryTx = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/factory-tx.json"), "utf8"),
) as { body: string }

describe("parseInvokesFromEnvelope", () => {
  it("reads a factory deploy and milestone receivers from Expert XDR", () => {
    const invokes = parseInvokesFromEnvelope(factoryTx.body)
    expect(invokes).toHaveLength(1)
    const invoke = invokes[0]
    expect(invoke?.contractId).toBe(FACTORY)
    expect(invoke?.functionName).toBe("tw_new_multi_release_escrow")
    const escrow = parseEscrow(invoke?.args[4])
    expect(escrow?.title).toBe("Third Campaign - DistinctCodes")
    expect(escrow?.milestones[0]?.receiver).toBe(
      "GDT7JFXMXERAMLTI75EUFJD5LMJDULMFE3ZRC5YM5GMS7AYXHBB4EEI2",
    )
    const salt = bytesFromUnknown(invoke?.args[2])
    expect(salt).toHaveLength(32)
    expect(contractIdFromFactorySalt(FACTORY, salt as Uint8Array, MAINNET_PASSPHRASE)).toBe(
      "CBBYDUV34EXZEK3V4ACQNEMYO2STIPH6A5TDIJKWBR3IDQ3IO777YTKC",
    )
  })
})
