import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "./ErrorBoundary.tsx"
import App from "./App.tsx"
import "./index.css"

const root = document.getElementById("root")
if (!root) {
  document.body.textContent = "GrantFox failed to start: missing #root."
} else {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
