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
        <div className="mt-8 rounded-xl border border-[#F0B8B8] bg-[#FCEAEA] px-5 py-6 text-center">
          <p className="text-sm font-semibold text-[#D83B3B] mb-1">
            Something went wrong in the {this.props.tabName} tab.
          </p>
          <p className="text-xs text-[#D83B3B] mb-3 font-mono break-all">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="text-sm font-medium px-4 py-1.5 rounded-lg bg-[#FCEAEA] hover:bg-red-200 text-[#D83B3B] transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
