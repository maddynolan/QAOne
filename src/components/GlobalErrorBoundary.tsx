import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Global Error Boundary — catches unhandled React rendering errors
 * and displays a friendly recovery UI instead of a white screen.
 *
 * Wraps the entire <App /> to prevent total SPA crashes.
 * Individual features use TabErrorBoundary for isolated failures.
 */
export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })

    // Log to console for debugging
    console.error('[GlobalErrorBoundary] Uncaught error:', error)
    console.error('[GlobalErrorBoundary] Component stack:', errorInfo.componentStack)

    // Optionally report to backend error tracking
    try {
      const apiBase = (window as any).__FLOWSTRAL_API_URL__ || ''
      if (apiBase) {
        fetch(`${apiBase}/api/errors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {
          // Silently fail — error reporting should never cause errors
        })
      }
    } catch {
      // Ignore
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-lg w-full mx-4 p-8 text-center">
            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Something went wrong
            </h1>
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred. Your data is safe — try reloading the page.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                Reload App
              </button>
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-border rounded-md hover:bg-accent transition-colors text-foreground font-medium"
              >
                Try Again
              </button>
            </div>

            {/* Error details (collapsible) */}
            {this.state.error && (
              <details className="text-left bg-muted/50 rounded-lg p-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground font-medium">
                  Technical Details
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="font-mono text-xs text-destructive break-all">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="font-mono text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap break-all">
                      {this.state.error.stack.split('\n').slice(0, 8).join('\n')}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Support link */}
            <p className="mt-6 text-xs text-muted-foreground">
              If this keeps happening, contact support at{' '}
              <a href="mailto:support@flowstral.com" className="text-primary hover:underline">
                support@flowstral.com
              </a>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
