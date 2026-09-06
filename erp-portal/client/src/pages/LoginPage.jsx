import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';

export function LoginPage() {
  const { login, isAuthenticated, bootstrapping } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = 'Sign In — TheWoodWise';
  }, []);

  if (bootstrapping) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <img
            src="/woodwise-logo.svg"
            alt="TheWoodWise Logo"
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
              Checking session...
            </span>
          </div>
        </section>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname || '/app/dashboard'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(form);
      navigate(location.state?.from?.pathname || '/app/dashboard', { replace: true });
    } catch (apiError) {
      setError(apiError.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/woodwise-logo.svg"
            alt="TheWoodWise Logo"
            className="auth-brand-logo"
            width="72"
            height="72"
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-main)' }}>
            Sign in to TheWoodWise
          </h1>
          <p className="muted">Enter your credentials to access your workspace.</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          {error && <p className="form-error" role="alert">{error}</p>}

          <label>
            Email Address
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </div>
          </label>

          <label>
            Password
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </div>
          </label>

          <button className="primary-button" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
            <LogIn size={16} />
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}
