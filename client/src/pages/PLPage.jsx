import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart,
  Receipt,
  Camera,
  X
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import {
  getBusinessPL,
  getProjectPL,
  addExpense,
  addIncome
} from '../api/pl.js';
import { listProjects } from '../api/projects.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { FloatingActionButton } from '../components/FloatingActionButton.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function ExpenseModal({ projects, onClose, onSaved, authenticatedRequest }) {
  const [form, setForm] = useState({
    projectId: '',
    category: 'material',
    description: '',
    amount: '',
    entryDate: new Date().toISOString().slice(0, 10),
    receiptUrl: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addExpense(authenticatedRequest, {
        ...form,
        amount: parseFloat(form.amount),
        projectId: form.projectId || null,
        receiptUrl: form.receiptUrl.trim() || null
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to log expense.');
    } finally {
      setSaving(false);
    }
  }

  function handleReceiptFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setField('receiptUrl', evt.target?.result || '');
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>Record Project Expense</h3>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              {error && <p className="form-error">{error}</p>}
              <label>
                Site Project (Optional)
                <select value={form.projectId} onChange={(e) => setField('projectId', e.target.value)}>
                  <option value="">General Overhead / Unassigned</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <div className="form-grid">
                <label>
                  Category
                  <select value={form.category} onChange={(e) => setField('category', e.target.value)}>
                    <option value="material">Raw Materials (Wood, Steel, Concrete)</option>
                    <option value="equipment">Equipment & Machinery</option>
                    <option value="subcontract">Subcontractor Labor</option>
                    <option value="misc">Miscellaneous / Logistics</option>
                  </select>
                </label>

                <label>
                  Amount (₹)
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

              <label>
                Description / Vendor Note
                <input
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="e.g. Teak wood planks from Timber Supply Co."
                  required
                />
              </label>

              <div className="form-grid">
                <label>
                  Date
                  <input
                    type="date"
                    value={form.entryDate}
                    onChange={(e) => setField('entryDate', e.target.value)}
                    required
                  />
                </label>

                <label>
                  Receipt / Invoice Attachment
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <label
                      className="secondary-button"
                      style={{
                        minHeight: 44,
                        flex: 1,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: '0.82rem',
                        margin: 0,
                        touchAction: 'manipulation'
                      }}
                    >
                      <Camera size={16} /> Snap Photo / Upload
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        onChange={handleReceiptFile}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  {form.receiptUrl && (
                    <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: 4, fontWeight: 600 }}>
                      ✓ Receipt image attached
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Recording...' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PLPage() {
  const { authenticatedRequest } = useAuth();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectMargins, setProjectMargins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expenseModal, setExpenseModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plData, projList] = await Promise.all([
        getBusinessPL(authenticatedRequest, year, month),
        listProjects(authenticatedRequest)
      ]);

      setSummary(plData.summary);
      setTrend(plData.trend || []);
      setProjects(projList);
      setProjectMargins(plData.projects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const maxVal = Math.max(...trend.map((t) => Math.max(t.income, t.expense)), 1000);

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <PullToRefresh onRefresh={loadData}>
          <Header
            title="Profit & Loss Financials"
            subtitle="Real-time margin intelligence, business rollup, and automated labor expenses."
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                style={{ padding: '6px 10px', borderRadius: 8 }}
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                style={{ padding: '6px 10px', borderRadius: 8 }}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>

              <button
                className="primary-button"
                type="button"
                onClick={() => setExpenseModal(true)}
              >
                <Plus size={16} /> Log Expense
              </button>
            </div>
          </Header>

          {error && <p className="form-error" style={{ marginBottom: 20 }}>{error}</p>}

          {/* ════════════════════════════════════════════════════════════════
              MOBILE P&L VIEW (<1024px)
          ════════════════════════════════════════════════════════════════ */}
          <div className="mobile-only-view">
            {/* Mobile Period Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                style={{ width: '100%' }}
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                style={{ width: '100%' }}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Mobile Financial Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div className="mobile-card" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ArrowUpRight size={16} color="#059669" />
                  <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 700 }}>Revenue</span>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>
                  {formatCurrency(summary?.totalIncome)}
                </div>
              </div>

              <div className="mobile-card" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ArrowDownRight size={16} color="#DC2626" />
                  <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 700 }}>Expenses</span>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#DC2626' }}>
                  {formatCurrency(summary?.totalExpense)}
                </div>
              </div>
            </div>

            {/* Net Margin Card */}
            <div
              className="mobile-card"
              style={{
                marginBottom: 16,
                background: (summary?.netProfit || 0) >= 0 ? '#F0FDF4' : '#FEF2F2',
                borderColor: (summary?.netProfit || 0) >= 0 ? '#BBF7D0' : '#FECACA'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: (summary?.netProfit || 0) >= 0 ? '#166534' : '#991B1B' }}>
                  Net Margin Profit
                </span>
                <span className={`badge ${ (summary?.netProfit || 0) >= 0 ? 'badge-active' : 'badge-overdue' }`}>
                  {summary?.marginPercentage || 0}%
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: (summary?.netProfit || 0) >= 0 ? '#166534' : '#991B1B' }}>
                {formatCurrency(summary?.netProfit)}
              </div>
            </div>

            {/* Mobile Project Margins List */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 8, color: 'var(--text-main)' }}>
                Site Project Margins ({projectMargins.length})
              </div>

              {projectMargins.length === 0 ? (
                <div className="mobile-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <p className="muted" style={{ margin: 0 }}>No active site project data for this period.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {projectMargins.map((p) => {
                    const net = p.netProfit || 0;
                    return (
                      <div key={p.id} className="mobile-card">
                        <div className="mobile-card-top">
                          <div>
                            <div className="mobile-card-title">{p.name}</div>
                            <div className="mobile-card-sub">{p.clientName || 'General Project'}</div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div className="mobile-card-amount" style={{ color: net >= 0 ? '#059669' : '#DC2626' }}>
                              {formatCurrency(net)}
                            </div>
                            <span className={`badge ${net >= 0 ? 'badge-active' : 'badge-overdue'}`} style={{ marginTop: 2, fontSize: '0.68rem' }}>
                              {p.marginPercentage || 0}% margin
                            </span>
                          </div>
                        </div>

                        <div className="mobile-card-bottom">
                          <span style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 700 }}>
                            Billed: {formatCurrency(p.income)}
                          </span>
                          <span style={{ color: '#DC2626', fontSize: '0.72rem', fontWeight: 700 }}>
                            Costs: {formatCurrency(p.expense)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <FloatingActionButton
              label="Log Expense"
              onClick={() => setExpenseModal(true)}
            />
          </div>

          {/* ════════════════════════════════════════════════════════════════
              DESKTOP VIEW (>=1024px) — 100% UNTOUCHED
          ════════════════════════════════════════════════════════════════ */}
          <div className="desktop-only-view">
            {/* Top Financial Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
                  <ArrowUpRight size={24} />
                </div>
                <div>
                  <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Revenue</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
                    {formatCurrency(summary?.totalIncome)}
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-wrap" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  <ArrowDownRight size={24} />
                </div>
                <div>
                  <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Total Expenses (Inc. Labor)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626' }}>
                    {formatCurrency(summary?.totalExpense)}
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div
                  className="stat-icon-wrap"
                  style={{
                    background: (summary?.netProfit || 0) >= 0 ? 'var(--brand-teal-light)' : '#FEF2F2',
                    color: (summary?.netProfit || 0) >= 0 ? 'var(--brand-navy)' : '#DC2626'
                  }}
                >
                  <TrendingUp size={24} />
                </div>
                <div>
                  <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    Net Margin ({summary?.marginPercentage || 0}%)
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (summary?.netProfit || 0) >= 0 ? 'var(--brand-navy)' : '#DC2626' }}>
                    {formatCurrency(summary?.netProfit)}
                  </div>
                </div>
              </div>
            </div>

            {/* 12-Month Performance Trend Chart */}
            <section className="panel" style={{ marginBottom: 24 }}>
              <div className="section-header">
                <h2 style={{ margin: 0 }}>12-Month Annual Financial Performance ({year})</h2>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.82rem', fontWeight: 700 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: '#059669', width: 10, height: 10, borderRadius: 2 }} /> Revenue
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: '#DC2626', width: 10, height: 10, borderRadius: 2 }} /> Expenses
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, paddingTop: 20 }}>
                {trend.map((t, idx) => {
                  const incH = Math.round((t.income / maxVal) * 130);
                  const expH = Math.round((t.expense / maxVal) * 130);

                  return (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
                        <div
                          style={{
                            width: 12,
                            height: `${Math.max(incH, 2)}px`,
                            background: '#059669',
                            borderRadius: '3px 3px 0 0'
                          }}
                          title={`Income: ${formatCurrency(t.income)}`}
                        />
                        <div
                          style={{
                            width: 12,
                            height: `${Math.max(expH, 2)}px`,
                            background: '#DC2626',
                            borderRadius: '3px 3px 0 0'
                          }}
                          title={`Expense: ${formatCurrency(t.expense)}`}
                        />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                        {MONTH_NAMES[t.month - 1]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Project Margins Breakdown */}
            <section className="panel">
              <div className="section-header">
                <h2 style={{ margin: 0 }}>Site Project Profitability</h2>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Site Project</th>
                      <th>Client</th>
                      <th style={{ textAlign: 'right' }}>Total Billed</th>
                      <th style={{ textAlign: 'right' }}>Direct Costs</th>
                      <th style={{ textAlign: 'right' }}>Net Profit</th>
                      <th style={{ textAlign: 'right' }}>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectMargins.map((p) => {
                      const net = p.netProfit || 0;
                      return (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td className="muted">{p.clientName || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                            {formatCurrency(p.income)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>
                            {formatCurrency(p.expense)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: net >= 0 ? 'var(--brand-navy)' : '#DC2626' }}>
                            {formatCurrency(net)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>
                            <span className={`badge ${net >= 0 ? 'badge-active' : 'badge-overdue'}`}>
                              {p.marginPercentage || 0}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </PullToRefresh>
      </section>

      {expenseModal && (
        <ExpenseModal
          projects={projects}
          onClose={() => setExpenseModal(false)}
          onSaved={async () => {
            setExpenseModal(false);
            await loadData();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}
    </main>
  );
}
