import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  FileText,
  Plus,
  Settings,
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Wallet,
  RefreshCw,
  RotateCcw,
  Lock,
  HandCoins,
  Shield,
  Calendar,
  ArrowRight,
  Eye
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import {
  listPayrollRuns,
  generatePayrollRun,
  previewPayrollRun,
  resyncPayrollRun,
  previewPayrollRegeneration,
  regeneratePayrollRun,
  getPayrollRun,
  finalizeRun,
  addAdjustment,
  removeAdjustment,
  markPaid,
  getPayslipData,
  getSettings,
  saveSettings
} from '../api/payroll.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { BottomSheet } from '../components/BottomSheet.jsx';
import { FloatingActionButton } from '../components/FloatingActionButton.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateRange(startStr, endStr, fallbackMonth, fallbackYear) {
  if (startStr && endStr) {
    const s = new Date(startStr);
    const e = new Date(endStr);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      const sFormat = s.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      const eFormat = e.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${sFormat} – ${eFormat}`;
    }
  }
  if (fallbackMonth && fallbackYear) {
    return `${MONTH_NAMES[fallbackMonth - 1]} ${fallbackYear}`;
  }
  return 'Flexible Rolling Period';
}

function PreviewRunModal({ previewData, onClose, onConfirm, generating }) {
  const navigate = useNavigate();
  if (!previewData) return null;
  const { previewItems = [], summary = {}, olderUnadjustedAdvances = [] } = previewData;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 840 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#EFF6FF', color: '#1E40AF', padding: 8, borderRadius: 8 }}>
              <Eye size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Preview Payroll Run</h3>
              <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 0' }}>
                Period: {formatDateRange(summary.startDate, summary.endDate)}
              </p>
            </div>
          </div>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="form-stack">
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Total Staff</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                  {summary.totalEmployees || previewItems.length}
                </div>
              </div>
              <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 8, border: '1px solid #A7F3D0' }}>
                <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46' }}>Gross Wages</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                  {formatCurrency(summary.totalGross)}
                </div>
              </div>
              <div style={{ background: '#EFF6FF', padding: 12, borderRadius: 8, border: '1px solid #BFDBFE' }}>
                <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E40AF' }}>Net Payout</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E40AF' }}>
                  {formatCurrency(summary.totalNet)}
                </div>
              </div>
            </div>

            {/* Older Unadjusted Advances Alert */}
            {olderUnadjustedAdvances && olderUnadjustedAdvances.length > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400E' }}>
                      {olderUnadjustedAdvances.length} Unadjusted Advance(s) Prior to Rolling Period ({formatCurrency(summary.totalOlderAdvances)})
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#B45309' }}>
                      These advances were issued before individual period start dates and are <strong>NOT</strong> automatically deducted from this run.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    onClose();
                    navigate('/app/advances');
                  }}
                  style={{ fontSize: '0.75rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                >
                  View All Advances →
                </button>
              </div>
            )}

            {/* Line Items Table */}
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Period Window</th>
                    <th style={{ textAlign: 'center' }}>Units (P/H/OT/A)</th>
                    <th style={{ textAlign: 'right' }}>Gross</th>
                    <th style={{ textAlign: 'right' }}>Advances Deducted</th>
                    <th style={{ textAlign: 'right' }}>Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{item.employeeName}</strong>
                        <div className="muted" style={{ fontSize: '0.72rem' }}>{formatCurrency(item.wageRate)}/day</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.76rem', color: '#334155' }}>
                          {formatDateRange(item.periodStartDate, item.periodEndDate)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.76rem' }}>
                        <span style={{ color: '#065F46', fontWeight: 700 }}>{item.presentDays}P</span> ·{' '}
                        <span style={{ color: '#D97706' }}>{item.halfDays}H</span> ·{' '}
                        <span style={{ color: '#2563EB' }}>{item.overtimeDays}OT</span> ·{' '}
                        <span style={{ color: '#DC2626' }}>{item.absentDays}A</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.grossAmount)}</td>
                      <td style={{ textAlign: 'right', color: item.advanceDeduction > 0 ? '#DC2626' : '#64748B', fontWeight: item.advanceDeduction > 0 ? 700 : 400 }}>
                        {item.advanceDeduction > 0 ? `−${formatCurrency(item.advanceDeduction)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--brand-navy)' }}>
                        {formatCurrency(item.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={generating}>
            Back & Edit
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onConfirm}
            disabled={generating}
          >
            {generating ? 'Creating Payroll Run...' : 'Confirm & Create Payroll Run'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustmentModal({ runId, lineItem, onClose, onSaved, authenticatedRequest }) {
  const [form, setForm] = useState({ type: 'deduction', label: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addAdjustment(authenticatedRequest, runId, lineItem.id, {
        ...form,
        amount: parseFloat(form.amount)
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to apply adjustment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>Salary Adjustment — {lineItem.employeeName}</h3>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleAdd}>
          <div className="modal-body">
            <div className="form-stack">
              {error && <p className="form-error">{error}</p>}
              <label>
                Adjustment Type
                <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
                  <option value="deduction">Deduction / Advance Recovery (−)</option>
                  <option value="bonus">Bonus / Site Performance Incentive (+)</option>
                </select>
              </label>

              <label>
                Reason / Note
                <input
                  value={form.label}
                  onChange={(e) => setField('label', e.target.value)}
                  placeholder="e.g. Mid-month salary advance or Festival bonus"
                  required
                  maxLength={200}
                />
              </label>

              <label>
                Adjustment Amount (₹)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettingsPanel({ authenticatedRequest, onBack }) {
  const [form, setForm] = useState({ workingDaysPerMonth: 26, overtimeMultiplier: 1.5, halfDayMultiplier: 0.5 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSettings(authenticatedRequest)
      .then((s) => setForm(s))
      .catch(() => {});
  }, [authenticatedRequest]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveSettings(authenticatedRequest, form);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="icon-btn" type="button" onClick={onBack}>
          <ChevronLeft size={18} /> Back
        </button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Payroll Multipliers & Base Calendar</h2>
      </div>

      <div className="panel" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSave} className="form-stack">
          {error && <p className="form-error">{error}</p>}
          {saved && (
            <p style={{ background: '#ECFDF5', color: '#065F46', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600 }}>
              Payroll settings updated successfully!
            </p>
          )}

          <label>
            Standard Base Working Days (e.g. 26 days/month)
            <input
              type="number"
              min="1"
              max="31"
              value={form.workingDaysPerMonth}
              onChange={(e) => setForm({ ...form, workingDaysPerMonth: parseInt(e.target.value) || 26 })}
              required
            />
          </label>

          <label>
            Overtime Multiplier (e.g. 1.5× for 150% rate)
            <input
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={form.overtimeMultiplier}
              onChange={(e) => setForm({ ...form, overtimeMultiplier: parseFloat(e.target.value) || 1.5 })}
              required
            />
          </label>

          <label>
            Half-Day Multiplier (e.g. 0.5× for 50% rate)
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={form.halfDayMultiplier}
              onChange={(e) => setForm({ ...form, halfDayMultiplier: parseFloat(e.target.value) || 0.5 })}
              required
            />
          </label>

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}

function RegeneratePayrollModal({ year, month, onClose, onRegenerated, authenticatedRequest }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    previewPayrollRegeneration(authenticatedRequest, year, month)
      .then((data) => setPreview(data))
      .catch((err) => setError(err.message || 'Failed to load regeneration preview.'))
      .finally(() => setLoading(false));
  }, [authenticatedRequest, year, month]);

  async function handleConfirm() {
    setRegenerating(true);
    setError(null);
    try {
      const result = await regeneratePayrollRun(authenticatedRequest, year, month);
      onRegenerated(result);
    } catch (err) {
      setError(err.message || 'Failed to regenerate payroll run.');
      setRegenerating(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#FEF3C7', color: '#D97706', padding: 8, borderRadius: 8 }}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Regenerate Payroll — {MONTH_NAMES[month - 1]} {year}</h3>
              <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 0' }}>
                Create Version #{preview?.nextVersion || 2} with paid employee protection
              </p>
            </div>
          </div>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-stack">
            {error && <p className="form-error">{error}</p>}

            {loading ? (
              <p className="muted" style={{ padding: 20 }}>Analyzing payroll status and paid employees...</p>
            ) : preview ? (
              <>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: 14, fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#1E40AF', marginBottom: 4 }}>
                    <Shield size={16} /> Paid Staff Are 100% Protected
                  </div>
                  <p style={{ margin: 0, color: '#1E3A8A', fontSize: '0.8rem', lineHeight: 1.4 }}>
                    TheWoodWise strictly guarantees that any employee who was already marked <strong>PAID</strong> in previous runs will remain locked and will <strong>NOT</strong> be recalculated or re-paid.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#1E40AF' }}>
                      <Lock size={14} /> Locked Employees ({preview.lockedCount})
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: '#1E40AF' }}>
                      {preview.lockedCount} staff
                    </div>
                    <p className="muted" style={{ fontSize: '0.72rem', margin: '4px 0 0' }}>
                      Already paid in v{preview.previousRun?.version || 1}. Preserved untouched.
                    </p>
                  </div>

                  <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#059669' }}>
                      <RefreshCw size={14} /> Recalculating ({preview.pendingCount})
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: '#059669' }}>
                      {preview.pendingCount} staff
                    </div>
                    <p className="muted" style={{ fontSize: '0.72rem', margin: '4px 0 0' }}>
                      Prorated with latest attendance & unadjusted advances.
                    </p>
                  </div>
                </div>

                {preview.lockedLineItems && preview.lockedLineItems.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', margin: '0 0 6px' }}>
                      Protected Staff (Locked)
                    </h4>
                    <div style={{ maxHeight: 120, overflowY: 'auto', background: '#F8FAFC', padding: '8px 12px', borderRadius: 6, fontSize: '0.78rem' }}>
                      {preview.lockedLineItems.map((li) => (
                        <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                          <span>🔒 {li.employeeName}</span>
                          <span style={{ fontWeight: 700, color: '#059669' }}>{formatCurrency(li.netAmount)} (PAID)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={regenerating}>Cancel</button>
          <button
            type="button"
            className="primary-button"
            onClick={handleConfirm}
            disabled={regenerating || loading}
            style={{ background: '#D97706' }}
          >
            <RotateCcw size={16} />
            {regenerating ? 'Regenerating...' : `Confirm & Regenerate (v${preview?.nextVersion || 2})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PayrollPage() {
  const { user, authenticatedRequest } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState('list');
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewModalData, setPreviewModalData] = useState(null);
  const [adjModal, setAdjModal] = useState(null);
  const [regenTarget, setRegenTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [inspectLineItem, setInspectLineItem] = useState(null);

  const today = new Date();
  const [genYear, setGenYear] = useState(today.getFullYear());
  const [genMonth, setGenMonth] = useState(today.getMonth() + 1);
  const [genStartDate, setGenStartDate] = useState('');
  const [genEndDate, setGenEndDate] = useState(today.toISOString().slice(0, 10));
  const [generationMode, setGenerationMode] = useState('rolling'); // 'rolling' or 'monthly'

  const isAdmin = user?.role === 'TenantAdmin';

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPayrollRuns(authenticatedRequest);
      setRuns(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  async function handleOpenRun(runId) {
    setLoading(true);
    try {
      const detail = await getPayrollRun(authenticatedRequest, runId);
      setSelectedRun(detail);
      setView('detail');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshRunDetail() {
    if (!selectedRun) return;
    const detail = await getPayrollRun(authenticatedRequest, selectedRun.run.id);
    setSelectedRun(detail);
    await loadRuns();
  }

  async function handlePreviewRun() {
    setPreviewing(true);
    setError(null);
    try {
      const payload = generationMode === 'rolling'
        ? { startDate: genStartDate || null, endDate: genEndDate }
        : { year: genYear, month: genMonth };
      const data = await previewPayrollRun(authenticatedRequest, payload);
      setPreviewModalData(data);
    } catch (err) {
      setError(err.message || 'Failed to preview payroll run.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleGenerateRun(options = {}) {
    setGenerating(true);
    setError(null);
    try {
      const payload = generationMode === 'rolling'
        ? { startDate: genStartDate || null, endDate: genEndDate, ...options }
        : { year: genYear, month: genMonth, ...options };
      const result = await generatePayrollRun(authenticatedRequest, payload);
      setRuns((prev) => [result.run, ...prev]);
      setSelectedRun(result);
      setPreviewModalData(null);
      setView('detail');
    } catch (err) {
      if (err.message && (err.message.includes('already exists') || err.message.includes('already finalized') || err.message.includes('Regenerate'))) {
        setRegenTarget({ year: genYear, month: genMonth });
      } else {
        setError(err.message || 'Run for this period already exists.');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleResync(runId) {
    setActionLoading((prev) => ({ ...prev, resync: true }));
    try {
      const result = await resyncPayrollRun(authenticatedRequest, runId);
      setSelectedRun(result);
      await loadRuns();
      alert('Payroll run successfully re-synced with the latest attendance records and advances!');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, resync: false }));
    }
  }

  async function handleFinalize(runId) {
    if (!isAdmin) {
      alert('You do not have permission to finalize payroll runs.');
      return;
    }
    setActionLoading((prev) => ({ ...prev, finalize: true }));
    try {
      const result = await finalizeRun(authenticatedRequest, runId);
      setSelectedRun(result);
      await loadRuns();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, finalize: false }));
    }
  }

  async function handleMarkPaid(runId, lineItemId) {
    if (!isAdmin) {
      alert('You do not have permission to mark payroll line items as paid.');
      return;
    }
    setActionLoading((prev) => ({ ...prev, [lineItemId]: true }));
    try {
      await markPaid(authenticatedRequest, runId, lineItemId);
      await refreshRunDetail();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[lineItemId];
        return next;
      });
    }
  }

  async function handleRemoveAdjustment(runId, lineItemId, adjId) {
    if (!isAdmin) {
      alert('You do not have permission to remove payroll adjustments.');
      return;
    }
    try {
      await removeAdjustment(authenticatedRequest, runId, lineItemId, adjId);
      await refreshRunDetail();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        {view === 'settings' && isAdmin ? (
          <SettingsPanel authenticatedRequest={authenticatedRequest} onBack={() => setView('list')} />
        ) : view === 'detail' && selectedRun ? (
          <>
            <Header
              title={`Payroll — ${formatDateRange(selectedRun.run.periodStartDate, selectedRun.run.periodEndDate, selectedRun.run.periodMonth, selectedRun.run.periodYear)}`}
              subtitle={
                <span>
                  Status: <strong>{selectedRun.run.status.toUpperCase()}</strong>
                  {selectedRun.run.version > 1 && (
                    <span className="badge" style={{ marginLeft: 8, background: '#EFF6FF', color: '#1E40AF', fontWeight: 800 }}>
                      Version {selectedRun.run.version}
                    </span>
                  )}
                </span>
              }
            >
              <button className="secondary-button" type="button" onClick={() => setView('list')}>
                <ChevronLeft size={16} /> All Runs
              </button>

              {isAdmin && selectedRun.run.status === 'draft' && (
                <>
                  <button
                    className="accent-button"
                    type="button"
                    onClick={() => handleResync(selectedRun.run.id)}
                    disabled={actionLoading.resync}
                    title="Pull latest attendance and recalculate day units"
                  >
                    <RefreshCw size={14} />
                    {actionLoading.resync ? 'Syncing...' : 'Sync Attendance'}
                  </button>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => handleFinalize(selectedRun.run.id)}
                    disabled={actionLoading.finalize}
                  >
                    {actionLoading.finalize ? 'Finalizing...' : 'Finalize & Lock Run'}
                  </button>
                </>
              )}

              {isAdmin && selectedRun.run.status !== 'draft' && selectedRun.run.status !== 'superseded' && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setRegenTarget({ year: selectedRun.run.periodYear, month: selectedRun.run.periodMonth })}
                  style={{ color: '#D97706', borderColor: '#FDE68A' }}
                  title="Regenerate this payroll with paid employee protection"
                >
                  <RotateCcw size={14} /> Regenerate Payroll
                </button>
              )}
            </Header>

            {/* Older Unadjusted Advances Banner */}
            {selectedRun.olderUnadjustedAdvances && selectedRun.olderUnadjustedAdvances.length > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#92400E' }}>
                      Notice: {selectedRun.olderUnadjustedAdvances.length} Unadjusted Advance(s) Issued Prior to Period
                    </strong>
                    <div style={{ color: '#B45309', fontSize: '0.78rem', marginTop: 2 }}>
                      Advances given prior to an employee's rolling period start date were not automatically deducted.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => navigate('/app/advances')}
                  style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                >
                  View All Advances →
                </button>
              </div>
            )}

            {selectedRun.run.status === 'superseded' && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} />
                <span>
                  <strong>Note:</strong> This payroll run has been superseded by a newer version. Paid disbursements recorded here are protected and locked in subsequent versions.
                </span>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                MOBILE RUN DETAIL VIEW (<1024px)
            ════════════════════════════════════════════════════════════════ */}
            <div className="mobile-only-view">
              {/* Mobile Sticky Run Action Header */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: '14px',
                  marginBottom: 14,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Net Total Payout</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                      {formatCurrency(selectedRun.summary?.totalNet)}
                    </div>
                  </div>
                  <span className={`badge badge-${selectedRun.run.status}`}>
                    <span className="badge-dot" style={{ background: selectedRun.run.status === 'paid' ? '#10B981' : '#F59E0B' }} />
                    {selectedRun.run.status.toUpperCase()} {selectedRun.run.version > 1 ? `(v${selectedRun.run.version})` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  <span>{selectedRun.summary?.totalEmployees} Staff</span> • 
                  <span>Gross: {formatCurrency(selectedRun.summary?.totalGross)}</span>
                </div>

                {/* Quick Run Actions for Mobile */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedRun.run.status === 'draft' && isAdmin && (
                    <>
                      <button
                        type="button"
                        className="accent-button"
                        style={{ flex: 1, minHeight: 40, fontSize: '0.8rem' }}
                        onClick={() => handleResync(selectedRun.run.id)}
                        disabled={actionLoading.resync}
                      >
                        <RefreshCw size={14} /> {actionLoading.resync ? 'Syncing...' : 'Sync Attendance'}
                      </button>

                      <button
                        type="button"
                        className="primary-button"
                        style={{ flex: 1, minHeight: 40, fontSize: '0.8rem' }}
                        onClick={() => handleFinalize(selectedRun.run.id)}
                        disabled={actionLoading.finalize}
                      >
                        {actionLoading.finalize ? 'Finalizing...' : 'Finalize & Lock'}
                      </button>
                    </>
                  )}

                  {isAdmin && selectedRun.run.status !== 'draft' && selectedRun.run.status !== 'superseded' && (
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: '100%', minHeight: 40, fontSize: '0.8rem', color: '#D97706', borderColor: '#FDE68A' }}
                      onClick={() => setRegenTarget({ year: selectedRun.run.periodYear, month: selectedRun.run.periodMonth })}
                    >
                      <RotateCcw size={14} /> Regenerate Version #{selectedRun.run.version + 1}
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile Employee Payroll Summary Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedRun.lineItems.map((li) => (
                  <div
                    key={li.id}
                    className="mobile-card"
                    onClick={() => setInspectLineItem(li)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="mobile-card-top">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="mobile-card-title">{li.employeeName}</span>
                          {li.isLocked && (
                            <span className="badge" style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: '0.68rem', padding: '1px 5px' }}>
                              <Lock size={9} /> Paid
                            </span>
                          )}
                        </div>
                        <div className="mobile-card-sub">
                          Daily · {formatCurrency(li.wageRate)}/day
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--brand-teal-dark)', fontWeight: 600, marginTop: 2 }}>
                          {formatDateRange(li.periodStartDate || selectedRun.run.periodStartDate, li.periodEndDate || selectedRun.run.periodEndDate)}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div className="mobile-card-amount">{formatCurrency(li.netAmount)}</div>
                        <span className={`badge ${li.paymentStatus === 'paid' ? 'badge-paid' : 'badge-partial'}`} style={{ marginTop: 2, fontSize: '0.68rem' }}>
                          {li.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="mobile-card-bottom">
                      <div style={{ display: 'flex', gap: 6, fontSize: '0.72rem', fontWeight: 700 }}>
                        <span style={{ color: '#065F46' }}>{li.presentDays}P</span>
                        {li.overtimeDays > 0 && <span style={{ color: '#2563EB' }}>{li.overtimeDays}OT</span>}
                        {li.halfDays > 0 && <span style={{ color: '#D97706' }}>{li.halfDays}H</span>}
                        {li.absentDays > 0 && <span style={{ color: '#DC2626' }}>{li.absentDays}A</span>}
                      </div>

                      <span style={{ fontSize: '0.75rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
                        Breakdown →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                DESKTOP RUN DETAIL VIEW (>=1024px)
            ════════════════════════════════════════════════════════════════ */}
            <div className="desktop-only-view">
              {/* Summary Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: '#EFF6FF', color: 'var(--brand-navy)' }}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Active Staff</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedRun.summary?.totalEmployees}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Gross Wages</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
                      {formatCurrency(selectedRun.summary?.totalGross)}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: 'var(--brand-teal-light)', color: 'var(--brand-teal-dark)' }}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Net Disbursable</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                      {formatCurrency(selectedRun.summary?.totalNet)}
                    </div>
                  </div>
                </div>
              </div>

              <section className="panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Rolling Period</th>
                        <th>Daily Rate</th>
                        <th style={{ textAlign: 'center' }}>P</th>
                        <th style={{ textAlign: 'center' }}>H</th>
                        <th style={{ textAlign: 'center' }}>OT</th>
                        <th style={{ textAlign: 'center' }}>A</th>
                        <th style={{ textAlign: 'right' }}>Gross Pay</th>
                        <th>Adjustments & Advances</th>
                        <th style={{ textAlign: 'right' }}>Net Pay</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRun.lineItems.map((li) => (
                        <tr key={li.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong>{li.employeeName}</strong>
                              {li.isLocked && (
                                <span
                                  className="badge"
                                  style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: '0.7rem', padding: '2px 6px' }}
                                  title="Already paid in previous version. Locked against alteration."
                                >
                                  <Lock size={10} /> Locked
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.76rem', color: '#475569', whiteSpace: 'nowrap' }}>
                              {formatDateRange(li.periodStartDate || selectedRun.run.periodStartDate, li.periodEndDate || selectedRun.run.periodEndDate)}
                            </span>
                          </td>
                          <td>
                            <span className="badge" style={{ background: '#F1F5F9', color: '#475569' }}>
                              Daily · {formatCurrency(li.wageRate)}/day
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', color: '#065F46', fontWeight: 700 }}>{li.presentDays}</td>
                          <td style={{ textAlign: 'center', color: '#92400E', fontWeight: 700 }}>{li.halfDays}</td>
                          <td style={{ textAlign: 'center', color: '#1E40AF', fontWeight: 700 }}>{li.overtimeDays}</td>
                          <td style={{ textAlign: 'center', color: '#991B1B', fontWeight: 700 }}>{li.absentDays}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(li.grossAmount)}</td>
                          <td style={{ maxWidth: 240 }}>
                            {li.adjustments && li.adjustments.length > 0 ? (
                              li.adjustments.map((a) => (
                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', marginBottom: 2 }}>
                                  <span style={{ color: a.type === 'bonus' ? '#065F46' : '#991B1B', fontWeight: 700 }}>
                                    {a.type === 'bonus' ? '+' : '−'}{formatCurrency(a.amount)}
                                  </span>
                                  <span className="muted" style={{ fontSize: '0.72rem' }}>
                                    {a.label}
                                  </span>
                                  {selectedRun.run.status === 'draft' && !li.isLocked && isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAdjustment(selectedRun.run.id, li.id, a.id)}
                                      style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <span className="muted" style={{ fontSize: '0.75rem' }}>None</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--brand-navy)' }}>
                            {formatCurrency(li.netAmount)}
                          </td>
                          <td>
                            <span className={`badge ${li.paymentStatus === 'paid' ? 'badge-paid' : 'badge-partial'}`}>
                              <span className="badge-dot" style={{ background: li.paymentStatus === 'paid' ? '#10B981' : '#F59E0B' }} />
                              {li.isLocked ? 'Paid (Locked)' : li.paymentStatus}
                            </span>
                          </td>
                          <td>
                            <div className="action-row" style={{ gap: 4 }}>
                              {selectedRun.run.status === 'draft' && !li.isLocked && isAdmin && (
                                <button
                                  className="secondary-button"
                                  type="button"
                                  onClick={() => setAdjModal(li)}
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 30 }}
                                >
                                  + Adjust
                                </button>
                              )}

                              {selectedRun.run.status !== 'draft' && selectedRun.run.status !== 'superseded' && !li.isLocked && li.paymentStatus === 'pending' && isAdmin && (
                                <button
                                  className="secondary-button"
                                  type="button"
                                  onClick={() => handleMarkPaid(selectedRun.run.id, li.id)}
                                  disabled={actionLoading[li.id]}
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 30 }}
                                >
                                  Mark Paid
                                </button>
                              )}

                              <button
                                className="icon-btn"
                                type="button"
                                onClick={() => navigate(`/app/payroll/payslip/${selectedRun.run.id}/${li.id}`)}
                                style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 30 }}
                                title="Generate Payslip"
                              >
                                <FileText size={14} /> Payslip
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        ) : (
          <>
            <Header
              title="Salary & Payroll Engine"
              subtitle="Flexible rolling payroll calculation, advance deductions, and attendance-based wage payouts."
            >
              {isAdmin && (
                <button className="secondary-button" type="button" onClick={() => setView('settings')}>
                  <Settings size={16} /> Payroll Settings
                </button>
              )}
            </Header>

            {/* Mobile History View (<1024px) */}
            <div className="mobile-only-view">
              {isAdmin && (
                <div className="mobile-card" style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: 10, color: 'var(--text-main)' }}>
                    Calculate New Payroll Run
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <button
                      type="button"
                      className={generationMode === 'rolling' ? 'primary-button' : 'secondary-button'}
                      onClick={() => setGenerationMode('rolling')}
                      style={{ flex: 1, minHeight: 34, fontSize: '0.75rem' }}
                    >
                      Rolling Window
                    </button>
                    <button
                      type="button"
                      className={generationMode === 'monthly' ? 'primary-button' : 'secondary-button'}
                      onClick={() => setGenerationMode('monthly')}
                      style={{ flex: 1, minHeight: 34, fontSize: '0.75rem' }}
                    >
                      Calendar Month
                    </button>
                  </div>

                  {generationMode === 'rolling' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', display: 'block', marginBottom: 2 }}>Start Date (Optional)</label>
                        <input
                          type="date"
                          value={genStartDate}
                          onChange={(e) => setGenStartDate(e.target.value)}
                          placeholder="Auto (rolling)"
                          style={{ width: '100%', fontSize: '0.75rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', display: 'block', marginBottom: 2 }}>Cut-off End Date</label>
                        <input
                          type="date"
                          value={genEndDate}
                          onChange={(e) => setGenEndDate(e.target.value)}
                          required
                          style={{ width: '100%', fontSize: '0.75rem' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <select
                        value={genYear}
                        onChange={(e) => setGenYear(parseInt(e.target.value))}
                        style={{ width: '100%' }}
                      >
                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>

                      <select
                        value={genMonth}
                        onChange={(e) => setGenMonth(parseInt(e.target.value))}
                        style={{ width: '100%' }}
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={idx + 1} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="secondary-button"
                      type="button"
                      style={{ flex: 1, minHeight: 44 }}
                      onClick={handlePreviewRun}
                      disabled={previewing || generating}
                    >
                      <Eye size={16} /> {previewing ? 'Analyzing...' : 'Preview'}
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      style={{ flex: 1, minHeight: 44 }}
                      onClick={() => handleGenerateRun()}
                      disabled={generating || previewing}
                    >
                      <Plus size={16} /> {generating ? 'Calculating...' : 'Generate Run'}
                    </button>
                  </div>
                  {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
                </div>
              )}

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="mobile-card" style={{ height: 80, opacity: 0.6, background: '#F8FAFC' }} />
                  ))}
                </div>
              ) : runs.length === 0 ? (
                <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <Wallet size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                  <p className="muted" style={{ margin: 0 }}>No payroll runs recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {runs.map((r) => (
                    <div
                      key={r.id}
                      className="mobile-card"
                      onClick={() => handleOpenRun(r.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="mobile-card-top">
                        <div>
                          <div className="mobile-card-title">
                            {formatDateRange(r.periodStartDate, r.periodEndDate, r.periodMonth, r.periodYear)}
                          </div>
                          <div className="mobile-card-sub">
                            Generated on {new Date(r.createdAt).toLocaleDateString('en-IN')}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span className={`badge badge-${r.status}`}>
                            <span className="badge-dot" style={{ background: r.status === 'paid' ? '#10B981' : '#F59E0B' }} />
                            {r.status}
                          </span>
                          <span className="badge" style={{ display: 'block', marginTop: 4, background: '#F1F5F9', color: '#1E293B', fontWeight: 700, fontSize: '0.68rem' }}>
                            v{r.version || 1}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card-bottom">
                        <span style={{ fontSize: '0.75rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
                          Open Run & Line Items →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop Payroll History View (>=1024px) */}
            <div className="desktop-only-view">
              {isAdmin && (
                <section className="panel" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <p style={{ fontWeight: 700, margin: 0 }}>Calculate New Payroll Run</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className={generationMode === 'rolling' ? 'primary-button' : 'secondary-button'}
                        onClick={() => setGenerationMode('rolling')}
                        style={{ minHeight: 32, fontSize: '0.78rem', padding: '2px 10px' }}
                      >
                        Rolling Period (Auto)
                      </button>
                      <button
                        type="button"
                        className={generationMode === 'monthly' ? 'primary-button' : 'secondary-button'}
                        onClick={() => setGenerationMode('monthly')}
                        style={{ minHeight: 32, fontSize: '0.78rem', padding: '2px 10px' }}
                      >
                        Calendar Month
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {generationMode === 'rolling' ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>From:</label>
                          <input
                            type="date"
                            value={genStartDate}
                            onChange={(e) => setGenStartDate(e.target.value)}
                            placeholder="Auto (employee last run + 1)"
                            style={{ padding: '8px 12px', borderRadius: 8, minHeight: 40, border: '1px solid var(--border-color)' }}
                            title="Leave blank to automatically default to each employee's last period end + 1 day"
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Cut-off To:</label>
                          <input
                            type="date"
                            value={genEndDate}
                            onChange={(e) => setGenEndDate(e.target.value)}
                            required
                            style={{ padding: '8px 12px', borderRadius: 8, minHeight: 40, border: '1px solid var(--border-color)' }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <select
                          value={genYear}
                          onChange={(e) => setGenYear(parseInt(e.target.value))}
                          style={{ padding: '8px 12px', borderRadius: 8, minHeight: 40 }}
                        >
                          {[2024, 2025, 2026, 2027, 2028].map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>

                        <select
                          value={genMonth}
                          onChange={(e) => setGenMonth(parseInt(e.target.value))}
                          style={{ padding: '8px 12px', borderRadius: 8, minHeight: 40 }}
                        >
                          {MONTH_NAMES.map((m, idx) => (
                            <option key={idx + 1} value={idx + 1}>{m}</option>
                          ))}
                        </select>
                      </>
                    )}

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={handlePreviewRun}
                      disabled={previewing || generating}
                    >
                      <Eye size={16} /> {previewing ? 'Analyzing...' : 'Preview Run'}
                    </button>

                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => handleGenerateRun()}
                      disabled={generating || previewing}
                    >
                      <Plus size={16} /> {generating ? 'Calculating...' : 'Generate Run'}
                    </button>
                  </div>
                  {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}
                </section>
              )}

              <section className="panel">
                <div className="section-header">
                  <h2 style={{ margin: 0 }}>Payroll History</h2>
                </div>

                {loading ? (
                  <p className="muted" style={{ padding: 20 }}>Loading runs...</p>
                ) : runs.length === 0 ? (
                  <div className="empty-state">
                    <Wallet size={40} />
                    <p>No payroll runs recorded yet. Generate your first run above.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Period Window</th>
                          <th>Version</th>
                          <th>Run Status</th>
                          <th>Generated On</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{formatDateRange(r.periodStartDate, r.periodEndDate, r.periodMonth, r.periodYear)}</strong>
                            </td>
                            <td>
                              <span className="badge" style={{ background: '#F1F5F9', color: '#1E293B', fontWeight: 700 }}>
                                v{r.version || 1}
                              </span>
                            </td>
                            <td>
                              <span className={`badge badge-${r.status}`}>
                                <span className="badge-dot" style={{ background: r.status === 'finalized' ? '#0284C7' : r.status === 'paid' ? '#10B981' : r.status === 'superseded' ? '#64748B' : '#F59E0B' }} />
                                {r.status}
                              </span>
                            </td>
                            <td className="muted">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                            <td>
                              <div className="action-row" style={{ gap: 6 }}>
                                <button
                                  className="icon-btn"
                                  type="button"
                                  onClick={() => handleOpenRun(r.id)}
                                >
                                  Open Run →
                                </button>

                                {isAdmin && r.status !== 'draft' && r.status !== 'superseded' && (
                                  <button
                                    className="icon-btn"
                                    type="button"
                                    onClick={() => setRegenTarget({ year: r.periodYear, month: r.periodMonth })}
                                    style={{ color: '#D97706' }}
                                    title="Regenerate this payroll"
                                  >
                                    <RotateCcw size={12} /> Regenerate
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
          </>
        )}
      </section>

      {previewModalData && (
        <PreviewRunModal
          previewData={previewModalData}
          onClose={() => setPreviewModalData(null)}
          onConfirm={async () => {
            await handleGenerateRun();
          }}
          generating={generating}
        />
      )}

      {adjModal && selectedRun && (
        <AdjustmentModal
          runId={selectedRun.run.id}
          lineItem={adjModal}
          onClose={() => setAdjModal(null)}
          onSaved={async () => {
            setAdjModal(null);
            await refreshRunDetail();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}

      {regenTarget && (
        <RegeneratePayrollModal
          year={regenTarget.year}
          month={regenTarget.month}
          onClose={() => setRegenTarget(null)}
          onRegenerated={async (newRunResult) => {
            setRegenTarget(null);
            await loadRuns();
            setSelectedRun(newRunResult);
            setView('detail');
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}

      {/* Mobile Employee Salary Breakdown Bottom Sheet */}
      <BottomSheet
        isOpen={Boolean(inspectLineItem)}
        onClose={() => setInspectLineItem(null)}
        title={inspectLineItem ? `${inspectLineItem.employeeName} — Salary Breakdown` : 'Salary Breakdown'}
      >
        {inspectLineItem && (
          <div>
            <div className="mobile-user-card" style={{ marginBottom: 16 }}>
              <div className="mobile-user-avatar">
                {inspectLineItem.employeeName.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mobile-user-name">{inspectLineItem.employeeName}</div>
                <div className="mobile-user-sub">
                  Daily Rate · {formatCurrency(inspectLineItem.wageRate)}/day
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: 4 }}>
                  {formatCurrency(inspectLineItem.netAmount)} Net Pay
                </div>
              </div>
            </div>

            {/* Attendance & Wage Units Summary */}
            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 14 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
                Attendance Units
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
                <div style={{ background: '#D1FAE5', padding: '6px 2px', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#065F46' }}>{inspectLineItem.presentDays}</div>
                  <div style={{ fontSize: '0.65rem', color: '#065F46', fontWeight: 700 }}>Present</div>
                </div>
                <div style={{ background: '#DBEAFE', padding: '6px 2px', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E40AF' }}>{inspectLineItem.overtimeDays}</div>
                  <div style={{ fontSize: '0.65rem', color: '#1E40AF', fontWeight: 700 }}>Overtime</div>
                </div>
                <div style={{ background: '#FEF3C7', padding: '6px 2px', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#92400E' }}>{inspectLineItem.halfDays}</div>
                  <div style={{ fontSize: '0.65rem', color: '#92400E', fontWeight: 700 }}>Half Day</div>
                </div>
                <div style={{ background: '#FEE2E2', padding: '6px 2px', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#991B1B' }}>{inspectLineItem.absentDays}</div>
                  <div style={{ fontSize: '0.65rem', color: '#991B1B', fontWeight: 700 }}>Absent</div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Calculated Gross:</span>
                <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(inspectLineItem.grossAmount)}</strong>
              </div>
            </div>

            {/* Adjustments & Advance Deductions */}
            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>Adjustments & Advances</span>
                {selectedRun?.run?.status === 'draft' && !inspectLineItem.isLocked && isAdmin && (
                  <button
                    type="button"
                    className="accent-button"
                    style={{ minHeight: 28, fontSize: '0.72rem', padding: '2px 8px' }}
                    onClick={() => {
                      const li = inspectLineItem;
                      setInspectLineItem(null);
                      setAdjModal(li);
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>

              {inspectLineItem.adjustments && inspectLineItem.adjustments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {inspectLineItem.adjustments.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#FFFFFF',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div>
                        <span style={{ color: a.type === 'bonus' ? '#065F46' : '#991B1B', fontWeight: 700, fontSize: '0.8rem' }}>
                          {a.type === 'bonus' ? '+' : '−'}{formatCurrency(a.amount)}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.label}</div>
                      </div>

                      {selectedRun?.run?.status === 'draft' && !inspectLineItem.isLocked && isAdmin && (
                        <button
                          type="button"
                          onClick={async () => {
                            await handleRemoveAdjustment(selectedRun.run.id, inspectLineItem.id, a.id);
                            setInspectLineItem(null);
                          }}
                          style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', padding: 4 }}
                          title="Remove adjustment"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: '0.75rem' }}>No manual adjustments or advances applied.</p>
              )}
            </div>

            {/* Quick Actions Footer inside Bottom Sheet */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedRun?.run?.status !== 'draft' && selectedRun?.run?.status !== 'superseded' && !inspectLineItem.isLocked && inspectLineItem.paymentStatus === 'pending' && isAdmin && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ width: '100%', minHeight: 44 }}
                  onClick={async () => {
                    const li = inspectLineItem;
                    setInspectLineItem(null);
                    await handleMarkPaid(selectedRun.run.id, li.id);
                  }}
                >
                  Mark Paid
                </button>
              )}

              <button
                type="button"
                className="primary-button"
                style={{ width: '100%', minHeight: 44 }}
                onClick={() => {
                  const li = inspectLineItem;
                  setInspectLineItem(null);
                  navigate(`/app/payroll/payslip/${selectedRun.run.id}/${li.id}`);
                }}
              >
                <FileText size={16} /> View & Download Payslip
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </main>
  );
}
