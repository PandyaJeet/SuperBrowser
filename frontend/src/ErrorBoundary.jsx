import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unexpected error' }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Renderer crash:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 dot-grid"
          style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
          <div className="max-w-xl w-full rounded-2xl p-8 animate-scale-in"
            style={{ background: 'var(--bg-surface)', border: '1px solid rgba(248,113,113,0.25)', boxShadow: '0 0 40px rgba(248,113,113,0.08)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'var(--red-dim)' }}>💥</div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--red)' }}>Something went wrong</h1>
            </div>
            <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
              The app hit an unexpected error. You can reload the window from the menu.
            </p>
            <pre className="text-xs whitespace-pre-wrap break-words rounded-xl p-4"
              style={{ background: 'var(--bg-card)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>
              {this.state.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="pill-btn-primary mt-4"
              style={{ fontSize: 14 }}>
              Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
