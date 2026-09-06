import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, CheckCircle2, X, Save } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { listBills, createBill, updateBillStatus } from '../api/billing.js';
import { listProjects } from '../api/projects.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { FloatingActionButton } from '../components/FloatingActionButton.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function BillModal({ projects, onClose, onSaved, authenticatedRequest }) {
  const [form, setForm] = useState({
    vendorName: '',
    billNumber: '',
    projectId: '',
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    subtotal: '',
    taxAmount: 0,
    totalAmount: '',
    notes: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setField = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'subtotal' || k === 'taxAmount') {
        const sub = parseFloat(k === 'subtotal' ? v : next.subtotal) || 0;
        const tax = parseFloat(k === 'taxAmount' ? v : next.taxAmount) || 0;
        next.totalAmount = (sub + tax).toFixed(2);
      }
      return next;
    });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.vendorName.trim()) {
      setError('Please enter a vendor name.');
      return;
    }
    const tot = parseFloat(form.totalAmount) || parseFloat(form.subtotal) || 0;
    if (tot <= 0) {
      setError('Please enter a valid bill amount.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createBill(authenticatedRequest, {
        vendorName: form.vendorName.trim(),
        billNumber: form.billNumber?.trim() || null,
        billDate: form.billDate,
        dueDate: form.dueDate?.trim() || null,
        totalAmount: tot,
        description: form.notes?.trim() || null
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to record bill.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>Record Vendor Bill</h3>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              {error && <p className="form-error">{error}</p>}

              <div className="form-grid">
                <label>
                  Vendor / Supplier Name
                  <input
                    value={form.vendorName}
                    onChange={(e) => setField('vendorName', e.target.value)}
                    placeholder="e.g. Timber & Plywood Mart"
                    required
                  />
                </label>

                <label>
                  Vendor Invoice / Bill #
                  <input
                    value={form.billNumber}
                    onChange={(e) => setField('billNumber', e.target.value)}
                    placeholder="INV-9821"
                    required
                  />
                </label>
              </div>

              <label>
                Site Project
                <select value={form.projectId} onChange={(e) => setField('projectId', e.target.value)}>
                  <option value="">General Overhead</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <div className="form-grid">
                <label>
                  Bill Date
                  <input
                    type="date"
                    value={form.billDate}
                    onChange={(e) => setField('billDate', e.target.value)}
                    required
                  />
                </label>

                <label>
                  Due Date
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setField('dueDate', e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Subtotal (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.subtotal}
                    onChange={(e) => setField('subtotal', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </label>

                <label>
                  Tax / GST Amount (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.taxAmount}
                    onChange={(e) => setField('taxAmount', e.target.value)}
                    placeholder="0.00"
                  />
                </label>
              </div>

              <label>
                Total Billed Amount (₹)
                <input
                  type="number"
                  value={form.totalAmount}
                  readOnly
                  style={{ background: '#F8FAFC', fontWeight: 800, color: 'var(--brand-navy)' }}
                />
              </label>
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', background: '#F8FAFC', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
              Bill Total: {formatCurrency(form.totalAmount || 0)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving Bill...' : 'Save Vendor Bill'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BillsPage() {
  const { user, authenticatedRequest } = useAuth();
  const [bills, setBills] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const canManageBills = user?.role === 'TenantAdmin' || user?.role === 'Accountant';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [billData, projData] = await Promise.all([
        listBills(authenticatedRequest),
        listProjects(authenticatedRequest)
      ]);
      setBills(billData);
      setProjects(projData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleStatusUpdate(id, status) {
    if (!canManageBills) {
      alert('You do not have permission to update vendor bill status.');
      return;
    }
    try {
      await updateBillStatus(authenticatedRequest, id, status);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <PullToRefresh onRefresh={loadData}>
          <Header
            title="Vendor Bills & Payables"
            subtitle="Track raw material supplier invoices, payment terms, and vendor balances."
          >
            {canManageBills && (
              <button className="primary-button" type="button" onClick={() => setShowModal(true)}>
                <Plus size={16} /> Record Vendor Bill
              </button>
            )}
          </Header>

          {error && <p className="form-error" style={{ marginBottom: 20 }}>{error}</p>}

          {/* MOBILE VIEW (<1024px) */}
          <div className="mobile-only-view">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="mobile-card" style={{ height: 80, opacity: 0.6, background: '#F8FAFC' }} />
                ))}
              </div>
            ) : bills.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                <FileText size={36} color="#64748B" style={{ margin: '0 auto 8px' }} />
                <p className="muted" style={{ margin: 0 }}>No vendor bills recorded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bills.map((b) => (
                  <div key={b.id} className="mobile-card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--brand-navy)' }}>
                          {b.vendorName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          Bill #{b.billNumber} {b.projectName ? `· ${b.projectName}` : ''}
                        </div>
                      </div>
                      <span className={`badge ${b.status === 'paid' ? 'badge-paid' : 'badge-overdue'}`}>
                        <span className="badge-dot" style={{ background: b.status === 'paid' ? '#10B981' : '#DC2626' }} />
                        {b.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #CBD5E1' }}>
                      <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                        <div>Date: {b.billDate}</div>
                        {b.dueDate && <div>Due: {b.dueDate}</div>}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--brand-navy)', fontSize: '1.05rem' }}>
                          {formatCurrency(b.totalAmount)}
                        </div>
                        {canManageBills && b.status !== 'paid' && (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleStatusUpdate(b.id, 'paid')}
                            style={{ fontSize: '0.76rem', minHeight: 36, padding: '4px 10px', marginTop: 4, touchAction: 'manipulation' }}
                          >
                            <CheckCircle2 size={13} /> Mark Settled
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DESKTOP VIEW (>=1024px) */}
          <div className="desktop-only-view">
            <section className="panel">
              <div className="section-header">
                <h2 style={{ margin: 0 }}>Vendor Bills ({bills.length})</h2>
              </div>

              {loading ? (
                <p className="muted" style={{ padding: 20 }}>Loading bills...</p>
              ) : bills.length === 0 ? (
                <div className="empty-state">
                  <FileText size={40} />
                  <p>No vendor bills recorded yet. Click "Record Vendor Bill" to log one.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Bill #</th>
                        <th>Date</th>
                        <th>Due Date</th>
                        <th style={{ textAlign: 'right' }}>Total Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <strong>{b.vendorName}</strong>
                            {b.projectName && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{b.projectName}</div>}
                          </td>
                          <td>{b.billNumber}</td>
                          <td className="muted">{b.billDate}</td>
                          <td className="muted">{b.dueDate || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--brand-navy)' }}>
                            {formatCurrency(b.totalAmount)}
                          </td>
                          <td>
                            <span className={`badge ${b.status === 'paid' ? 'badge-paid' : 'badge-overdue'}`}>
                              <span className="badge-dot" style={{ background: b.status === 'paid' ? '#10B981' : '#DC2626' }} />
                              {b.status}
                            </span>
                          </td>
                          <td>
                            {canManageBills && b.status !== 'paid' && (
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => handleStatusUpdate(b.id, 'paid')}
                                style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 30 }}
                              >
                                <CheckCircle2 size={12} /> Mark Settled
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {canManageBills && (
            <FloatingActionButton
              label="Record Bill"
              onClick={() => setShowModal(true)}
            />
          )}
        </PullToRefresh>
      </section>

      {showModal && (
        <BillModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={async () => {
            setShowModal(false);
            await loadData();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}
    </main>
  );
}
