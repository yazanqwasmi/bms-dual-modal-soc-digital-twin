import React from 'react';

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in child component tree and displays fallback UI
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error to console (could send to monitoring service)
    console.error('Dashboard Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: '#1e1e2e',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#2d2d3d',
            border: '1px solid #ff6b6b',
            borderRadius: '8px',
            padding: '40px',
            maxWidth: '600px',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#ff6b6b', marginBottom: '20px' }}>
              ⚠️ Something went wrong
            </h2>
            <p style={{ color: '#a0a0a0', marginBottom: '20px' }}>
              {this.props.fallbackMessage || 'An error occurred while rendering this component.'}
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ 
                textAlign: 'left', 
                marginBottom: '20px',
                backgroundColor: '#1e1e2e',
                padding: '15px',
                borderRadius: '4px',
                color: '#e0e0e0'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                  Error Details
                </summary>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontSize: '12px',
                  color: '#ff6b6b'
                }}>
                  {this.state.error.toString()}
                </pre>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontSize: '11px',
                  color: '#808080',
                  marginTop: '10px'
                }}>
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              style={{
                backgroundColor: 'var(--accent-green, #4ade80)',
                color: '#1e1e2e',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
