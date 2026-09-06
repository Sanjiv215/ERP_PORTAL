import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { bootstrapping, isAuthenticated } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <img
            src="/erp-icon.svg"
            alt="ERP Portal Logo"
            className="auth-brand-logo"
            width="64"
            height="64"
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
            <div
              className="pull-to-refresh-spinner spinning"
              style={{
                width: 18,
                height: 18,
                border: '2px solid #CBD5E1',
                borderTopColor: 'var(--brand-navy)',
                borderRadius: '50%'
              }}
            />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Restoring session...
            </span>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
