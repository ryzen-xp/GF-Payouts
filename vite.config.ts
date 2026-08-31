import type { IncomingMessage, ServerResponse } from "node:http"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"
import { handlePresence } from "./src/lib/presence-store.ts"

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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

async function servePresence(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("cache-control", "no-store")
  let body: unknown = null
  if (req.method === "POST") {
    try {
      const raw = await readBody(req)
      body = raw ? JSON.parse(raw) : {}
    } catch {
      res.statusCode = 400
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ error: "Bad request" }))
      return
    }
  }
  const result = await handlePresence(req.method ?? "GET", body)
  res.statusCode = result.status
  if (result.status === 204) {
    res.end()
    return
  }
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify(result.json))
}

function presencePlugin(): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split("?")[0] !== "/api/presence") {
      next()
      return
    }
    await servePresence(req, res)
  }
  return {
    name: "gf-presence",
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), presencePlugin()],
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
