import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <h1>Something broke</h1>
        <p>Reload the page and try the scan again. Your previous result was not saved.</p>
        <pre>{this.state.error.message}</pre>
        <button type="button" onClick={() => this.setState({ error: null })}>
          Try to recover
        </button>
      </div>
    )
  }
}
