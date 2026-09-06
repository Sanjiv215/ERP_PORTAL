import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Calendar,
  Filter,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Building2,
  User,
  ExternalLink,
  X,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Layers
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { listTransactions, downloadTransactionsReport } from '../api/transactions.js';
import { listProjects } from '../api/projects.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { BottomSheet } from '../components/BottomSheet.jsx';

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function TransactionsPage() {
  const { user, authenticatedRequest, accessToken } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedType, setSelectedType] = useState('all'); // all, client_payment, payroll, advance
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile BottomSheet
  const [inspectTx, setInspectTx] = useState(null);

  const isAdminOrAccountant = user?.role === 'TenantAdmin' || user?.role === 'Accountant';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, projList] = await Promise.all([
        listTransactions(authenticatedRequest, {
          type: selectedType !== 'all' ? selectedType : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          projectId: selectedProjectId || undefined
        }),
        listProjects(authenticatedRequest).catch(() => [])
      ]);

      setTransactions(txRes.transactions || []);
      setSummary(txRes.summary || {});
      setProjects(projList || []);
    } catch (err) {
      setError(err.message || 'Failed to load transaction history.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, selectedType, startDate, endDate, selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Date Presets
  function applyDatePreset(preset) {
    const now = new Date();
    if (preset === 'this_month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(s.toISOString().slice(0, 10));
      setEndDate(e.toISOString().slice(0, 10));
    } else if (preset === 'last_month') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(s.toISOString().slice(0, 10));
      setEndDate(e.toISOString().slice(0, 10));
    } else if (preset === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const s = new Date(now.getFullYear(), currentQuarter * 3, 1);
      const e = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
      setStartDate(s.toISOString().slice(0, 10));
      setEndDate(e.toISOString().slice(0, 10));
    } else if (preset === 'all_time') {
      setStartDate('');
      setEndDate('');
    }
  }

  async function handleExport(format) {
    setDownloading(true);
    try {
      await downloadTransactionsReport(accessToken, {
        type: selectedType !== 'all' ? selectedType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        projectId: selectedProjectId || undefined
      }, format);
    } catch (err) {
      alert(err.message || 'Failed to download report.');
    } finally {
      setDownloading(false);
    }
  }

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter((tx) => {
      const desc = (tx.description || '').toLowerCase();
      const party = (tx.partyName || '').toLowerCase();
      const proj = (tx.projectName || '').toLowerCase();
      const ref = (tx.reference || '').toLowerCase();
      const mode = (tx.paymentMode || '').toLowerCase();
      return desc.includes(q) || party.includes(q) || proj.includes(q) || ref.includes(q) || mode.includes(q);
    });
  }, [transactions, searchQuery]);

  function handleNavigateToSource(tx) {
    if (tx.type === 'payroll' && tx.relatedEntityId) {
      navigate(`/app/payroll`);
    } else if (tx.type === 'client_payment') {
      navigate(`/app/billing`);
    } else if (tx.type === 'advance') {
      navigate(`/app/advances`);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <Header
          title="Financial Transaction History"
          subtitle="Unified chronological feed of client invoice receipts, employee wage payouts, and salary advances."
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="secondary-button"
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={downloading}
              title="Download transaction statement as PDF"
            >
              <FileText size={16} /> {downloading ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => handleExport('excel')}
              disabled={downloading}
              title="Download transaction statement as Excel"
            >
              <FileSpreadsheet size={16} /> Excel
            </button>
          </div>
        </Header>

        {/* Top Financial Summary KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#065F46' }}>Total Inflow (Receipts)</span>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>
                +{formatCurrency(summary.totalInflow)}
              </div>
              <span className="muted" style={{ fontSize: '0.72rem' }}>{summary.inflowCount || 0} client payments</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <TrendingDown size={24} />
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#991B1B' }}>Total Outflow (Disbursements)</span>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#DC2626' }}>
                −{formatCurrency(summary.totalOutflow)}
              </div>
              <span className="muted" style={{ fontSize: '0.72rem' }}>{summary.outflowCount || 0} wage payouts & advances</span>
            </div>
          </div>

          <div className="stat-card">
            <div
              className="stat-icon-wrap"
              style={{
                background: (summary.netCashFlow || 0) >= 0 ? '#EFF6FF' : '#FFFBEB',
                color: (summary.netCashFlow || 0) >= 0 ? '#1E40AF' : '#D97706'
              }}
            >
              <Wallet size={24} />
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Net Cash Flow</span>
              <div
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: (summary.netCashFlow || 0) >= 0 ? '#1E40AF' : '#D97706'
                }}
              >
                {(summary.netCashFlow || 0) >= 0 ? '+' : ''}{formatCurrency(summary.netCashFlow)}
              </div>
              <span className="muted" style={{ fontSize: '0.72rem' }}>Filtered period balance</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Free Text Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 220, background: '#F8FAFC', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search description, party, reference..."
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.82rem' }}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Type Selector */}
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'client_payment', label: 'Client Payments' },
                  { id: 'payroll', label: 'Payroll' },
                  { id: 'advance', label: 'Advances' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    style={{
                      border: 'none',
                      background: selectedType === t.id ? '#FFFFFF' : 'transparent',
                      color: selectedType === t.id ? 'var(--brand-navy)' : '#64748B',
                      fontWeight: selectedType === t.id ? 700 : 500,
                      fontSize: '0.78rem',
                      padding: '5px 10px',
                      borderRadius: 6,
                      boxShadow: selectedType === t.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Project Filter */}
              {projects.length > 0 && (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '8px 12px', borderRadius: 8 }}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Date Range & Quick Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
              <span className="muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>Period:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => applyDatePreset('this_month')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', minHeight: 26 }}
                >
                  This Month
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => applyDatePreset('last_month')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', minHeight: 26 }}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => applyDatePreset('this_quarter')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', minHeight: 26 }}
                >
                  This Quarter
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => applyDatePreset('all_time')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', minHeight: 26 }}
                >
                  All Time
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ fontSize: '0.76rem', padding: '4px 6px', borderRadius: 6 }}
                />
                <span className="muted" style={{ fontSize: '0.72rem' }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ fontSize: '0.76rem', padding: '4px 6px', borderRadius: 6 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Feed (<1024px) */}
        <div className="mobile-only-view">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="mobile-card" style={{ height: 80, opacity: 0.6, background: '#F8FAFC' }} />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <ArrowLeftRight size={40} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
              <p className="muted" style={{ margin: 0 }}>No transactions found for the selected period.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredTransactions.map((tx) => {
                const isInflow = tx.direction === 'inflow';
                return (
                  <div
                    key={tx.id}
                    className="mobile-card"
                    onClick={() => setInspectTx(tx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="mobile-card-top">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: isInflow ? '#ECFDF5' : '#FEF2F2',
                            color: isInflow ? '#059669' : '#DC2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 2
                          }}
                        >
                          {isInflow ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>

                        <div>
                          <div className="mobile-card-title">{tx.partyName || tx.description}</div>
                          <div className="mobile-card-sub">
                            {formatDate(tx.transactionDate)} · {(tx.paymentMode || 'cash').toUpperCase()}
                          </div>
                          {tx.projectName && (
                            <div style={{ fontSize: '0.7rem', color: '#0F5394', fontWeight: 600, marginTop: 2 }}>
                              📁 {tx.projectName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div
                          className="mobile-card-amount"
                          style={{ color: isInflow ? '#059669' : '#DC2626' }}
                        >
                          {isInflow ? '+' : '−'}{formatCurrency(tx.amount)}
                        </div>
                        <span
                          className="badge"
                          style={{
                            marginTop: 4,
                            fontSize: '0.65rem',
                            background: tx.type === 'client_payment' ? '#ECFDF5' : tx.type === 'payroll' ? '#EFF6FF' : '#FFFBEB',
                            color: tx.type === 'client_payment' ? '#065F46' : tx.type === 'payroll' ? '#1E40AF' : '#92400E'
                          }}
                        >
                          {tx.type === 'client_payment' ? 'Client Inflow' : tx.type === 'payroll' ? 'Payroll Payout' : 'Staff Advance'}
                        </span>
                      </div>
                    </div>

                    <div className="mobile-card-bottom">
                      <span className="muted" style={{ fontSize: '0.72rem' }}>
                        {tx.description}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
                        View Details →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Feed (>=1024px) */}
        <div className="desktop-only-view">
          <section className="panel">
            {loading ? (
              <p className="muted" style={{ padding: 24 }}>Loading transaction timeline...</p>
            ) : filteredTransactions.length === 0 ? (
              <div className="empty-state">
                <ArrowLeftRight size={44} />
                <p>No transactions recorded matching the selected filter criteria.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Party / Entity</th>
                      <th>Description & Reference</th>
                      <th>Project</th>
                      <th>Payment Mode</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Source Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => {
                      const isInflow = tx.direction === 'inflow';
                      return (
                        <tr key={tx.id}>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                            {formatDate(tx.transactionDate)}
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: tx.type === 'client_payment' ? '#ECFDF5' : tx.type === 'payroll' ? '#EFF6FF' : '#FFFBEB',
                                color: tx.type === 'client_payment' ? '#065F46' : tx.type === 'payroll' ? '#1E40AF' : '#92400E',
                                fontWeight: 700,
                                fontSize: '0.74rem'
                              }}
                            >
                              {tx.type === 'client_payment' ? 'Client Payment' : tx.type === 'payroll' ? 'Payroll Payout' : 'Staff Advance'}
                            </span>
                          </td>
                          <td>
                            <strong>{tx.partyName || '—'}</strong>
                          </td>
                          <td style={{ maxWidth: 280 }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>{tx.description}</div>
                            {tx.reference && (
                              <div className="muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                                Ref: {tx.reference}
                              </div>
                            )}
                          </td>
                          <td>
                            {tx.projectName ? (
                              <span style={{ fontSize: '0.78rem', color: '#0F5394', fontWeight: 600 }}>
                                {tx.projectName}
                              </span>
                            ) : (
                              <span className="muted" style={{ fontSize: '0.74rem' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className="badge" style={{ background: '#F1F5F9', color: '#334155', textTransform: 'capitalize' }}>
                              {tx.paymentMode || 'cash'}
                            </span>
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              color: isInflow ? '#059669' : '#DC2626',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isInflow ? '+' : '−'}{formatCurrency(tx.amount)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => handleNavigateToSource(tx)}
                              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                              title="Open original transaction source record"
                            >
                              <ExternalLink size={12} /> Open
                            </button>
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
      </section>

      {/* Mobile Transaction Detail Bottom Sheet */}
      <BottomSheet
        isOpen={Boolean(inspectTx)}
        onClose={() => setInspectTx(null)}
        title={inspectTx ? `Transaction — ${inspectTx.description}` : 'Transaction Detail'}
      >
        {inspectTx && (
          <div>
            <div className="mobile-user-card" style={{ marginBottom: 16 }}>
              <div
                className="mobile-user-avatar"
                style={{
                  background: inspectTx.direction === 'inflow' ? '#ECFDF5' : '#FEF2F2',
                  color: inspectTx.direction === 'inflow' ? '#059669' : '#DC2626'
                }}
              >
                {inspectTx.direction === 'inflow' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mobile-user-name">{inspectTx.partyName || inspectTx.description}</div>
                <div className="mobile-user-sub">
                  {formatDate(inspectTx.transactionDate)} · {(inspectTx.paymentMode || 'cash').toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    color: inspectTx.direction === 'inflow' ? '#059669' : '#DC2626',
                    marginTop: 4
                  }}
                >
                  {inspectTx.direction === 'inflow' ? '+' : '−'}{formatCurrency(inspectTx.amount)}
                </div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem' }}>
                <span className="muted">Type:</span>
                <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{inspectTx.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem' }}>
                <span className="muted">Payment Mode:</span>
                <strong style={{ textTransform: 'capitalize' }}>{inspectTx.paymentMode || 'cash'}</strong>
              </div>
              {inspectTx.projectName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem' }}>
                  <span className="muted">Project:</span>
                  <strong>{inspectTx.projectName}</strong>
                </div>
              )}
              {inspectTx.reference && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem' }}>
                  <span className="muted">Reference:</span>
                  <strong>{inspectTx.reference}</strong>
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong>Details:</strong> {inspectTx.description}
              </div>
            </div>

            <button
              type="button"
              className="primary-button"
              style={{ width: '100%', minHeight: 44 }}
              onClick={() => {
                const tx = inspectTx;
                setInspectTx(null);
                handleNavigateToSource(tx);
              }}
            >
              <ExternalLink size={16} /> Open Source Record
            </button>
          </div>
        )}
      </BottomSheet>
    </main>
  );
}
