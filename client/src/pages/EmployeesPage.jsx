import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, UserCheck, UserX, X, Shield, Lock, HandCoins, History, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import {
  changeEmployeeStatus,
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
  recordEmployeeAdvance,
  listEmployeeAdvances,
  listUnadjustedAdvances,
  removeEmployeeAdvance
} from '../api/employees.js';
import { listProjects } from '../api/projects.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { MaskedField } from '../components/MaskedField.jsx';
import { BottomSheet } from '../components/BottomSheet.jsx';
import { FloatingActionButton } from '../components/FloatingActionButton.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function EmployeeModal({ projects, initialData, onClose, onSaved, authenticatedRequest }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    wageType: initialData?.wageType || 'daily',
    wageRate: initialData?.wageRate !== undefined ? String(initialData.wageRate) : '',
    bankDetails: '',
    upiId: '',
    isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    projectIds: initialData?.projectIds || []
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function toggleProject(projectId) {
    setForm((current) => {
      const next = current.projectIds.includes(projectId)
        ? current.projectIds.filter((id) => id !== projectId)
        : [...current.projectIds, projectId];
      return { ...current, projectIds: next };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        wageType: form.wageType,
        wageRate: parseFloat(form.wageRate),
        bankDetails: form.bankDetails.trim() || null,
        upiId: form.upiId.trim() || null,
        projectIds: form.projectIds
      };

      if (initialData?.id) {
        await updateEmployee(authenticatedRequest, initialData.id, {
          ...payload,
          isActive: form.isActive
        });
      } else {
        await createEmployee(authenticatedRequest, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3>{initialData?.id ? 'Edit Employee Roster' : 'Add Employee to Roster'}</h3>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              {error && <p className="form-error">{error}</p>}

              <div className="form-grid">
                <label>
                  Full Name
                  <input
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    required
                  />
                </label>

                <label>
                  Phone Number
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </label>
              </div>

              <div>
                <label>
                  Daily Wage Rate (₹ / day) *
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.wageRate}
                    onChange={(e) => setField('wageRate', e.target.value)}
                    placeholder="e.g. 750"
                    required
                  />
                </label>
              </div>

              {/* Encrypted Banking Credentials */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: '0.78rem', color: '#0F5394', fontWeight: 700 }}>
                  <Lock size={14} /> AES-256 Encrypted Banking Credentials
                </div>

                <div className="form-grid">
                  <label>
                    Bank Account Number
                    <input
                      value={form.bankDetails}
                      onChange={(e) => setField('bankDetails', e.target.value)}
                      placeholder={initialData?.bankDetailsMasked || 'Enter account number'}
                    />
                  </label>

                  <label>
                    UPI ID (Virtual Payment Address)
                    <input
                      value={form.upiId}
                      onChange={(e) => setField('upiId', e.target.value)}
                      placeholder={initialData?.upiIdMasked || 'username@okhdfcbank'}
                    />
                  </label>
                </div>
              </div>

              {/* Project Assignments */}
              <div>
                <label style={{ marginBottom: 6 }}>Assigned Projects & Sites</label>
                {projects.length === 0 ? (
                  <p className="muted" style={{ fontSize: '0.82rem' }}>No projects created yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {projects.map((p) => {
                      const checked = form.projectIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProject(p.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${checked ? 'var(--brand-teal)' : '#CBD5E1'}`,
                            background: checked ? 'var(--brand-teal-light)' : '#FFFFFF',
                            color: checked ? 'var(--brand-teal-dark)' : '#475569',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {checked ? '✓ ' : '+ '}{p.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GiveAdvanceModal({ employee, onClose, onSaved, authenticatedRequest }) {
  const [form, setForm] = useState({
    amount: '',
    advanceDate: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) {
      setError('Please enter a valid advance amount greater than 0.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await recordEmployeeAdvance(authenticatedRequest, employee.id, {
        amount: amt,
        advanceDate: form.advanceDate,
        notes: form.notes.trim() || null
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to record employee advance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0 }}>Give Advance Payment</h3>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 0' }}>
              Employee: <strong>{employee.name}</strong> ({employee.wageType} @ {formatCurrency(employee.wageRate)})
            </p>
          </div>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              {error && <p className="form-error">{error}</p>}

              <div style={{ background: 'var(--brand-teal-light)', padding: '12px 14px', borderRadius: 8, fontSize: '0.82rem', color: 'var(--brand-navy)' }}>
                ℹ️ This advance will be automatically deducted against {employee.name}'s daily wage earnings in the next payroll run.
              </div>

              <div className="form-grid">
                <label>
                  Advance Amount (₹)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="e.g. 2000"
                    required
                    autoFocus
                  />
                </label>

                <label>
                  Date Given
                  <input
                    type="date"
                    value={form.advanceDate}
                    onChange={(e) => setForm({ ...form, advanceDate: e.target.value })}
                    required
                  />
                </label>
              </div>

              <label>
                Reason / Note (Optional)
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Medical emergency or Festival advance"
                  maxLength={500}
                />
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              <HandCoins size={16} />
              {saving ? 'Recording Advance...' : 'Record Advance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function calculateOutstandingAdvances(advances) {
  if (!Array.isArray(advances)) return 0;
  return advances
    .filter((a) => {
      const isLocked = Boolean(
        (a.adjustedInRunId || a.adjusted_in_run_id) &&
          ['finalized', 'paid', 'superseded'].includes(a.runStatus || a.run_status)
      );
      return !isLocked && a.status !== 'cancelled';
    })
    .reduce((sum, a) => sum + Number(a.amount || 0), 0);
}

function AdvancesHistoryModal({ employee, onClose, authenticatedRequest, onAdvanceRemoved, canRemoveAdvance }) {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingAdvance, setConfirmingAdvance] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const loadAdvances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEmployeeAdvances(authenticatedRequest, employee.id);
      setAdvances(data || []);
    } catch (err) {
      setAdvances([]);
      setError(err.message || 'Failed to load advance history.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, employee.id]);

  useEffect(() => {
    loadAdvances();
  }, [loadAdvances]);

  async function handleConfirmRemove() {
    if (!confirmingAdvance) return;
    setDeleting(true);
    setError(null);
    try {
      await removeEmployeeAdvance(authenticatedRequest, employee.id, confirmingAdvance.id);
      setConfirmingAdvance(null);
      await loadAdvances();
      if (onAdvanceRemoved) onAdvanceRemoved();
    } catch (err) {
      setError(err.message || 'Failed to remove advance record.');
      setConfirmingAdvance(null);
    } finally {
      setDeleting(false);
    }
  }

  const isAdvanceLocked = (a) =>
    Boolean((a.adjustedInRunId || a.adjusted_in_run_id) && ['finalized', 'paid', 'superseded'].includes(a.runStatus || a.run_status));

  const totalUnadjusted = calculateOutstandingAdvances(advances);

  return (
    <>
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal" style={{ maxWidth: 680 }}>
          <div className="modal-header">
            <div>
              <h3 style={{ margin: 0 }}>Advance History — {employee.name}</h3>
              <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 0' }}>
                Outstanding unadjusted: <strong style={{ color: totalUnadjusted > 0 ? '#991B1B' : '#065F46' }}>{formatCurrency(totalUnadjusted)}</strong>
              </p>
            </div>
            <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
          </div>

          <div className="modal-body">
            {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

            {loading ? (
              <p className="muted" style={{ padding: 20 }}>Loading advance records...</p>
            ) : advances.length === 0 ? (
              <div className="empty-state">
                <HandCoins size={36} />
                <p>No advances recorded for this employee yet.</p>
              </div>
            ) : (
              <>
                {/* Mobile View (<640px): Stacked Card Layout for 100% Tap Target & Action Visibility */}
                <div className="mobile-only-view" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {advances.map((adv) => {
                    const isLocked = isAdvanceLocked(adv);
                    const monthName = adv.runMonth ? MONTH_NAMES[adv.runMonth - 1] : '';
                    const lockedReason = isLocked
                      ? `This advance of ${formatCurrency(adv.amount)} given on ${adv.advanceDate} was already applied in the ${monthName} ${adv.runYear || ''} payroll run and cannot be removed.`
                      : '';

                    return (
                      <div key={adv.id} className="mobile-card" style={{ padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                              {formatCurrency(adv.amount)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                              Issued: {adv.advanceDate}
                            </div>
                          </div>
                          <span className={`badge ${isLocked ? 'badge-active' : 'badge-overdue'}`}>
                            {isLocked ? 'Deducted in Payroll' : 'Pending Deduction'}
                          </span>
                        </div>

                        {adv.notes && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8, background: '#F8FAFC', padding: '4px 8px', borderRadius: 6 }}>
                            Note: {adv.notes}
                          </div>
                        )}

                        {canRemoveAdvance && (
                          <div style={{ marginTop: 8 }}>
                            {isLocked ? (
                              <button
                                type="button"
                                disabled
                                title={lockedReason}
                                className="secondary-button"
                                style={{
                                  width: '100%',
                                  minHeight: 44,
                                  fontSize: '0.78rem',
                                  opacity: 0.65,
                                  cursor: 'not-allowed',
                                  background: '#F1F5F9',
                                  borderColor: '#CBD5E1',
                                  color: '#64748B'
                                }}
                              >
                                <Lock size={14} /> Locked (Applied in Payroll)
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => setConfirmingAdvance(adv)}
                                disabled={deleting}
                                style={{
                                  width: '100%',
                                  minHeight: 44,
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: '#DC2626',
                                  borderColor: '#FECACA',
                                  touchAction: 'manipulation'
                                }}
                              >
                                <Trash2 size={14} /> Remove Advance Record
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View (>=640px): Standard Table View */}
                <div className="desktop-only-view">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th>Note</th>
                          <th>Status</th>
                          {canRemoveAdvance && <th style={{ textAlign: 'center' }}>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {advances.map((adv) => {
                          const isLocked = isAdvanceLocked(adv);
                          const monthName = adv.runMonth ? MONTH_NAMES[adv.runMonth - 1] : '';
                          const lockedReason = isLocked
                            ? `This advance of ${formatCurrency(adv.amount)} given on ${adv.advanceDate} was already applied in the ${monthName} ${adv.runYear || ''} payroll run and cannot be removed.`
                            : '';

                          return (
                            <tr key={adv.id}>
                              <td className="muted">{adv.advanceDate}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--brand-navy)' }}>
                                {formatCurrency(adv.amount)}
                              </td>
                              <td>{adv.notes || '—'}</td>
                              <td>
                                <span className={`badge ${isLocked ? 'badge-active' : 'badge-overdue'}`}>
                                  {isLocked ? 'Deducted in Payroll' : 'Pending Deduction'}
                                </span>
                              </td>
                              {canRemoveAdvance && (
                                <td style={{ textAlign: 'center' }}>
                                  {isLocked ? (
                                    <button
                                      type="button"
                                      disabled
                                      title={lockedReason}
                                      className="secondary-button"
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '4px 8px',
                                        minHeight: 36,
                                        opacity: 0.65,
                                        cursor: 'not-allowed',
                                        background: '#F1F5F9',
                                        borderColor: '#CBD5E1',
                                        color: '#64748B'
                                      }}
                                    >
                                      <Lock size={12} /> Locked
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() => setConfirmingAdvance(adv)}
                                      disabled={deleting}
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '4px 10px',
                                        minHeight: 36,
                                        color: '#DC2626',
                                        borderColor: '#FECACA',
                                        touchAction: 'manipulation'
                                      }}
                                    >
                                      <Trash2 size={13} /> Remove
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="primary-button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmingAdvance && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626' }}>
                <AlertTriangle size={20} />
                <h3 style={{ margin: 0, color: '#991B1B' }}>Remove Advance Payment?</h3>
              </div>
              <button className="close-btn" type="button" onClick={() => setConfirmingAdvance(null)} disabled={deleting}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', margin: 0, color: '#334155' }}>
                Remove this advance of <strong>{formatCurrency(confirmingAdvance.amount)}</strong> given on <strong>{confirmingAdvance.advanceDate}</strong>? This cannot be undone.
              </p>
              {confirmingAdvance.notes && (
                <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>
                  Note: "{confirmingAdvance.notes}"
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmingAdvance(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleConfirmRemove}
                disabled={deleting}
                style={{ background: '#DC2626', borderColor: '#DC2626', minHeight: 44, touchAction: 'manipulation' }}
              >
                {deleting ? 'Removing...' : 'Remove Advance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EmployeesPage() {
  const { user, authenticatedRequest } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [unadjustedAdvances, setUnadjustedAdvances] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [advanceModalEmp, setAdvanceModalEmp] = useState(null);
  const [historyModalEmp, setHistoryModalEmp] = useState(null);
  const [inspectEmployee, setInspectEmployee] = useState(null);

  const canManage = user?.role === 'TenantAdmin' || user?.role === 'Manager' || user?.role === 'Accountant';
  const isAdmin = user?.role === 'TenantAdmin';
  const canGiveAdvance = user?.role === 'TenantAdmin' || user?.role === 'Accountant';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empData, projData, advData] = await Promise.all([
        listEmployees(authenticatedRequest, showRemoved),
        listProjects(authenticatedRequest),
        listUnadjustedAdvances(authenticatedRequest).catch(() => [])
      ]);
      setEmployees(empData);
      setProjects(projData);
      setUnadjustedAdvances(advData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, showRemoved]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggleStatus(employee) {
    if (!isAdmin) {
      alert('You do not have permission to activate or deactivate employees.');
      return;
    }
    try {
      await changeEmployeeStatus(authenticatedRequest, employee.id, !employee.isActive);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRemoveEmployee(employee) {
    if (!isAdmin) {
      alert('You do not have permission to remove employees.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${employee.name}? This employee will be deactivated and hidden from active lists and new payroll runs, but historical attendance and payroll records will be preserved.`)) {
      return;
    }
    try {
      await deleteEmployee(authenticatedRequest, employee.id);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to remove employee');
    }
  }

  // Calculate unadjusted advance total per employee
  const advancesMap = useMemo(() => {
    const map = {};
    for (const adv of unadjustedAdvances) {
      const empId = adv.employeeId || adv.employee_id;
      if (empId) {
        map[empId] = (map[empId] || 0) + Number(adv.amount || 0);
      }
    }
    return map;
  }, [unadjustedAdvances]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.phone && e.phone.includes(q)) ||
        e.wageType.toLowerCase().includes(q)
    );
  }, [employees, search]);

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <Header
          title="Employees & Workforce"
          subtitle="Manage active staff roster, wage rates, advances, and encrypted banking credentials."
        >
          {canManage && (
            <button
              className="primary-button"
              type="button"
              onClick={() => setModalData({})}
            >
              <Plus size={16} /> Add Employee
            </button>
          )}
        </Header>

        {error && <p className="form-error" style={{ marginBottom: 20 }}>{error}</p>}

        <section className="panel">
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0 }}>Staff Roster ({filteredEmployees.length})</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={showRemoved}
                  onChange={(e) => setShowRemoved(e.target.checked)}
                />
                Show removed employees
              </label>
              <div className="search-input-wrap" style={{ minWidth: 240 }}>
                <Search size={16} />
                <input
                  className="search-input"
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

            {/* ════════════════════════════════════════════════════════════════
                MOBILE CARD LIST VIEW (<1024px)
            ════════════════════════════════════════════════════════════════ */}
            <div className="mobile-only-view">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="mobile-card" style={{ height: 90, opacity: 0.6, background: '#F8FAFC' }} />
                  ))}
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <UserX size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                  <p className="muted" style={{ margin: 0 }}>No employees found.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredEmployees.map((emp) => {
                    const assignedProjs = projects.filter((p) => emp.projectIds?.includes(p.id));
                    const outstanding = advancesMap[emp.id] || 0;

                    return (
                      <div
                        key={emp.id}
                        className="mobile-card"
                        onClick={() => setInspectEmployee(emp)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="mobile-card-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'var(--brand-teal-light)',
                                color: 'var(--brand-teal-dark)',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {emp.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="mobile-card-title">{emp.name}</div>
                              <div className="mobile-card-sub">
                                {emp.phone || 'No phone'}
                              </div>
                            </div>
                          </div>

                          <span className={`badge ${emp.isActive ? 'badge-active' : 'badge-inactive'}`}>
                            <span className="badge-dot" style={{ background: emp.isActive ? '#10B981' : '#94A3B8' }} />
                            {emp.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="mobile-card-bottom">
                          <span
                            style={{
                              background: '#EFF6FF',
                              color: '#1E40AF',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                          >
                            Daily · {formatCurrency(emp.wageRate)}/day
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {outstanding > 0 && (
                              <span
                                style={{
                                  background: '#FEF2F2',
                                  color: '#991B1B',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: '0.72rem',
                                  fontWeight: 700
                                }}
                              >
                                Adv: {formatCurrency(outstanding)}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
                              Details →
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canManage && (
                <FloatingActionButton
                  label="Add Employee"
                  onClick={() => setModalData({})}
                />
              )}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                DESKTOP TABLE VIEW (>=1024px) — 100% UNTOUCHED
            ════════════════════════════════════════════════════════════════ */}
            <div className="desktop-only-view">
              {loading ? (
                <p className="muted" style={{ padding: 20 }}>Loading employee roster...</p>
              ) : filteredEmployees.length === 0 ? (
                <div className="empty-state">
                  <UserX size={40} />
                  <p>No employees found. Click "Add Employee" to create one.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee Name</th>
                        <th>Wage Details</th>
                        <th>Outstanding Advances</th>
                        <th>Bank Details (AES-256)</th>
                        <th>UPI ID (AES-256)</th>
                        <th>Allocated Sites</th>
                        <th>Status</th>
                        {canManage && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((emp) => {
                        const assignedProjs = projects.filter((p) => emp.projectIds?.includes(p.id));
                        const outstanding = advancesMap[emp.id] || 0;

                        return (
                          <tr key={emp.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{emp.name}</div>
                              {emp.phone && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{emp.phone}</div>}
                            </td>
                            <td>
                              <span
                                style={{
                                  background: '#EFF6FF',
                                  color: '#1E40AF',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  fontSize: '0.78rem'
                                }}
                              >
                                Daily · {formatCurrency(emp.wageRate)}/day
                              </span>
                            </td>
                            <td>
                              {outstanding > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setHistoryModalEmp(emp)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    color: '#991B1B',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                  title="Click to view advance history"
                                >
                                  <HandCoins size={12} /> {formatCurrency(outstanding)} pending
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setHistoryModalEmp(emp)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#94A3B8',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                >
                                  ₹0.00
                                </button>
                              )}
                            </td>
                            <td>
                              <MaskedField maskedValue={emp.bankDetailsMasked} label="Bank Account" />
                            </td>
                            <td>
                              <MaskedField maskedValue={emp.upiIdMasked} label="UPI ID" />
                            </td>
                            <td>
                              {assignedProjs.length === 0 ? (
                                <span className="muted" style={{ fontSize: '0.78rem' }}>Unassigned</span>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {assignedProjs.map((p) => (
                                    <span key={p.id} className="badge" style={{ background: '#F1F5F9', color: '#475569', fontSize: '0.72rem' }}>
                                      {p.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {emp.isRemoved ? (
                                <span className="badge badge-inactive" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                                  <span className="badge-dot" style={{ background: '#EF4444' }} />
                                  Removed
                                </span>
                              ) : (
                                <span className={`badge ${emp.isActive ? 'badge-active' : 'badge-inactive'}`}>
                                  <span className="badge-dot" style={{ background: emp.isActive ? '#10B981' : '#94A3B8' }} />
                                  {emp.isActive ? 'Active' : 'Inactive'}
                                </span>
                              )}
                            </td>
                            {canManage && (
                              <td>
                                {emp.isRemoved ? (
                                  <span className="muted" style={{ fontSize: '0.78rem' }}>Archived Record</span>
                                ) : (
                                  <div className="action-row" style={{ gap: 4 }}>
                                    {canGiveAdvance && emp.isActive && (
                                      <button
                                        type="button"
                                        className="accent-button"
                                        onClick={() => setAdvanceModalEmp(emp)}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 30 }}
                                        title="Give Advance Payment"
                                      >
                                        <HandCoins size={12} /> Advance
                                      </button>
                                    )}

                                    <button
                                       type="button"
                                       className="secondary-button"
                                       onClick={() => setHistoryModalEmp(emp)}
                                       style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 30 }}
                                       title="View Advance History & Ledger"
                                     >
                                       <History size={12} /> History
                                     </button>

                                    <button
                                      type="button"
                                      className="icon-btn"
                                      onClick={() => setModalData(emp)}
                                      style={{ fontSize: '0.78rem', padding: '4px 8px', minHeight: 30 }}
                                    >
                                      Edit
                                    </button>

                                    {isAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          className="icon-btn"
                                          onClick={() => handleToggleStatus(emp)}
                                          style={{
                                            fontSize: '0.78rem',
                                            padding: '4px 8px',
                                            minHeight: 30,
                                            color: emp.isActive ? '#D97706' : '#065F46'
                                          }}
                                        >
                                          {emp.isActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button
                                          type="button"
                                          className="icon-btn"
                                          onClick={() => handleRemoveEmployee(emp)}
                                          style={{
                                            fontSize: '0.78rem',
                                            padding: '4px 8px',
                                            minHeight: 30,
                                            color: '#991B1B'
                                          }}
                                          title="Remove employee record"
                                        >
                                          Remove
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
        </section>
      </section>

      {modalData && (
        <EmployeeModal
          projects={projects}
          initialData={modalData.id ? modalData : null}
          onClose={() => setModalData(null)}
          onSaved={async () => {
            setModalData(null);
            await loadData();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}

      {advanceModalEmp && (
        <GiveAdvanceModal
          employee={advanceModalEmp}
          onClose={() => setAdvanceModalEmp(null)}
          onSaved={async () => {
            setAdvanceModalEmp(null);
            await loadData();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}

      {historyModalEmp && (
        <AdvancesHistoryModal
          employee={historyModalEmp}
          onClose={() => setHistoryModalEmp(null)}
          authenticatedRequest={authenticatedRequest}
          onAdvanceRemoved={async () => {
            await loadData();
          }}
          canRemoveAdvance={canGiveAdvance}
        />
      )}

      {/* Mobile Employee Quick Detail Inspector Bottom Sheet */}
      <BottomSheet
        isOpen={Boolean(inspectEmployee)}
        onClose={() => setInspectEmployee(null)}
        title={inspectEmployee ? inspectEmployee.name : 'Employee Details'}
      >
        {inspectEmployee && (
          <div>
            <div className="mobile-user-card" style={{ marginBottom: 16 }}>
              <div className="mobile-user-avatar">
                {inspectEmployee.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mobile-user-name">{inspectEmployee.name}</div>
                <div className="mobile-user-sub">{inspectEmployee.phone || 'No phone number'}</div>
                <span
                  style={{
                    background: '#EFF6FF',
                    color: '#1E40AF',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'inline-block',
                    marginTop: 4
                  }}
                >
                  Daily Rate · {formatCurrency(inspectEmployee.wageRate)}/day
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={13} /> Banking Credentials (AES-256 Encrypted)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <span className="muted" style={{ fontSize: '0.72rem' }}>Bank Account: </span>
                    <MaskedField maskedValue={inspectEmployee.bankDetailsMasked} label="Bank Account" />
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: '0.72rem' }}>UPI ID: </span>
                    <MaskedField maskedValue={inspectEmployee.upiIdMasked} label="UPI ID" />
                  </div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>Outstanding Advances</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: advancesMap[inspectEmployee.id] > 0 ? '#DC2626' : '#059669' }}>
                    {formatCurrency(advancesMap[inspectEmployee.id] || 0)}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ width: '100%', minHeight: 36, fontSize: '0.78rem' }}
                  onClick={() => {
                    const emp = inspectEmployee;
                    setInspectEmployee(null);
                    setHistoryModalEmp(emp);
                  }}
                >
                  <History size={14} /> View Advance History & Ledger
                </button>
              </div>

              {canManage && !inspectEmployee.isRemoved && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {canGiveAdvance && inspectEmployee.isActive && (
                    <button
                      type="button"
                      className="accent-button"
                      style={{ width: '100%', minHeight: 44 }}
                      onClick={() => {
                        const emp = inspectEmployee;
                        setInspectEmployee(null);
                        setAdvanceModalEmp(emp);
                      }}
                    >
                      <HandCoins size={16} /> Record Cash Advance
                    </button>
                  )}

                  <button
                    type="button"
                    className="primary-button"
                    style={{ width: '100%', minHeight: 44 }}
                    onClick={() => {
                      const emp = inspectEmployee;
                      setInspectEmployee(null);
                      setModalData(emp);
                    }}
                  >
                    Edit Employee Details
                  </button>

                  {isAdmin && !inspectEmployee.isRemoved && (
                    <>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          width: '100%',
                          minHeight: 44,
                          color: inspectEmployee.isActive ? '#D97706' : '#059669',
                          borderColor: inspectEmployee.isActive ? '#FDE68A' : '#A7F3D0'
                        }}
                        onClick={async () => {
                          const emp = inspectEmployee;
                          setInspectEmployee(null);
                          await handleToggleStatus(emp);
                        }}
                      >
                        {inspectEmployee.isActive ? 'Deactivate Employee' : 'Activate Employee'}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          width: '100%',
                          minHeight: 44,
                          color: '#DC2626',
                          borderColor: '#FECACA'
                        }}
                        onClick={async () => {
                          const emp = inspectEmployee;
                          setInspectEmployee(null);
                          await handleRemoveEmployee(emp);
                        }}
                      >
                        Remove Employee Record
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </main>
  );
}
