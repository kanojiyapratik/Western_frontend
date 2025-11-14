import React from 'react';
import { AlertTriangle, RefreshCw, X, Info, CheckCircle, XCircle } from 'lucide-react';

// Main error display component
export const ErrorDisplay = ({ 
  error, 
  onRetry, 
  onDismiss, 
  showDetails = false, 
  type = 'default',
  retryCount = 0,
  maxRetries = 3
}) => {
  const [expanded, setExpanded] = React.useState(showDetails);

  if (!error) return null;

  const getErrorIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'network':
        return <RefreshCw className="h-5 w-5 text-blue-600" />;
      default:
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getErrorStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'network':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-red-50 border-red-200 text-red-800';
    }
  };

  const getErrorTitle = () => {
    if (typeof error === 'string') return 'Error';
    
    if (error.title) return error.title;
    
    switch (type) {
      case 'success':
        return 'Success';
      case 'warning':
        return 'Warning';
      case 'network':
        return 'Connection Issue';
      default:
        return 'Error';
    }
  };

  const getErrorMessage = () => {
    if (typeof error === 'string') return error;
    
    return error.message || error.toString();
  };

  return (
    <div className={`rounded-md border p-4 ${getErrorStyles()}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {getErrorIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {getErrorTitle()}
          </h3>
          <div className="mt-2 text-sm">
            <p>{getErrorMessage()}</p>
          </div>
          
          {error.details && (
            <div className="mt-3">
              <button
                type="button"
                className="text-xs underline hover:no-underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Hide details' : 'Show details'}
              </button>
              
              {expanded && (
                <div className="mt-2 p-2 bg-black bg-opacity-10 rounded text-xs font-mono whitespace-pre-wrap">
                  {typeof error.details === 'string' ? error.details : JSON.stringify(error.details, null, 2)}
                </div>
              )}
            </div>
          )}
          
          <div className="mt-4 flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            {onRetry && retryCount < maxRetries && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-gray-500"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Try Again
              </button>
            )}
            
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-gray-500"
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss
              </button>
            )}
          </div>
          
          {retryCount >= maxRetries && (
            <div className="mt-3 text-xs">
              <p>Maximum retry attempts reached. Please contact support if the problem persists.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Inline error component for forms
export const InlineError = ({ error, className = '' }) => {
  if (!error) return null;

  return (
    <div className={`mt-2 text-sm text-red-600 flex items-center ${className}`}>
      <XCircle className="h-4 w-4 mr-1 flex-shrink-0" />
      <span>{typeof error === 'string' ? error : error.message}</span>
    </div>
  );
};

// Loading state with error recovery
export const LoadingWithRetry = ({ 
  loading, 
  error, 
  onRetry, 
  children, 
  retryText = 'Retry',
  loadingText = 'Loading...'
}) => {
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Failed</h3>
        <p className="text-gray-600 mb-4">{error.message || 'Unable to load content'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {retryText}
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{loadingText}</p>
      </div>
    );
  }

  return <>{children}</>;
};

// Toast-style error notification
export const ToastError = ({ 
  error, 
  onClose, 
  autoClose = true, 
  duration = 5000 
}) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose, duration]);

  if (!error) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-gray-900">Error</p>
            <p className="mt-1 text-sm text-gray-500">
              {typeof error === 'string' ? error : error.message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Network status indicator
export const NetworkStatus = ({ isOnline, lastError, onRetry }) => {
  if (isOnline && !lastError) return null;

  return (
    <div className={`rounded-md p-4 mb-4 ${
      isOnline 
        ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
        : 'bg-red-50 border border-red-200 text-red-800'
    }`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {isOnline ? (
            <Info className="h-5 w-5 text-yellow-600" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600" />
          )}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {isOnline ? 'Connection Restored' : 'Connection Lost'}
          </h3>
          <div className="mt-2 text-sm">
            <p>
              {isOnline 
                ? 'Your internet connection is back online.'
                : 'You appear to be offline. Some features may not work properly.'
              }
            </p>
          </div>
          {!isOnline && onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Form field error helper
export const FieldError = ({ error, touched }) => {
  if (!error || !touched) return null;

  return (
    <p className="mt-1 text-sm text-red-600 flex items-center">
      <XCircle className="h-4 w-4 mr-1 flex-shrink-0" />
      <span>{error}</span>
    </p>
  );
};

// Generic error boundary fallback
export const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
        <p className="text-gray-600 mb-6">
          We encountered an unexpected error. Please try refreshing the page.
        </p>
        <div className="space-x-4">
          <button
            onClick={resetErrorBoundary}
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};