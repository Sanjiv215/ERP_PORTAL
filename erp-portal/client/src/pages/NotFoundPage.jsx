import { Link } from 'react-router-dom';
import { Home, ArrowLeft, HelpCircle } from 'lucide-react';

export function NotFoundPage() {
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
          borderRadius: 16,
          padding: 48,
          maxWidth: 500,
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)'
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#ECF8FA',
            color: '#19A2BF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}
        >
          <HelpCircle size={32} />
        </div>

        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#0F5394',
            display: 'block',
            marginBottom: 6
          }}
        >
          404 — Page Not Found
        </span>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px' }}>
          We couldn't find that page
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 28px' }}>
          The link you followed may be broken or the page may have been moved to another location.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.history.back()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <ArrowLeft size={16} /> Go Back
          </button>
          <Link
            to="/"
            className="primary-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <Home size={16} /> Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
