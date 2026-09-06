import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { isDemoMode, DEMO_CREDENTIALS } from '../api/demo/demoMode.js';

export function LoginPage() {
  const { login, isAuthenticated, bootstrapping } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const demoActive = isDemoMode();

  useEffect(() => {
    document.title = 'Sign In — ERP Portal';
  }, []);

  function handleAutoFillDemo() {
    setForm({
      email: DEMO_CREDENTIALS.email,
      password: DEMO_CREDENTIALS.password
    });
    setError('');
  }

  async function handleInstantDemoLogin() {
    setError('');
    setSubmitting(true);
    try {
      await login({
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password
      });
      navigate(location.state?.from?.pathname || '/app/dashboard', { replace: true });
    } catch (apiError) {
      setError(apiError.message || 'Failed to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

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
            src="/erp-icon.svg"
            alt="ERP Portal Logo"
            className="auth-brand-logo"
            width="72"
            height="72"
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-main)' }}>
            Sign in to ERP Portal
          </h1>
          <p className="muted">Enter your credentials to access your workspace.</p>
        </div>

        {demoActive && (
          <div
            style={{
              background: 'linear-gradient(135deg, #ECF8FA 0%, #EFF6FF 100%)',
              border: '1px solid #BAE6FD',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 20,
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={18} style={{ color: 'var(--brand-teal-dark)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--brand-navy-dark)' }}>
                Public Frontend Demo Access
              </strong>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 12 }}>
              <div>
                <strong>Email:</strong>{' '}
                <code style={{ background: '#FFFFFF', padding: '2px 6px', borderRadius: 4, border: '1px solid #CBD5E1' }}>
                  {DEMO_CREDENTIALS.email}
                </code>
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Password:</strong>{' '}
                <code style={{ background: '#FFFFFF', padding: '2px 6px', borderRadius: 4, border: '1px solid #CBD5E1' }}>
                  {DEMO_CREDENTIALS.password}
                </code>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleInstantDemoLogin}
                disabled={submitting}
                className="secondary-button"
                style={{
                  flex: 1,
                  minHeight: 38,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  background: '#FFFFFF',
                  borderColor: 'var(--brand-teal)',
                  color: 'var(--brand-teal-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Sparkles size={14} /> 1-Click Demo Login
              </button>
              <button
                type="button"
                onClick={handleAutoFillDemo}
                className="secondary-button"
                style={{
                  minHeight: 38,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  background: '#FFFFFF'
                }}
                title="Auto-fill inputs"
              >
                Auto-fill
              </button>
            </div>
          </div>
        )}

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

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20, marginTop: 24, textAlign: 'center', fontSize: '0.88rem' }}>
          <p className="muted">
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: 'var(--brand-navy)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Sign up <ArrowRight size={14} />
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
