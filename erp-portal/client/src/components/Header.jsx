import { useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { ShieldCheck } from 'lucide-react';
import { MobileTopBar } from './MobileTopBar.jsx';

export function Header({ title, subtitle, showBack, onBack, rightAction, children }) {
  const { tenant } = useAuth();

  useEffect(() => {
    if (title) {
      document.title = `${title} — TheWoodWise`;
    }
  }, [title]);

  return (
    <>
      {/* Mobile Top App Bar (<1024px) */}
      <div className="mobile-only-header">
        <MobileTopBar
          title={title}
          subtitle={subtitle}
          showBack={showBack}
          onBack={onBack}
          rightAction={rightAction}
        />
      </div>

      {/* Desktop Top Bar (>=1024px) */}
      <header className="topbar desktop-only-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <h1>{title}</h1>
            {tenant?.businessName && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--brand-teal-dark)',
                  background: 'var(--brand-teal-light)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(25, 162, 191, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <ShieldCheck size={12} /> {tenant.businessName}
              </span>
            )}
          </div>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {children}
        </div>
      </header>
    </>
  );
}
