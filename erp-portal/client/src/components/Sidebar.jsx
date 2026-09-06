import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  Wallet,
  TrendingUp,
  FileSpreadsheet,
  Receipt,
  FileText,
  Clock,
  Video,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  X,
  HandCoins,
  ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNav } from '../state/NavContext.jsx';

export function Sidebar() {
  const { user, tenant, logout } = useAuth();
  const { isMobileNavOpen, closeMobileNav } = useNav();
  const location = useLocation();

  const links = [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/app/employees', label: 'Employees', icon: Users, roles: ['TenantAdmin', 'Manager', 'Accountant'] },
    { to: '/app/projects', label: 'Projects & Sites', icon: Building2 },
    { to: '/app/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['TenantAdmin', 'Manager', 'Accountant'] },
    { to: '/app/payroll', label: 'Salary & Payroll', icon: Wallet, roles: ['TenantAdmin', 'Accountant'] },
    { to: '/app/advances', label: 'All Advances', icon: HandCoins, roles: ['TenantAdmin', 'Accountant', 'Manager'] },
    { to: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight, roles: ['TenantAdmin', 'Accountant', 'Manager'] },
    { to: '/app/pl', label: 'Profit & Loss', icon: TrendingUp, roles: ['TenantAdmin', 'Accountant', 'Manager'] },
    { to: '/app/quotations', label: 'Quotations', icon: FileSpreadsheet, roles: ['TenantAdmin', 'Accountant', 'Manager'] },
    { to: '/app/invoices', label: 'Invoices', icon: Receipt, roles: ['TenantAdmin', 'Accountant', 'Manager'] },
    { to: '/app/bills', label: 'Vendor Bills', icon: FileText, roles: ['TenantAdmin', 'Accountant', 'Manager'] },
    { to: '/app/pending-payments', label: 'Aging & Receivables', icon: Clock, roles: ['TenantAdmin', 'Accountant'] },
    { to: '/app/meetings', label: 'Meetings', icon: Video }
  ];

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          DESKTOP PERMANENT SIDEBAR (>=1024px) — 100% UNTOUCHED
      ════════════════════════════════════════════════════════════════ */}
      <aside className="sidebar desktop-only-sidebar">
        <div>
          <Link to="/app/dashboard" className="brand-header" style={{ textDecoration: 'none' }}>
            <img src="/erp-icon.svg" alt="ERP Portal Logo" className="brand-logo-img" />
            <div style={{ overflow: 'hidden' }}>
              <h2 className="brand-title">ERP Portal</h2>
              <p className="brand-workspace">{tenant?.businessName || 'Workspace'}</p>
            </div>
          </Link>

          <nav>
            {links
              .filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)))
              .map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={isActive ? 'active' : ''}
                  >
                    <Icon size={18} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {isActive && <ChevronRight size={14} style={{ opacity: 0.7 }} />}
                  </Link>
                );
              })}

            {user?.role === 'TenantAdmin' && (
              <Link
                to="/app/settings"
                className={location.pathname === '/app/settings' ? 'active' : ''}
              >
                <Settings size={18} />
                <span>Workspace Settings</span>
              </Link>
            )}

            {user?.role === 'PlatformSuperAdmin' && (
              <Link
                to="/superadmin/tenants"
                className={location.pathname === '/superadmin/tenants' ? 'active' : ''}
              >
                <Shield size={18} />
                <span>Platform Tenants</span>
              </Link>
            )}
          </nav>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--brand-teal)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                flexShrink: 0
              }}
            >
              {user?.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{user?.role}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Sign out"
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════
          MOBILE OVERLAY DRAWER (<1024px)
          Slides in from the left over page content with a dark backdrop
      ════════════════════════════════════════════════════════════════ */}
      <div
        className={`mobile-drawer-overlay ${isMobileNavOpen ? 'open' : ''}`}
        aria-hidden={!isMobileNavOpen}
      >
        <div
          className="mobile-drawer-backdrop"
          onClick={closeMobileNav}
        />

        <aside
          className="mobile-drawer-panel"
          onClick={(e) => e.stopPropagation()}
          aria-label="Mobile navigation drawer"
        >
          <div className="mobile-drawer-header">
            <Link
              to="/app/dashboard"
              className="brand-header"
              onClick={closeMobileNav}
              style={{ margin: 0, textDecoration: 'none', gap: 10 }}
            >
              <img src="/erp-icon.svg" alt="ERP Portal Logo" className="brand-logo-img" style={{ width: 36, height: 36 }} />
              <div style={{ overflow: 'hidden' }}>
                <h2 className="brand-title" style={{ fontSize: '1.15rem' }}>ERP Portal</h2>
                <p className="brand-workspace">{tenant?.businessName || 'Workspace'}</p>
              </div>
            </Link>

            <button
              type="button"
              className="mobile-drawer-close-btn"
              onClick={closeMobileNav}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="mobile-drawer-nav">
            {links
              .filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)))
              .map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={isActive ? 'active' : ''}
                    onClick={closeMobileNav}
                  >
                    <Icon size={19} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {isActive && <ChevronRight size={14} style={{ opacity: 0.7 }} />}
                  </Link>
                );
              })}

            {user?.role === 'TenantAdmin' && (
              <Link
                to="/app/settings"
                className={location.pathname === '/app/settings' ? 'active' : ''}
                onClick={closeMobileNav}
              >
                <Settings size={19} />
                <span>Workspace Settings</span>
              </Link>
            )}

            {user?.role === 'PlatformSuperAdmin' && (
              <Link
                to="/superadmin/tenants"
                className={location.pathname === '/superadmin/tenants' ? 'active' : ''}
                onClick={closeMobileNav}
              >
                <Shield size={19} />
                <span>Platform Tenants</span>
              </Link>
            )}
          </nav>

          <div className="mobile-drawer-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--brand-teal)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  flexShrink: 0
                }}
              >
                {user?.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{user?.role}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                closeMobileNav();
                logout();
              }}
              title="Sign out"
              className="mobile-drawer-logout-btn"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
