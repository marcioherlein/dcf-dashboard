'use client'
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  tabName: string
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export default class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[TabErrorBoundary] ${this.props.tabName}:`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center">
          <p className="text-sm font-semibold text-red-700 mb-1">
            Something went wrong in the {this.props.tabName} tab.
          </p>
          <p className="text-xs text-red-500 mb-3 font-mono break-all">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="text-sm font-medium px-4 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
