import { useMemo, useRef, useState, type FormEvent } from "react"
import { shortAddress } from "./lib/addresses.ts"
import { formatAmount } from "./lib/amounts.ts"
import { downloadText, printResults, rowsToCsv, rowsToMarkdown } from "./lib/export.ts"
import { isAbortError } from "./lib/http.ts"
import { getNetwork } from "./lib/network.ts"
import { Presence } from "./Presence.tsx"
import { Toasts, useToasts } from "./Toasts.tsx"
import type { LookupProgress, LookupResult, MilestoneRow, ScanMode } from "./lib/types.ts"
import "./App.css"

function flagList(row: MilestoneRow): string {
  const flags = [
    row.flags.approved ? "approved" : null,
    row.flags.disputed ? "disputed" : null,
    row.flags.released ? "released" : null,
    row.flags.resolved ? "resolved" : null,
  ].filter(Boolean)
  return flags.length ? flags.join(" · ") : "—"
}

function tokens(value: string): string[] {
  return value.split(/[\s,]+/).filter(Boolean)
}

function resolveScanMode(deployers: string, contractIds: string): ScanMode {
  const deployerList = tokens(deployers)
  const escrowList = tokens(contractIds)
  if (escrowList.length > 0 && deployerList.length === 0) return "escrow"
  if (deployerList.length > 0 && escrowList.length === 0) return "deployer"
  return "factory"
}

function shortDate(iso?: string): string {
  if (!iso) return "—"
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return "—"
  return new Date(time).toISOString().slice(0, 10)
}

function App() {
  const [wallet, setWallet] = useState("")
  const [deployers, setDeployers] = useState("")
  const [contractIds, setContractIds] = useState("")
  const [factoryOverride, setFactoryOverride] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<LookupProgress | null>(null)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const { toasts, pushToast, dismissToast } = useToasts()

  const network = useMemo(() => {
    const base = getNetwork("mainnet")
    const factoryId = factoryOverride.trim() || base.factoryId
    return { ...base, factoryId }
  }, [factoryOverride])
  const percent = Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0)))

  function cancelScan() {
    abortRef.current?.abort()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const scanMode = resolveScanMode(deployers, contractIds)
    setBusy(true)
    setResult(null)
    setExportOpen(false)
    setProgress({ stage: "Starting", percent: 1 })
    try {
      const { lookupWallet } = await import("./lib/indexer.ts")
      const data = await lookupWallet(network, {
        wallet,
        scanMode,
        deployerAccounts: scanMode === "escrow" ? [] : tokens(deployers),
        extraContractIds: scanMode === "deployer" ? [] : tokens(contractIds),
        signal: controller.signal,
        onProgress: (next) => {
          if (!controller.signal.aborted) setProgress(next)
        },
      })
      if (!controller.signal.aborted) {
        setResult(data)
        for (const warning of data.summary.warnings) pushToast("warn", warning)
        if (data.rows.length === 0) {
          pushToast("warn", `No matching milestones on ${network.name}.`)
        } else {
          pushToast("ok", `Found ${data.rows.length} milestones on ${network.name}.`)
        }
      }
    } catch (err) {
      if (isAbortError(err)) {
        pushToast("warn", "Scan cancelled.")
      } else {
        setResult(null)
        pushToast("error", err instanceof Error ? err.message : "Lookup failed. Try again in a moment.")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
    }
  }

  function exportName(ext: string) {
    const stamp = new Date().toISOString().slice(0, 10)
    const short = wallet.trim().slice(0, 6) || "wallet"
    return `grantfox-payouts-${short}-${stamp}.${ext}`
  }

  return (
    <div className="app">
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <div className="glow" aria-hidden="true" />
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <h1>GrantFox payouts</h1>
            <p className="lede">
              Enter a Stellar wallet to see campaign amounts, projects, and whether
              each milestone is open, released, or rejected.
            </p>
          </div>
        </div>
        <Presence />
      </header>

      <form className="search" onSubmit={onSubmit}>
        <label className="field wallet-field">
          Wallet address
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Paste a G… address"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            aria-label="Stellar wallet address"
          />
        </label>
        <div className="actions">
          <button type="submit" className="primary" disabled={busy || !wallet.trim()}>
            <span>{busy ? "Scanning" : "Scan payouts"}</span>
          </button>
          {busy ? (
            <button type="button" className="ghost" onClick={cancelScan}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {busy ? (
        <section className="scan-card" aria-live="polite">
          <div className="scan-head">
            <span className="pulse" aria-hidden="true" />
            <div>
              <strong>{progress?.stage ?? "Scanning"}</strong>
              {progress?.detail ? <span className="scan-detail">{progress.detail}</span> : null}
            </div>
            <span className="scan-pct">{percent}%</span>
          </div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span className="bar-fill" style={{ width: `${Math.max(percent, 8)}%` }} />
            <span className="bar-shine" aria-hidden="true" />
          </div>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="toolbar">
            <section className="stats">
              <Stat label="Escrows" value={String(result.summary.escrowCount)} />
              <Stat label="Milestones" value={String(result.summary.rowCount)} />
              <Stat
                label="Total"
                value={`${formatAmount(result.summary.total, result.summary.decimals)} USDC`}
              />
              <Stat
                label="Released"
                value={`${formatAmount(result.summary.released, result.summary.decimals)} USDC`}
              />
              <Stat
                label="Open"
                value={`${formatAmount(result.summary.pending, result.summary.decimals)} USDC`}
              />
              <Stat
                label="Rejected"
                value={`${formatAmount(result.summary.rejected, result.summary.decimals)} USDC`}
              />
            </section>
            <div className="export">
              <button
                type="button"
                className="ghost"
                aria-expanded={exportOpen}
                onClick={() => setExportOpen((open) => !open)}
              >
                Export
              </button>
              {exportOpen ? (
                <div className="export-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      downloadText(exportName("csv"), rowsToCsv(result.rows), "text/csv;charset=utf-8")
                      setExportOpen(false)
                    }}
                  >
                    Spreadsheet (CSV)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      downloadText(
                        exportName("md"),
                        rowsToMarkdown(result.rows, result.summary),
                        "text/markdown;charset=utf-8",
                      )
                      setExportOpen(false)
                    }}
                  >
                    Markdown
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportOpen(false)
                      printResults()
                    }}
                  >
                    PDF / print
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <ul className="cards">
            {result.rows.length === 0 ? (
              <li className="empty">No matching milestones for this wallet.</li>
            ) : (
              result.rows.map((row) => (
                <li key={`${row.escrowId}-${row.milestoneIndex}`} className="card">
                  <div className="card-top">
                    <strong>{row.campaign || "Untitled"}</strong>
                    <span className={`pill ${row.payoutStatus}`}>{row.payoutStatus}</span>
                  </div>
                  <p className="card-project">{row.project || "—"}</p>
                  <p>{row.milestoneTitle}</p>
                  <div className="card-meta">
                    <span className="amount">{row.amountDisplay} USDC</span>
                    <span>{shortDate(row.createdAt)}</span>
                  </div>
                  <div className="links">
                    <a href={`${network.expertBase}/contract/${row.escrowId}`} target="_blank" rel="noreferrer">
                      {shortAddress(row.escrowId, 6, 4)}
                    </a>
                    {row.issueUrl ? (
                      <a href={row.issueUrl} target="_blank" rel="noreferrer">
                        issue
                      </a>
                    ) : null}
                    {row.prUrl ? (
                      <a href={row.prUrl} target="_blank" rel="noreferrer">
                        pr
                      </a>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Campaign</th>
                  <th>Project</th>
                  <th>Milestone</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Flags</th>
                  <th>Your role</th>
                  <th>Receiver</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty">
                      No matching milestones for this wallet.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((row) => (
                    <tr key={`${row.escrowId}-${row.milestoneIndex}`}>
                      <td className="mono muted">{shortDate(row.createdAt)}</td>
                      <td>
                        <div className="cell-title">{row.campaign || "Untitled"}</div>
                        <a
                          className="mono muted"
                          href={`${network.expertBase}/contract/${row.escrowId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddress(row.escrowId, 6, 4)}
                        </a>
                      </td>
                      <td>{row.project || "—"}</td>
                      <td>
                        <div>{row.milestoneTitle}</div>
                        <div className="muted">#{row.milestoneIndex}</div>
                      </td>
                      <td className="num amount">{row.amountDisplay}</td>
                      <td>
                        <span className={`pill ${row.payoutStatus}`}>{row.payoutStatus}</span>
                      </td>
                      <td className="muted">{flagList(row)}</td>
                      <td className="roles">{row.walletRoles.join(", ") || "—"}</td>
                      <td className="mono">{shortAddress(row.receiver)}</td>
                      <td className="links">
                        {row.issueUrl ? (
                          <a href={row.issueUrl} target="_blank" rel="noreferrer">
                            issue
                          </a>
                        ) : null}
                        {row.prUrl ? (
                          <a href={row.prUrl} target="_blank" rel="noreferrer">
                            pr
                          </a>
                        ) : null}
                        {!row.issueUrl && !row.prUrl ? "—" : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <details className="advanced">
        <summary>Advanced</summary>
        <p>Optional. Leave empty unless you need a narrower scan.</p>
        <label className="field">
          Factory contract
          <input
            value={factoryOverride}
            onChange={(e) => setFactoryOverride(e.target.value)}
            placeholder={network.factoryId || "C… factory for this network"}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="field">
          Deployer accounts
          <textarea
            value={deployers}
            onChange={(e) => setDeployers(e.target.value)}
            placeholder="G… signers, one per line"
            rows={2}
          />
        </label>
        <label className="field">
          Escrow contracts
          <textarea
            value={contractIds}
            onChange={(e) => setContractIds(e.target.value)}
            placeholder="C… contracts, one per line"
            rows={2}
          />
        </label>
      </details>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
