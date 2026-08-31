# GrantFox payouts

Look up a Stellar wallet across Trustless Work **multi-release** escrows and list campaign, project, amount, and live status (pending, released, rejected).

Default factory (mainnet): `CB2HSK3BTB5LCNDZNBMHELPI3DLS724GKFVFQQOXZBOYU2CIPAR5QDMD`.

Toggle **Testnet** in the header to scan Stellar testnet (Horizon + Soroban RPC + StellarExpert). Set `VITE_TESTNET_FACTORY_ID` or paste a testnet factory `C…` under Advanced.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/ and paste a `G…` wallet. Deployer accounts and escrow contract IDs are under **Advanced** at the bottom of the page.

Export the table as CSV, Markdown, or PDF/print.

CLI:

```bash
npm run lookup -- GABCDEFG...
```

```bash
npm test
npm run build
```

## Deploy (Vercel)

This is a static Vite app. Each browser talks to Horizon / Soroban RPC / StellarExpert through same-origin proxies (`/horizon`, `/rpc`, `/expert`) so ~50 concurrent users do not share one server-side indexer.

```bash
npm i -g vercel
vercel
```

`vercel.json` rewrites `/horizon` and `/rpc` upstream, and `/expert` through `api/expert.ts` (Node, not Edge — StellarExpert sits behind Cloudflare, which blocks Vercel Edge fetches). The function adds the Referer StellarExpert requires and caches 45s.

| Variable | Meaning |
| --- | --- |
| `VITE_FACTORY_ID` | Mainnet factory contract (`C…`) |
| `VITE_TESTNET_FACTORY_ID` | Testnet factory contract (`C…`) |
| `VITE_RPC_URL` | Soroban RPC (optional; default is the `/rpc` proxy) |
| `VITE_HORIZON_URL` | Horizon (optional; default is the `/horizon` proxy) |
