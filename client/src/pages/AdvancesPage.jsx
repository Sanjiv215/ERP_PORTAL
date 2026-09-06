import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HandCoins,
  Plus,
  Filter,
  Calendar,
  User,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  X,
  ChevronRight,
  RefreshCw,
  Wallet,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { listAllAdvances, listEmployees, recordEmployeeAdvance, removeEmployeeAdvance } from '../api/employees.js';
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

function GiveAdvanceModal({ employees, onClose, onSaved, authenticatedRequest }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!employeeId) {
      setError('Please select an employee.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordEmployeeAdvance(authenticatedRequest, employeeId, {
        amount: parseFloat(amount),
        advanceDate,
        notes,
        paymentMode
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to issue advance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#EFF6FF', color: 'var(--brand-navy)', padding: 8, borderRadius: 8 }}>
              <HandCoins size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Issue Staff Advance</h3>
              <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 0' }}>
                Record an advance payment to be deducted in payroll
              </p>
            </div>
          </div>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              {error && <p className="form-error">{error}</p>}

              <label>
                Employee <span style={{ color: '#DC2626' }}>*</span>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.wage_type || emp.wageType || 'daily'} · ₹{emp.wage_rate || emp.wageRate}/day)
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Amount (₹) <span style={{ color: '#DC2626' }}>*</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 2000"
                    required
                  />
                </label>

                <label>
                  Disbursement Date <span style={{ color: '#DC2626' }}>*</span>
                  <input
                    type="date"
                    value={advanceDate}
                    onChange={(e) => setAdvanceDate(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label>
                Payment Mode
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / Online Transfer</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>

              <label>
                Notes / Reason
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Medical emergency, Festival advance"
                  maxLength={255}
                />
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Recording...' : 'Issue Advance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdvancesPage() {
  const { user, authenticatedRequest } = useAuth();
  const navigate = useNavigate();

  const [advances, setAdvances] = useState([]);
  const [summary, setSummary] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, unadjusted, adjusted, cancelled
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals & BottomSheets
  const [showGiveModal, setShowGiveModal] = useState(false);
  const [inspectAdvance, setInspectAdvance] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = user?.role === 'TenantAdmin' || user?.role === 'Accountant';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [advancesRes, empList] = await Promise.all([
        listAllAdvances(authenticatedRequest, {
          employeeId: selectedEmployeeId || undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }),
        listEmployees(authenticatedRequest)
      ]);

      setAdvances(advancesRes.advances || []);
      setSummary(advancesRes.summary || {});
      setEmployees(empList || []);
    } catch (err) {
      setError(err.message || 'Failed to load advances ledger.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, selectedEmployeeId, selectedStatus, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAdvances = useMemo(() => {
    if (!searchQuery.trim()) return advances;
    const q = searchQuery.toLowerCase();
    return advances.filter((adv) => {
      const name = (adv.employee_name || adv.employeeName || '').toLowerCase();
      const notes = (adv.notes || '').toLowerCase();
      const mode = (adv.payment_mode || adv.paymentMode || '').toLowerCase();
      return name.includes(q) || notes.includes(q) || mode.includes(q);
    });
  }, [advances, searchQuery]);

  async function handleCancelAdvance(advance) {
    if (!window.confirm(`Are you sure you want to cancel the advance of ${formatCurrency(advance.amount)} for ${advance.employee_name || advance.employeeName}?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await removeEmployeeAdvance(authenticatedRequest, advance.employee_id || advance.employeeId, advance.id);
      setInspectAdvance(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to cancel advance.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <Header
          title="Staff Advance Master Ledger"
          subtitle="Track, issue, and manage all employee salary advances and adjustments across the organization."
        >
          {isAdmin && (
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowGiveModal(true)}
            >
              <Plus size={16} /> Issue Advance
            </button>
          )}
        </Header>

        {/* Top Summary KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#EFF6FF', color: 'var(--brand-navy)' }}>
              <HandCoins size={24} />
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Issued (All-Time)</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                {formatCurrency(summary.totalAmount)}
              </div>
              <span className="muted" style={{ fontSize: '0.72rem' }}>{summary.totalCount || 0} advances recorded</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#FFFBEB', color: '#D97706' }}>
              <Clock size={24} />
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#92400E' }}>Outstanding (Unadjusted)</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706' }}>
                {formatCurrency(summary.unadjustedAmount)}
              </div>
              <span className="muted" style={{ fontSize: '0.72rem' }}>{summary.unadjustedCount || 0} pending recovery</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#065F46' }}>Adjusted in Payroll</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
                {formatCurrency(summary.adjustedAmount)}
              </div>
              <span className="muted" style={{ fontSize: '0.72rem' }}>{summary.adjustedCount || 0} recovered in payslips</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200, background: '#F8FAFC', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff, notes, payment mode..."
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.82rem' }}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Employee Filter */}
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '8px 12px', borderRadius: 8 }}
            >
              <option value="">All Staff Members</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
              {['all', 'unadjusted', 'adjusted', 'cancelled'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  style={{
                    border: 'none',
                    background: selectedStatus === st ? '#FFFFFF' : 'transparent',
                    color: selectedStatus === st ? 'var(--brand-navy)' : '#64748B',
                    fontWeight: selectedStatus === st ? 700 : 500,
                    fontSize: '0.78rem',
                    padding: '5px 10px',
                    borderRadius: 6,
                    boxShadow: selectedStatus === st ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ fontSize: '0.78rem', padding: '6px 8px', borderRadius: 8 }}
                title="From date"
              />
              <span className="muted" style={{ fontSize: '0.75rem' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ fontSize: '0.78rem', padding: '6px 8px', borderRadius: 8 }}
                title="To date"
              />
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className="mobile-only-view">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="mobile-card" style={{ height: 80, opacity: 0.6, background: '#F8FAFC' }} />
              ))}
            </div>
          ) : filteredAdvances.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <HandCoins size={40} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
              <p className="muted" style={{ margin: 0 }}>No advance records match your criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredAdvances.map((adv) => (
                <div
                  key={adv.id}
                  className="mobile-card"
                  onClick={() => setInspectAdvance(adv)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="mobile-card-top">
                    <div>
                      <div className="mobile-card-title">{adv.employee_name || adv.employeeName}</div>
                      <div className="mobile-card-sub">
                        {formatDate(adv.advance_date || adv.advanceDate)} · {(adv.payment_mode || adv.paymentMode || 'cash').toUpperCase()}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="mobile-card-amount" style={{ color: '#DC2626' }}>
                        {formatCurrency(adv.amount)}
                      </div>
                      <span
                        className="badge"
                        style={{
                          marginTop: 4,
                          fontSize: '0.68rem',
                          background: adv.status === 'adjusted' ? '#ECFDF5' : adv.status === 'cancelled' ? '#F1F5F9' : '#FFFBEB',
                          color: adv.status === 'adjusted' ? '#065F46' : adv.status === 'cancelled' ? '#64748B' : '#92400E'
                        }}
                      >
                        {adv.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {adv.notes && (
                    <div className="mobile-card-bottom">
                      <span className="muted" style={{ fontSize: '0.74rem' }}>
                        {adv.notes}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
                        Details →
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop View */}
        <div className="desktop-only-view">
          <section className="panel">
            {loading ? (
              <p className="muted" style={{ padding: 24 }}>Loading advances ledger...</p>
            ) : filteredAdvances.length === 0 ? (
              <div className="empty-state">
                <HandCoins size={44} />
                <p>No staff advances found for the selected filters.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Date Given</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Payment Mode</th>
                      <th>Notes / Purpose</th>
                      <th>Status</th>
                      <th>Payroll Link</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdvances.map((adv) => (
                      <tr key={adv.id}>
                        <td>
                          <strong>{adv.employee_name || adv.employeeName}</strong>
                        </td>
                        <td className="muted">{formatDate(adv.advance_date || adv.advanceDate)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#DC2626' }}>
                          {formatCurrency(adv.amount)}
                        </td>
                        <td>
                          <span className="badge" style={{ background: '#F1F5F9', color: '#334155', textTransform: 'capitalize' }}>
                            {adv.payment_mode || adv.paymentMode || 'cash'}
                          </span>
                        </td>
                        <td style={{ maxWidth: 220, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {adv.notes || '—'}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: adv.status === 'adjusted' ? '#ECFDF5' : adv.status === 'cancelled' ? '#F1F5F9' : '#FFFBEB',
                              color: adv.status === 'adjusted' ? '#065F46' : adv.status === 'cancelled' ? '#64748B' : '#92400E',
                              fontWeight: 700
                            }}
                          >
                            <span
                              className="badge-dot"
                              style={{
                                background: adv.status === 'adjusted' ? '#10B981' : adv.status === 'cancelled' ? '#94A3B8' : '#F59E0B'
                              }}
                            />
                            {adv.status}
                          </span>
                        </td>
                        <td>
                          {adv.payroll_run_id || adv.payrollRunId ? (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => navigate(`/app/payroll`)}
                              style={{ fontSize: '0.74rem', padding: '2px 8px' }}
                            >
                              Run View →
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.74rem' }}>Unlinked</span>
                          )}
                        </td>
                        <td>
                          <div className="action-row">
                            {adv.status === 'unadjusted' && isAdmin && (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleCancelAdvance(adv)}
                                disabled={actionLoading}
                                style={{ color: '#DC2626', fontSize: '0.74rem', padding: '3px 8px' }}
                                title="Cancel and remove this advance"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </section>

      {showGiveModal && (
        <GiveAdvanceModal
          employees={employees}
          onClose={() => setShowGiveModal(false)}
          onSaved={async () => {
            setShowGiveModal(false);
            await loadData();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}

      <BottomSheet
        isOpen={Boolean(inspectAdvance)}
        onClose={() => setInspectAdvance(null)}
        title={inspectAdvance ? `Advance — ${inspectAdvance.employee_name || inspectAdvance.employeeName}` : 'Advance Detail'}
      >
        {inspectAdvance && (
          <div>
            <div className="mobile-user-card" style={{ marginBottom: 16 }}>
              <div className="mobile-user-avatar">
                {(inspectAdvance.employee_name || inspectAdvance.employeeName || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mobile-user-name">{inspectAdvance.employee_name || inspectAdvance.employeeName}</div>
                <div className="mobile-user-sub">
                  Given on {formatDate(inspectAdvance.advance_date || inspectAdvance.advanceDate)} · {(inspectAdvance.payment_mode || inspectAdvance.paymentMode || 'cash').toUpperCase()}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#DC2626', marginTop: 4 }}>
                  {formatCurrency(inspectAdvance.amount)}
                </div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem' }}>
                <span className="muted">Status:</span>
                <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{inspectAdvance.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem' }}>
                <span className="muted">Payment Mode:</span>
                <strong style={{ textTransform: 'capitalize' }}>{inspectAdvance.payment_mode || inspectAdvance.paymentMode || 'cash'}</strong>
              </div>
              {inspectAdvance.notes && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <strong>Notes:</strong> {inspectAdvance.notes}
                </div>
              )}
            </div>

            {inspectAdvance.status === 'unadjusted' && isAdmin && (
              <button
                type="button"
                className="secondary-button"
                style={{ width: '100%', minHeight: 44, color: '#DC2626', borderColor: '#FECACA' }}
                onClick={() => handleCancelAdvance(inspectAdvance)}
                disabled={actionLoading}
              >
                <Ban size={16} /> Cancel & Void Advance
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </main>
  );
}
