import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const proxy = {
  "/horizon": {
    target: "https://horizon.stellar.org",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/horizon/, ""),
  },
  "/rpc": {
    target: "https://mainnet.sorobanrpc.com",
    changeOrigin: true,
    rewrite: () => "/",
  },
  "/testnet/horizon": {
    target: "https://horizon-testnet.stellar.org",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/testnet\/horizon/, ""),
  },
  "/testnet/rpc": {
    target: "https://soroban-testnet.stellar.org",
    changeOrigin: true,
    rewrite: () => "/",
  },
  "/expert": {
    target: "https://api.stellar.expert",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/expert/, ""),
    headers: {
      Referer: "https://stellar.expert/",
      Origin: "https://stellar.expert",
    },
  },
}

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["@stellar/stellar-sdk"],
  },
  server: { proxy },
  preview: { proxy },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
