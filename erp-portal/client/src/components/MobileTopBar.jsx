import { useNavigate } from 'react-router-dom';
import { Menu, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNav } from '../state/NavContext.jsx';

export function MobileTopBar({ title, subtitle, showBack, onBack, rightAction }) {
  const navigate = useNavigate();
  const { tenant, user } = useAuth();
  const { openMobileNav } = useNav();

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }

  return (
    <header className="mobile-topbar" aria-label="Mobile application bar">
      <div className="mobile-topbar-left">
        {showBack ? (
          <button
            type="button"
            className="mobile-nav-btn"
            onClick={handleBack}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <button
            type="button"
            className="mobile-nav-btn"
            onClick={openMobileNav}
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>
        )}

        <div className="mobile-topbar-brand-wrap">
          <img src="/woodwise-logo.svg" alt="TheWoodWise" className="mobile-topbar-logo" />
          <div className="mobile-topbar-titles">
            <h1 className="mobile-topbar-title">{title || 'TheWoodWise'}</h1>
            {subtitle ? (
              <p className="mobile-topbar-subtitle">{subtitle}</p>
            ) : tenant?.businessName ? (
              <span className="mobile-topbar-tenant">
                <ShieldCheck size={11} /> {tenant.businessName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mobile-topbar-right">
        {rightAction || (
          <button
            type="button"
            className="mobile-topbar-avatar"
            onClick={openMobileNav}
            title={`${user?.name || 'User'} (${user?.role || 'Staff'})`}
            aria-label="Open user menu"
          >
            {user?.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
          </button>
        )}
      </div>
    </header>
  );
}
