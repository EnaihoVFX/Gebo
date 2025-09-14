import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded text-red-200">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm mb-2">The timeline component encountered an error.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-3 py-1 bg-red-800 text-white rounded text-sm hover:bg-red-700"
          >
            Try again
          </button>
          {this.state.error && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs">Error details</summary>
              <pre className="text-xs mt-1 text-red-300 bg-red-950/50 p-2 rounded overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

