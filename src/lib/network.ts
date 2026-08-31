import type { NetworkConfig } from "./types.ts"

const MAINNET_FACTORY =
  "CB2HSK3BTB5LCNDZNBMHELPI3DLS724GKFVFQQOXZBOYU2CIPAR5QDMD"

function env(name: string): string | undefined {
  try {
    const value = import.meta.env?.[name]
    return typeof value === "string" && value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

function pageOrigin(): string | undefined {
  if (!isBrowser()) return undefined
  try {
    return window.location.origin
  } catch {
    return undefined
  }
}

/** `new URL("/rpc")` throws; the SDK requires an absolute server URL. */
export function withOrigin(path: string, origin?: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (!origin) return path
  const root = origin.replace(/\/$/, "")
  return `${root}${path.startsWith("/") ? path : `/${path}`}`
}

function viteProxy(path: string): string {
  return withOrigin(path, pageOrigin())
}

export function getNetwork(name: NetworkConfig["name"] = "mainnet"): NetworkConfig {
  const useProxy = isBrowser()
  if (name === "testnet") {
    return {
      name,
      passphrase: "Test SDF Network ; September 2015",
      horizonUrl:
        env("VITE_TESTNET_HORIZON_URL") ??
        (useProxy ? viteProxy("/testnet/horizon") : "https://horizon-testnet.stellar.org"),
      rpcUrl:
        env("VITE_TESTNET_RPC_URL") ??
        (useProxy ? viteProxy("/testnet/rpc") : "https://soroban-testnet.stellar.org"),
      factoryId: env("VITE_TESTNET_FACTORY_ID") ?? "",
      expertBase: "https://stellar.expert/explorer/testnet",
      expertApi:
        env("VITE_TESTNET_EXPERT_API") ??
        (useProxy ? viteProxy("/expert") : "https://api.stellar.expert"),
    }
  }

  return {
    name,
    passphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl:
      env("VITE_HORIZON_URL") ??
      (useProxy ? viteProxy("/horizon") : "https://horizon.stellar.org"),
    rpcUrl:
      env("VITE_RPC_URL") ??
      (useProxy ? viteProxy("/rpc") : "https://mainnet.sorobanrpc.com"),
    factoryId: env("VITE_FACTORY_ID") ?? MAINNET_FACTORY,
    expertBase: "https://stellar.expert/explorer/public",
    expertApi:
      env("VITE_EXPERT_API") ??
      (useProxy ? viteProxy("/expert") : "https://api.stellar.expert"),
  }
}

export const DEFAULT_DECIMALS = 7
export const MAX_OPERATION_PAGES = 20
export const OPERATIONS_PAGE_SIZE = 200
