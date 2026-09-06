import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';

export function SignupPage() {
  const { signup, isAuthenticated, bootstrapping } = useAuth();
  const [form, setForm] = useState({
    businessName: '',
    gstNumber: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: true
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Sign Up — ERP Portal';
  }, []);

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
    return <Navigate to="/app/dashboard" replace />;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await signup(form);
      navigate('/app/dashboard', { replace: true });
    } catch (apiError) {
      setError(apiError.message || 'Failed to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel wide">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/erp-icon.svg"
            alt="ERP Portal Logo"
            className="auth-brand-logo"
            width="72"
            height="72"
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-main)' }}>
            Create your ERP Portal Workspace
          </h1>
          <p className="muted">Set up an isolated enterprise workspace and administrator account.</p>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          {error && <p className="form-error full-width" role="alert">{error}</p>}

          <label>
            Workspace / Company Name
            <input
              value={form.businessName}
              onChange={(event) => updateField('businessName', event.target.value)}
              placeholder="e.g. Acme Enterprises"
              required
              minLength={2}
            />
          </label>

          <label>
            GSTIN / Tax ID (Optional)
            <input
              value={form.gstNumber}
              onChange={(event) => updateField('gstNumber', event.target.value)}
              placeholder="22AAAAA0000A1Z5"
            />
          </label>

          <label>
            Full Name
            <input
              autoComplete="name"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="John Doe"
              required
              minLength={2}
            />
          </label>

          <label>
            Phone Number (Optional)
            <input
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              placeholder="+91 98765 43210"
            />
          </label>

          <label className="full-width">
            Work Email Address
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="admin@example.com"
              required
            />
          </label>

          <label>
            Password (min 8 characters)
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder="••••••••••••"
              required
              minLength={8}
            />
          </label>

          <label>
            Confirm Password
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              placeholder="••••••••••••"
              required
              minLength={8}
            />
          </label>

          <div className="full-width" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
            <input
              type="checkbox"
              id="acceptedTerms"
              checked={form.acceptedTerms}
              onChange={(event) => updateField('acceptedTerms', event.target.checked)}
              required
              style={{ minHeight: 'auto', width: 'auto' }}
            />
            <label htmlFor="acceptedTerms" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>
              I accept the Terms of Service and Privacy Policy.
            </label>
          </div>

          <button className="primary-button full-width" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
            <Building2 size={16} />
            {submitting ? 'Creating Workspace...' : 'Create ERP Portal Workspace'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20, marginTop: 24, textAlign: 'center', fontSize: '0.88rem' }}>
          <p className="muted">
            Already have a workspace?{' '}
            <Link to="/login" style={{ color: 'var(--brand-navy)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Sign in <ArrowRight size={14} />
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
