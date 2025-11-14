import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

export class EnhancedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return { 
      hasError: true, 
      error,
      errorId
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('EnhancedErrorBoundary caught:', error, errorInfo);
    
    this.setState({
      errorInfo,
      retryCount: this.state.retryCount
    });

    // Log error to external service if configured
    this.logErrorToService(error, errorInfo);
  }

  // Log error to external monitoring service
  logErrorToService = (error, errorInfo) => {
    const errorData = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
      userId: localStorage.getItem('user_id') // If available
    };

    // Send to monitoring service (replace with your service)
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to external service
      fetch('/api/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData)
      }).catch(err => console.warn('Failed to log error:', err));
    }
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorId, retryCount } = this.state;
      const isNetworkError = error && (
        error.message.includes('Failed to fetch') ||
        error.message.includes('Network Error') ||
        error.message.includes('Network request failed')
      );

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                {isNetworkError ? (
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                ) : (
                  <Bug className="h-6 w-6 text-red-600" />
                )}
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {isNetworkError ? 'Connection Problem' : 'Something went wrong'}
              </h2>
              
              <p className="text-gray-600 mb-4">
                {isNetworkError 
                  ? 'We couldn\'t connect to our servers. Please check your internet connection and try again.'
                  : 'An unexpected error occurred. Our team has been notified and is working on a fix.'
                }
              </p>

              {process.env.NODE_ENV === 'development' && error && (
                <details className="text-left mb-4 p-4 bg-gray-100 rounded-md">
                  <summary className="cursor-pointer font-medium text-sm mb-2">
                    Error Details (Development)
                  </summary>
                  <div className="text-xs font-mono text-red-600">
                    <p className="mb-2"><strong>Error:</strong> {error.message}</p>
                    <p className="mb-2"><strong>Stack:</strong></p>
                    <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                      {error.stack}
                    </pre>
                    {errorInfo && (
                      <>
                        <p className="mt-2 mb-1"><strong>Component Stack:</strong></p>
                        <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                          {errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}

              {process.env.NODE_ENV === 'production' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Error ID:</strong> {errorId}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Please include this ID if you contact support.
                  </p>
                </div>
              )}

              <div className="space-y-3 sm:space-y-0 sm:space-x-3 sm:flex sm:justify-center">
                {retryCount < 3 && (
                  <button
                    onClick={this.handleRetry}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </button>
                )}
                
                <button
                  onClick={this.handleReload}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </button>
              </div>

              {retryCount >= 3 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    Multiple retry attempts failed. Please try reloading the page or contact support if the problem persists.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different types of errors
export class NetworkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    const isNetworkError = error && (
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network Error') ||
      error.message.includes('Network request failed')
    );

    if (isNetworkError) {
      return { hasError: true, error };
    }

    return null;
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
          </div>
          <p className="text-sm text-red-700 mb-3">
            Unable to connect to the server. Please check your internet connection.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading state with error recovery
export class LoadingErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retrying: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleRetry = async () => {
    this.setState({ retrying: true });
    
    // Wait a moment before retrying
    setTimeout(() => {
      this.setState({ hasError: false, error: null, retrying: false });
      if (this.props.onRetry) {
        this.props.onRetry();
      }
    }, 1000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Failed</h3>
            <p className="text-gray-600 mb-4">Unable to load this content.</p>
            <button
              onClick={this.handleRetry}
              disabled={this.state.retrying}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${this.state.retrying ? 'animate-spin' : ''}`} />
              {this.state.retrying ? 'Retrying...' : 'Try Again'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}