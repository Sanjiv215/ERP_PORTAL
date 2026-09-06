import {
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
  ArrowRight,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';

export function DashboardPage() {
  const { user, tenant } = useAuth();

  const moduleCards = [
    {
      to: '/app/attendance',
      title: 'Daily Attendance',
      desc: 'Mark daily attendance grid, bulk overrides, and calculate day units.',
      icon: CalendarCheck,
      color: '#0E7490',
      bg: '#ECF8FA',
      badge: 'Active Grid'
    },
    {
      to: '/app/payroll',
      title: 'Salary & Payroll',
      desc: 'Monthly wage calculations, advance adjustments, and branded payslips.',
      icon: Wallet,
      color: '#0F5394',
      bg: '#EFF6FF',
      badge: 'Automated'
    },
    {
      to: '/app/pl',
      title: 'Profit & Loss',
      desc: 'Business-wide rollup, project margins, and automated labor costing.',
      icon: TrendingUp,
      color: '#059669',
      bg: '#ECFDF5',
      badge: 'Live Margins'
    },
    {
      to: '/app/quotations',
      title: 'Quotations',
      desc: 'Itemized cost estimates with GST and 1-click conversion to invoices.',
      icon: FileSpreadsheet,
      color: '#7C3AED',
      bg: '#F5F3FF',
      badge: 'GST Enabled'
    },
    {
      to: '/app/invoices',
      title: 'Invoices & Billing',
      desc: 'Track receivables, issue branded PDF invoices, and auto-sync P&L.',
      icon: Receipt,
      color: '#D97706',
      bg: '#FFFBEB',
      badge: 'Manual Payments'
    },
    {
      to: '/app/pending-payments',
      title: 'Aging & Receivables',
      desc: 'Aging buckets (0–30, 30–60, 60+ days) with overdue balance alerts.',
      icon: Clock,
      color: '#DC2626',
      bg: '#FEF2F2',
      badge: 'Aging Buckets'
    },
    {
      to: '/app/meetings',
      title: 'Meetings & Site Reviews',
      desc: 'Schedule site walk-throughs, stakeholder invites, and safety minutes.',
      icon: Video,
      color: '#0284C7',
      bg: '#F0F9FF',
      badge: 'Minutes Logger'
    },
    {
      to: '/app/employees',
      title: 'Employees & Wages',
      desc: 'Staff roster with AES-256 encrypted bank details and wage rates.',
      icon: Users,
      color: '#4F46E5',
      bg: '#EEF2FF',
      badge: 'AES Encrypted'
    },
    {
      to: '/app/projects',
      title: 'Projects & Sites',
      desc: 'Active construction sites, timelines, and employee allocations.',
      icon: Building2,
      color: '#DB2777',
      bg: '#FDF2F8',
      badge: 'Site Tracker'
    }
  ];

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <Header
          title="Dashboard"
          subtitle="Enterprise operations, workforce management, and financial health."
        >
          <Link to="/app/quotations" className="secondary-button" style={{ textDecoration: 'none' }}>
            <Plus size={16} /> New Quote
          </Link>
          <Link to="/app/attendance" className="primary-button" style={{ textDecoration: 'none' }}>
            <CalendarCheck size={16} /> Mark Attendance
          </Link>
        </Header>

        {/* ════════════════════════════════════════════════════════════════
            MOBILE DASHBOARD VIEW (<1024px)
        ════════════════════════════════════════════════════════════════ */}
        <div className="mobile-only-view">
          {/* Mobile Welcome Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #09223D 0%, #0F5394 100%)',
              borderRadius: 14,
              padding: '16px 18px',
              color: '#FFFFFF',
              marginBottom: 16,
              boxShadow: '0 4px 12px rgba(15, 83, 148, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(25, 162, 191, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-teal)'
                }}
              >
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {user?.name}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  {tenant?.businessName || 'ERP Portal'} · {user?.role}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#CBD5E1', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
              {tenant?.gstNumber ? `GSTIN: ${tenant.gstNumber}` : 'Workforce & Site Operations Active'}
            </div>
          </div>

          {/* Quick 1-Tap Action Buttons */}
          <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text-main)' }}>
            Quick Actions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <Link
              to="/app/attendance"
              style={{
                textDecoration: 'none',
                background: '#ECF8FA',
                color: '#0E7490',
                padding: '12px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: '0.8rem',
                minHeight: 44
              }}
            >
              <CalendarCheck size={18} /> Mark Attendance
            </Link>

            <Link
              to="/app/payroll"
              style={{
                textDecoration: 'none',
                background: '#EFF6FF',
                color: '#0F5394',
                padding: '12px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: '0.8rem',
                minHeight: 44
              }}
            >
              <Wallet size={18} /> Run Payroll
            </Link>

            <Link
              to="/app/quotations"
              style={{
                textDecoration: 'none',
                background: '#F5F3FF',
                color: '#7C3AED',
                padding: '12px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: '0.8rem',
                minHeight: 44
              }}
            >
              <FileSpreadsheet size={18} /> New Quote
            </Link>

            <Link
              to="/app/invoices"
              style={{
                textDecoration: 'none',
                background: '#FFFBEB',
                color: '#D97706',
                padding: '12px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: '0.8rem',
                minHeight: 44
              }}
            >
              <Receipt size={18} /> Invoices & Billing
            </Link>
          </div>

          {/* Mobile Modules List */}
          <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text-main)' }}>
            All Operations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {moduleCards.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.to}
                  to={m.to}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    className="mobile-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px'
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: m.bg,
                        color: m.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={20} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {m.title}
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: m.color,
                            background: m.bg,
                            padding: '2px 6px',
                            borderRadius: 4
                          }}
                        >
                          {m.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                        {m.desc}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            DESKTOP DASHBOARD VIEW (>=1024px) — 100% UNTOUCHED
        ════════════════════════════════════════════════════════════════ */}
        <div className="desktop-only-view">
          {/* Security & Organization Status Card */}
          <section
            style={{
              background: 'linear-gradient(135deg, #09223D 0%, #0F5394 100%)',
              borderRadius: 14,
              padding: '24px 28px',
              color: '#FFFFFF',
              marginBottom: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
              boxShadow: '0 10px 20px -5px rgba(15, 83, 148, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(25, 162, 191, 0.25)',
                  border: '1px solid rgba(25, 162, 191, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-teal)'
                }}
              >
                <ShieldCheck size={26} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Welcome back, {user?.name}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#CBD5E1' }}>
                  Role: <strong style={{ color: '#FFFFFF' }}>{user?.role}</strong> · Workspace: <strong style={{ color: 'var(--brand-teal)' }}>{tenant?.businessName || 'ERP Portal'}</strong>. Tenant isolation active.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {tenant?.gstNumber && (
                <span style={{ fontSize: '0.78rem', background: 'rgba(255, 255, 255, 0.1)', padding: '6px 12px', borderRadius: 8 }}>
                  GSTIN: {tenant.gstNumber}
                </span>
              )}
            </div>
          </section>

          {/* Operational Modules Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {moduleCards.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.to}
                  to={m.to}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                >
                  <div
                    className="panel"
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 14,
                      padding: 22,
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: m.bg,
                            color: m.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Icon size={22} />
                        </div>

                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: m.color,
                            background: m.bg,
                            padding: '3px 8px',
                            borderRadius: 6
                          }}
                        >
                          {m.badge}
                        </span>
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {m.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {m.desc}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: 'var(--brand-navy)',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: 12,
                        marginTop: 4
                      }}
                    >
                      <span>Open Module</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
