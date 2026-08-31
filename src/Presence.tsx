import { formatCount, usePresence } from "./lib/presence.ts"

export function Presence() {
  const stats = usePresence()
  const online = stats?.online
  const visits = stats?.visits
  const live = online !== undefined && online > 0
  const label =
    online === undefined || visits === undefined
      ? "Site traffic"
      : `${online} ${online === 1 ? "person" : "people"} here now, ${visits} ${visits === 1 ? "visit" : "visits"}`

  return (
    <aside className="presence" aria-live="polite" aria-label={label}>
      <span className={`presence-dot${live ? " on" : ""}`} aria-hidden="true" />
      <strong>{online === undefined ? "—" : formatCount(online)}</strong>
      <span>online</span>
      <span className="presence-sep" aria-hidden="true" />
      <strong>{visits === undefined ? "—" : formatCount(visits)}</strong>
      <span>visits</span>
    </aside>
  )
}
