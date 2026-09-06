import React from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F8FAFC',
            padding: 24,
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: 40,
              maxWidth: 480,
              textAlign: 'center',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)'
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}
            >
              <AlertOctagon size={28} />
            </div>

            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#64748B', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 24px' }}>
              An unexpected error occurred in the interface. Your data and tenant context remain completely safe.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => window.location.reload()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <RotateCcw size={16} /> Reload Application
              </button>
              <a
                href="/"
                className="primary-button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
              >
                <Home size={16} /> Back to Home
              </a>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
