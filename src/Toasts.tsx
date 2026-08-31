import { useState } from "react"

export type ToastKind = "error" | "warn" | "ok"
export type ToastItem = { id: number; kind: ToastKind; text: string }

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function pushToast(kind: ToastKind, text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current.slice(-4), { id, kind, text }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, kind === "error" ? 7000 : 4500)
  }

  return { toasts, pushToast, dismissToast }
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div className="toasts" aria-live="assertive">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
          <p>{toast.text}</p>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
