import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { getPendingPayments } from '../api/billing.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function PendingPaymentsPage() {
  const { authenticatedRequest } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterBucket, setFilterBucket] = useState('all'); // 'all', '0-30', '30-60', '60+'

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPendingPayments(authenticatedRequest);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buckets = data?.agingBuckets || { bucket0_30: 0, bucket30_60: 0, bucket60Plus: 0, totalPending: 0 };
  const items = data?.items || [];

  const filteredItems = items.filter((inv) => {
    const days = inv.daysOverdue || 0;
    if (filterBucket === '0-30') return days < 30;
    if (filterBucket === '30-60') return days >= 30 && days < 60;
    if (filterBucket === '60+') return days >= 60;
    return true;
  });

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <PullToRefresh onRefresh={loadData}>
          <Header
            title="Aging & Pending Receivables"
            subtitle="Real-time cash flow monitoring segmented by 0–30, 30–60, and 60+ days aging buckets."
          />

          {error && <p className="form-error" style={{ marginBottom: 20 }}>{error}</p>}

          {/* ════════════════════════════════════════════════════════════════
              MOBILE AGING VIEW (<1024px)
          ════════════════════════════════════════════════════════════════ */}
          <div className="mobile-only-view">
            {/* Total Outstanding Hero Card */}
            <div
              className="mobile-card"
              style={{
                marginBottom: 12,
                background: '#FFFFFF',
                border: '1px solid var(--border-color)'
              }}
            >
              <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Pending Receivables
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: 2 }}>
                {formatCurrency(buckets.totalPending)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {items.length} unpaid invoices across all active clients
              </div>
            </div>

            {/* Aging Bucket Horizontal Filter Chips */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
              <button
                type="button"
                className={`mobile-chip ${filterBucket === 'all' ? 'active' : ''}`}
                onClick={() => setFilterBucket('all')}
                style={{ whiteSpace: 'nowrap', minHeight: 44, fontSize: '0.82rem', touchAction: 'manipulation' }}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                className={`mobile-chip ${filterBucket === '0-30' ? 'active' : ''}`}
                onClick={() => setFilterBucket('0-30')}
                style={{ whiteSpace: 'nowrap', minHeight: 44, fontSize: '0.82rem', touchAction: 'manipulation' }}
              >
                0–30d ({formatCurrency(buckets.bucket0_30)})
              </button>
              <button
                type="button"
                className={`mobile-chip ${filterBucket === '30-60' ? 'active' : ''}`}
                onClick={() => setFilterBucket('30-60')}
                style={{ whiteSpace: 'nowrap', minHeight: 44, fontSize: '0.82rem', touchAction: 'manipulation' }}
              >
                30–60d ({formatCurrency(buckets.bucket30_60)})
              </button>
              <button
                type="button"
                className={`mobile-chip ${filterBucket === '60+' ? 'active' : ''}`}
                onClick={() => setFilterBucket('60+')}
                style={{ whiteSpace: 'nowrap', minHeight: 44, fontSize: '0.82rem', color: filterBucket === '60+' ? '#FFFFFF' : '#DC2626', touchAction: 'manipulation' }}
              >
                60+d ({formatCurrency(buckets.bucket60Plus)})
              </button>
            </div>

            {/* Mobile Cards List */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="mobile-card" style={{ height: 85, opacity: 0.6, background: '#F8FAFC' }} />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 8px' }} />
                <p className="muted" style={{ margin: 0 }}>No pending invoices in this aging bucket.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredItems.map((inv) => {
                  const days = inv.daysOverdue || 0;
                  const is60 = days >= 60;
                  const is30 = days >= 30;

                  return (
                    <div key={inv.id} className="mobile-card">
                      <div className="mobile-card-top">
                        <div>
                          <div className="mobile-card-title">{inv.clientName}</div>
                          <div className="mobile-card-sub">
                            {inv.invoiceNumber} {inv.projectName ? `• ${inv.projectName}` : ''}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            className="mobile-card-amount"
                            style={{ color: is60 ? '#DC2626' : is30 ? '#D97706' : 'var(--brand-navy)' }}
                          >
                            {formatCurrency(inv.balanceDue)}
                          </div>
                          <span
                            className="badge"
                            style={{
                              marginTop: 2,
                              fontSize: '0.68rem',
                              background: is60 ? '#FEF2F2' : is30 ? '#FFFBEB' : '#EFF6FF',
                              color: is60 ? '#991B1B' : is30 ? '#92400E' : '#1E40AF'
                            }}
                          >
                            {is60 ? '60+ Days' : is30 ? '30–60 Days' : '0–30 Days'} ({days}d)
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card-bottom">
                        <span className="muted" style={{ fontSize: '0.72rem' }}>
                          Issued: {inv.invoiceDate}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: days > 0 ? '#DC2626' : '#475569', fontWeight: 700 }}>
                          Due: {inv.dueDate || 'On Receipt'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              DESKTOP VIEW (>=1024px) — 100% UNTOUCHED
          ════════════════════════════════════════════════════════════════ */}
          <div className="desktop-only-view">
            {/* 3 Aging Bucket Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon-wrap" style={{ background: '#EFF6FF', color: 'var(--brand-navy)' }}>
                  <Clock size={24} />
                </div>
                <div>
                  <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>0–30 Days (Current)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                    {formatCurrency(buckets.bucket0_30)}
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-wrap" style={{ background: '#FFFBEB', color: '#D97706' }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>30–60 Days (Attention)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706' }}>
                    {formatCurrency(buckets.bucket30_60)}
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-wrap" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  <AlertOctagon size={24} />
                </div>
                <div>
                  <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>60+ Days (Critical / Overdue)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626' }}>
                    {formatCurrency(buckets.bucket60Plus)}
                  </div>
                </div>
              </div>
            </div>

            <section className="panel">
              <div className="section-header">
                <h2 style={{ margin: 0 }}>Outstanding Client Invoices ({items.length})</h2>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                  Total Outstanding: {formatCurrency(buckets.totalPending)}
                </div>
              </div>

              {loading ? (
                <p className="muted" style={{ padding: 20 }}>Loading aging report...</p>
              ) : items.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={40} color="#059669" />
                  <p>No overdue receivables! All client invoices are settled.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Client</th>
                        <th>Invoice Date</th>
                        <th>Due Date</th>
                        <th style={{ textAlign: 'right' }}>Total Billed</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                        <th>Aging Bucket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((inv) => {
                        const days = inv.daysOverdue || 0;
                        const is60 = days >= 60;
                        const is30 = days >= 30;

                        return (
                          <tr key={inv.id}>
                            <td><strong>{inv.invoiceNumber}</strong></td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{inv.clientName}</div>
                              {inv.projectName && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{inv.projectName}</div>}
                            </td>
                            <td className="muted">{inv.invoiceDate}</td>
                            <td>
                              <span style={{ color: days > 0 ? '#DC2626' : '#475569', fontWeight: days > 0 ? 700 : 500 }}>
                                {inv.dueDate || '—'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(inv.totalAmount)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: is60 ? '#DC2626' : is30 ? '#D97706' : 'var(--brand-navy)' }}>
                              {formatCurrency(inv.balanceDue)}
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: is60 ? '#FEF2F2' : is30 ? '#FFFBEB' : '#EFF6FF',
                                  color: is60 ? '#991B1B' : is30 ? '#92400E' : '#1E40AF'
                                }}
                              >
                                {is60 ? '60+ Days' : is30 ? '30–60 Days' : '0–30 Days'} ({days}d)
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </PullToRefresh>
      </section>
    </main>
  );
}
