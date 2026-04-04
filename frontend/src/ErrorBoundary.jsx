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
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-gray-900 border border-red-700 rounded-xl p-6">
            <h1 className="text-xl font-semibold text-red-300 mb-2">Something went wrong</h1>
            <p className="text-gray-300 mb-4">
              The app hit an unexpected error. You can reload the window from the menu.
            </p>
            <pre className="text-xs text-gray-400 whitespace-pre-wrap break-words">
              {this.state.message}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
