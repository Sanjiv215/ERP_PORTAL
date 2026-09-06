import { useCallback, useEffect, useState } from 'react';
import {
  Receipt,
  Plus,
  CreditCard,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  X,
  Trash2,
  Save,
  FileDown,
  Lock,
  FileSignature
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import {
  listInvoices,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  downloadInvoicePdf
} from '../api/billing.js';
import { listProjects } from '../api/projects.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { BottomSheet } from '../components/BottomSheet.jsx';
import { FloatingActionButton } from '../components/FloatingActionButton.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const STATUS_BADGES = {
  draft: { bg: '#F1F5F9', color: '#475569' },
  sent: { bg: '#DBEAFE', color: '#1E40AF' },
  partial: { bg: '#FEF3C7', color: '#92400E' },
  paid: { bg: '#D1FAE5', color: '#065F46' },
  overdue: { bg: '#FEE2E2', color: '#991B1B' },
  cancelled: { bg: '#F1F5F9', color: '#94A3B8' }
};

function createBlankRow(srNo = 1) {
  return {
    id: Math.random().toString(),
    srNo,
    description: '',
    sizes: [''],
    unit: 'sft',
    qty: '',
    unitPrice: '',
    amount: 0
  };
}

function InvoiceModal({ projects, onClose, onSaved, authenticatedRequest }) {
  const [form, setForm] = useState({
    clientName: '',
    clientAddress: '',
    siteName: '',
    includeSignature: true,
    projectId: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    notes: 'Please remit payment within 15 days of invoice date.'
  });

  const [lineItems, setLineItems] = useState(() => [
    createBlankRow(1),
    createBlankRow(2),
    createBlankRow(3)
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function updateRowField(index, field, value) {
    setLineItems((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };

      if (field === 'qty' || field === 'unitPrice') {
        const q = Number(field === 'qty' ? value : row.qty) || 0;
        const r = Number(field === 'unitPrice' ? value : row.unitPrice) || 0;
        row.amount = Math.round(q * r * 100) / 100;
      }
      next[index] = row;
      return next;
    });
  }

  function addSizeChip(rowIndex) {
    setLineItems((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };
      row.sizes = [...(row.sizes || []), ''];
      next[rowIndex] = row;
      return next;
    });
  }

  function updateSizeChip(rowIndex, sizeIndex, val) {
    setLineItems((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };
      const sizes = [...(row.sizes || [])];
      sizes[sizeIndex] = val;
      row.sizes = sizes;
      next[rowIndex] = row;
      return next;
    });
  }

  function removeSizeChip(rowIndex, sizeIndex) {
    setLineItems((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };
      const sizes = (row.sizes || []).filter((_, i) => i !== sizeIndex);
      row.sizes = sizes.length > 0 ? sizes : [''];
      next[rowIndex] = row;
      return next;
    });
  }

  function addRow() {
    setLineItems((prev) => [...prev, createBlankRow(prev.length + 1)]);
  }

  function deleteRow(index) {
    if (lineItems.length === 1) {
      setLineItems([createBlankRow(1)]);
      return;
    }
    setLineItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((r, idx) => ({ ...r, srNo: idx + 1 }));
    });
  }

  const subtotal = lineItems.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const total = subtotal; // 0% GST

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientName.trim()) {
      setError('Please enter a client name.');
      return;
    }
    const filledRows = lineItems.filter((r) => r.description.trim().length > 0);
    if (filledRows.length === 0) {
      setError('Please fill in at least one line item with a description.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createInvoice(authenticatedRequest, {
        clientName: form.clientName.trim(),
        clientAddress: form.clientAddress?.trim() || null,
        siteName: form.siteName?.trim() || null,
        includeSignature: Boolean(form.includeSignature),
        projectId: form.projectId || null,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate?.trim() || null,
        gstRate: 0,
        notes: form.notes?.trim() || null,
        lineItems: filledRows.map((r, idx) => {
          const cleanedSizes = (r.sizes || []).map((s) => s.trim()).filter(Boolean);
          const q = Number(r.qty) || 0;
          const rate = Number(r.unitPrice) || 0;
          return {
            srNo: idx + 1,
            description: r.description.trim(),
            sizes: cleanedSizes,
            size: cleanedSizes.length > 0 ? cleanedSizes.join(', ') : null,
            unit: r.unit === 'rft' ? 'rft' : 'sft',
            qty: q > 0 ? q : 1,
            unitPrice: rate,
            amount: Math.round((q > 0 ? q : 1) * rate * 100) / 100
          };
        })
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 940, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-navy)' }}>Create Client Tax Invoice</h2>
            <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>7-column tax invoice with site name, multi-size breakdown, and digital signature toggle.</p>
          </div>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: 0 }}>
          <div style={{ padding: '16px 20px' }}>
            {error && <p className="form-error" style={{ marginBottom: 14 }}>{error}</p>}

            <div className="form-stack">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <label>
                  Client Name *
                  <input
                    type="text"
                    required
                    value={form.clientName}
                    onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                    placeholder="e.g. Apex Living Infra"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6 }}
                  />
                </label>

                <label>
                  Site Name / Location
                  <input
                    type="text"
                    value={form.siteName}
                    onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                    placeholder="e.g. Tower B - Penthouse 14"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6 }}
                  />
                </label>

                <label>
                  Linked Project
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6 }}
                  >
                    <option value="">-- No Project (Direct Client) --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                    ))}
                  </select>
                </label>

                <label>
                  Invoice Date *
                  <input
                    type="date"
                    required
                    value={form.invoiceDate}
                    onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6 }}
                  />
                </label>

                <label>
                  Due Date
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6 }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
                <label>
                  Client Billing Address
                  <input
                    type="text"
                    value={form.clientAddress}
                    onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
                    placeholder="Street address, city, state, PIN"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6 }}
                  />
                </label>

                <div style={{ paddingTop: 18 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                    <input
                      type="checkbox"
                      checked={form.includeSignature}
                      onChange={(e) => setForm({ ...form, includeSignature: e.target.checked })}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <FileSignature size={16} />
                    Include Digital Signature
                  </label>
                </div>
              </div>

              {/* ── 7-Column Line Item Table ─────────────────────────────────── */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--brand-navy)' }}>
                    Line Items
                  </span>
                  <button type="button" className="secondary-button" onClick={addRow} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                    <Plus size={14} /> Add Row
                  </button>
                </div>

                {/* DESKTOP TABLE VIEW (>=768px) */}
                <div className="desktop-only-view" style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflowX: 'auto', background: '#FFFFFF' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#0F5394', color: '#FFFFFF', textAlign: 'left' }}>
                        <th style={{ width: 44, padding: '8px 6px', textAlign: 'center' }}>Sr.</th>
                        <th style={{ minWidth: 200, padding: '8px 10px' }}>Description</th>
                        <th style={{ minWidth: 190, padding: '8px 10px' }}>Size(s)</th>
                        <th style={{ width: 80, padding: '8px 6px', textAlign: 'center' }}>Unit</th>
                        <th style={{ width: 90, padding: '8px 6px', textAlign: 'right' }}>Quantity</th>
                        <th style={{ width: 95, padding: '8px 6px', textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ width: 105, padding: '8px 8px', textAlign: 'right' }}>Amount (₹)</th>
                        <th style={{ width: 34, padding: '8px 4px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((row, rIdx) => (
                        <tr key={row.id || rIdx} style={{ borderBottom: '1px solid #E2E8F0', background: rIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748B', padding: '6px 4px' }}>
                            {rIdx + 1}
                          </td>

                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => updateRowField(rIdx, 'description', e.target.value)}
                              placeholder="e.g. Living Room Paneling"
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 4, fontWeight: 600 }}
                            />
                          </td>

                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              {(row.sizes || []).map((sz, sIdx) => (
                                <div
                                  key={sIdx}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: '#ECF8FA',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: 4,
                                    padding: '2px 4px'
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={sz}
                                    onChange={(e) => updateSizeChip(rIdx, sIdx, e.target.value)}
                                    placeholder="e.g. 3x7"
                                    style={{
                                      width: 60,
                                      border: 'none',
                                      background: 'transparent',
                                      padding: '2px 2px',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      color: 'var(--brand-navy)'
                                    }}
                                  />
                                  {(row.sizes || []).length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeSizeChip(rIdx, sIdx)}
                                      style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', padding: '0 2px' }}
                                      title="Remove size"
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addSizeChip(rIdx)}
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px dashed #0F5394',
                                  color: '#0F5394',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 2
                                }}
                                title="Add size to row"
                              >
                                <Plus size={11} /> Size
                              </button>
                            </div>
                          </td>

                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <select
                              value={row.unit}
                              onChange={(e) => updateRowField(rIdx, 'unit', e.target.value)}
                              style={{ width: '100%', padding: '6px 4px', borderRadius: 4, fontWeight: 700, textAlign: 'center', color: 'var(--brand-navy)' }}
                            >
                              <option value="sft">sft</option>
                              <option value="rft">rft</option>
                            </select>
                          </td>

                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="number"
                              step="any"
                              value={row.qty}
                              onChange={(e) => updateRowField(rIdx, 'qty', e.target.value)}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '6px 6px', textAlign: 'right', borderRadius: 4, fontWeight: 700 }}
                            />
                          </td>

                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="number"
                              step="any"
                              value={row.unitPrice}
                              onChange={(e) => updateRowField(rIdx, 'unitPrice', e.target.value)}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '6px 6px', textAlign: 'right', borderRadius: 4, fontWeight: 600 }}
                            />
                          </td>

                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-navy)', fontSize: '0.88rem' }}>
                            {formatCurrency(row.amount)}
                          </td>

                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => deleteRow(rIdx)}
                              style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', padding: 2 }}
                              title="Delete Row"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARD BUILDER (<768px) */}
                <div className="mobile-only-view">
                  {lineItems.map((row, rIdx) => (
                    <div key={row.id || rIdx} className="mobile-builder-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: 'var(--brand-navy)', fontSize: '0.88rem' }}>
                          Item #{rIdx + 1}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 800, color: 'var(--brand-teal-dark)', fontSize: '0.95rem' }}>
                            {formatCurrency(row.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteRow(rIdx)}
                            style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', padding: 4, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <label style={{ fontSize: '0.78rem', margin: 0 }}>
                        Description
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRowField(rIdx, 'description', e.target.value)}
                          placeholder="e.g. Living Room Paneling"
                          style={{ width: '100%', marginTop: 2 }}
                        />
                      </label>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Size(s)</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          {(row.sizes || []).map((sz, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: '#ECF8FA',
                                border: '1px solid #CBD5E1',
                                borderRadius: 6,
                                padding: '4px 6px'
                              }}
                            >
                              <input
                                type="text"
                                value={sz}
                                onChange={(e) => updateSizeChip(rIdx, sIdx, e.target.value)}
                                placeholder="e.g. 3x7"
                                style={{
                                  width: 70,
                                  border: 'none',
                                  background: 'transparent',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  color: 'var(--brand-navy)',
                                  minHeight: 'auto'
                                }}
                              />
                              {(row.sizes || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeSizeChip(rIdx, sIdx)}
                                  style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', padding: 2 }}
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addSizeChip(rIdx)}
                            className="secondary-button"
                            style={{ fontSize: '0.78rem', minHeight: 36, padding: '4px 10px' }}
                          >
                            <Plus size={13} /> Size
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <label style={{ fontSize: '0.75rem', margin: 0 }}>
                          Unit
                          <select
                            value={row.unit}
                            onChange={(e) => updateRowField(rIdx, 'unit', e.target.value)}
                            style={{ width: '100%', marginTop: 2, fontWeight: 700 }}
                          >
                            <option value="sft">sft</option>
                            <option value="rft">rft</option>
                          </select>
                        </label>
                        <label style={{ fontSize: '0.75rem', margin: 0 }}>
                          Qty
                          <input
                            type="number"
                            step="any"
                            value={row.qty}
                            onChange={(e) => updateRowField(rIdx, 'qty', e.target.value)}
                            placeholder="0.00"
                            style={{ width: '100%', marginTop: 2, textAlign: 'right' }}
                          />
                        </label>
                        <label style={{ fontSize: '0.75rem', margin: 0 }}>
                          Rate (₹)
                          <input
                            type="number"
                            step="any"
                            value={row.unitPrice}
                            onChange={(e) => updateRowField(rIdx, 'unitPrice', e.target.value)}
                            placeholder="0.00"
                            style={{ width: '100%', marginTop: 2, textAlign: 'right' }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8 }}>
                  <button type="button" className="secondary-button" onClick={addRow} style={{ fontSize: '0.85rem', padding: '8px 16px', minHeight: 44, width: '100%' }}>
                    <Plus size={16} /> Add Line Item Row
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <div style={{ minWidth: 260, fontSize: '0.86rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span className="muted">Subtotal:</span>
                      <strong>{formatCurrency(subtotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span className="muted">GST (0%):</span>
                      <strong>₹0.00</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid var(--brand-teal)', fontSize: '1.02rem', color: 'var(--brand-navy)' }}>
                      <span>Grand Total:</span>
                      <strong>{formatCurrency(total)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <label style={{ marginTop: 8 }}>
                Payment Terms & Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: 8, borderRadius: 6 }}
                />
              </label>
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', background: '#F8FAFC', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
              Grand Total: {formatCurrency(total)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving Invoice...' : 'Save & Issue Invoice'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InvoicesPage() {
  const { user, authenticatedRequest, accessToken } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [downloadLoading, setDownloadLoading] = useState({});
  const [copiedLink, setCopiedLink] = useState(null);
  const [inspectInvoice, setInspectInvoice] = useState(null);

  const canManageInvoices = user?.role === 'TenantAdmin' || user?.role === 'Accountant';
  const canDelete = canManageInvoices;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invData, projData] = await Promise.all([
        listInvoices(authenticatedRequest),
        listProjects(authenticatedRequest)
      ]);
      setInvoices(invData);
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

  async function handleDeleteInvoice(inv) {
    const hasPayments = Number(inv.paidAmount || 0) > 0 || ['partial', 'paid'].includes(inv.status);
    if (hasPayments) {
      alert('Invoices with payment history cannot be deleted. Change status to Cancelled/Void instead.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete invoice ${inv.invoiceNumber}? This record will be archived.`)) {
      return;
    }
    try {
      await deleteInvoice(authenticatedRequest, inv.id);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete invoice');
    }
  }

  async function handleStatusUpdate(id, status) {
    if (!canManageInvoices) {
      alert('You do not have permission to update invoice status.');
      return;
    }
    try {
      await updateInvoiceStatus(authenticatedRequest, id, { status });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDownloadPdf(invoiceId, invoiceNumber) {
    setDownloadLoading((prev) => ({ ...prev, [`pdf_${invoiceId}`]: true }));
    try {
      await downloadInvoicePdf(accessToken, invoiceId, invoiceNumber);
    } catch (err) {
      alert(err.message || 'Failed to download Invoice PDF');
    } finally {
      setDownloadLoading((prev) => {
        const next = { ...prev };
        delete next[`pdf_${invoiceId}`];
        return next;
      });
    }
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <PullToRefresh onRefresh={loadData}>
          <Header
            title="Invoices & Payments"
            subtitle="7-column GST-compliant invoices with site details, digital signature, and PDF downloads."
          >
            {canManageInvoices && (
              <button className="primary-button" type="button" onClick={() => setShowModal(true)}>
                <Plus size={16} /> New Invoice
              </button>
            )}
          </Header>

          {error && <p className="form-error" style={{ marginBottom: 20 }}>{error}</p>}

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
            ) : invoices.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                <Receipt size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                <p className="muted" style={{ margin: 0 }}>No invoices created yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {invoices.map((inv) => {
                  const badge = STATUS_BADGES[inv.status] || STATUS_BADGES.draft;
                  return (
                    <div
                      key={inv.id}
                      className="mobile-card"
                      onClick={() => setInspectInvoice(inv)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="mobile-card-top">
                        <div>
                          <div className="mobile-card-title">{inv.clientName}</div>
                          <div className="mobile-card-sub">
                            {inv.invoiceNumber} {inv.siteName ? `• Site: ${inv.siteName}` : (inv.projectName ? `• ${inv.projectName}` : '')}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div className="mobile-card-amount">{formatCurrency(inv.totalAmount)}</div>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: 2,
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              background: badge.bg,
                              color: badge.color,
                              textTransform: 'uppercase'
                            }}
                          >
                            {inv.status}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card-bottom" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ fontSize: '0.72rem', padding: '3px 8px', minHeight: 28 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(inv.id, inv.invoiceNumber);
                            }}
                            disabled={downloadLoading[`pdf_${inv.id}`]}
                          >
                            <FileDown size={12} /> PDF
                          </button>
                        </div>

                        <span style={{ fontSize: '0.75rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
                          View & Actions →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canManageInvoices && (
              <FloatingActionButton
                label="New Invoice"
                onClick={() => setShowModal(true)}
              />
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              DESKTOP TABLE VIEW (>=1024px)
          ════════════════════════════════════════════════════════════════ */}
          <div className="desktop-only-view">
            <section className="panel">
              <div className="section-header">
                <h2 style={{ margin: 0 }}>Invoices ({invoices.length})</h2>
              </div>

              {loading ? (
                <p className="muted" style={{ padding: 20 }}>Loading invoices...</p>
              ) : invoices.length === 0 ? (
                <div className="empty-state">
                  <Receipt size={40} />
                  <p>No invoices created yet. Click "New Invoice" or convert a quotation to create one.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Client & Site</th>
                        <th>Date</th>
                        <th>Due Date</th>
                        <th style={{ textAlign: 'right' }}>Total Amount</th>
                        <th style={{ textAlign: 'right' }}>Paid</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => {
                        const badge = STATUS_BADGES[inv.status] || STATUS_BADGES.draft;
                        return (
                          <tr key={inv.id}>
                            <td>
                              <strong
                                style={{ color: 'var(--brand-navy)', cursor: 'pointer' }}
                                onClick={() => setInspectInvoice(inv)}
                              >
                                {inv.invoiceNumber}
                              </strong>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inv.clientName}</div>
                              {inv.siteName && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--brand-teal-dark)', fontWeight: 600 }}>
                                  Site: {inv.siteName}
                                </div>
                              )}
                              {inv.projectName && !inv.siteName && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--brand-teal-dark)', fontWeight: 600 }}>
                                  Project: {inv.projectName}
                                </div>
                              )}
                            </td>
                            <td className="muted">{inv.invoiceDate}</td>
                            <td className="muted">{inv.dueDate || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--brand-navy)' }}>
                              {formatCurrency(inv.totalAmount)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                              {formatCurrency(inv.paidAmount)}
                            </td>
                            <td>
                              <select
                                value={inv.status}
                                onChange={(e) => handleStatusUpdate(inv.id, e.target.value)}
                                disabled={!canManageInvoices}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  background: badge.bg,
                                  color: badge.color,
                                  border: 'none',
                                  cursor: canManageInvoices ? 'pointer' : 'default'
                                }}
                              >
                                <option value="draft">Draft</option>
                                <option value="sent">Sent</option>
                                <option value="partial">Partial</option>
                                <option value="paid">Paid</option>
                                <option value="overdue">Overdue</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  title="Download Invoice PDF"
                                  onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)}
                                  disabled={downloadLoading[`pdf_${inv.id}`]}
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 30 }}
                                >
                                  <FileDown size={13} /> {downloadLoading[`pdf_${inv.id}`] ? '...' : 'PDF'}
                                </button>

                                {canManageInvoices && inv.status !== 'paid' && (
                                  <button
                                    className="secondary-button"
                                    type="button"
                                    onClick={() => handleStatusUpdate(inv.id, 'paid')}
                                    style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 30 }}
                                  >
                                    <CheckCircle2 size={12} /> Paid
                                  </button>
                                )}

                                {canDelete && (() => {
                                  const hasPayments = Number(inv.paidAmount || 0) > 0 || ['partial', 'paid'].includes(inv.status);
                                  return (
                                    <button
                                      className="icon-btn"
                                      type="button"
                                      disabled={hasPayments}
                                      title={hasPayments ? 'Invoices with payment history cannot be deleted. Change status to Cancelled/Void instead.' : 'Delete invoice'}
                                      onClick={() => handleDeleteInvoice(inv)}
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '4px 8px',
                                        minHeight: 30,
                                        color: hasPayments ? '#CBD5E1' : '#991B1B',
                                        cursor: hasPayments ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  );
                                })()}
                              </div>
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

      {showModal && (
        <InvoiceModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={async () => {
            setShowModal(false);
            await loadData();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}

      {/* Invoice Detail Bottom Sheet */}
      <BottomSheet
        isOpen={Boolean(inspectInvoice)}
        onClose={() => setInspectInvoice(null)}
        title={inspectInvoice ? `Invoice — ${inspectInvoice.invoiceNumber}` : 'Invoice Details'}
      >
        {inspectInvoice && (
          <div>
            <div className="mobile-user-card" style={{ marginBottom: 14 }}>
              <div className="mobile-user-avatar">
                <Receipt size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mobile-user-name">{inspectInvoice.clientName}</div>
                <div className="mobile-user-sub">
                  Invoice #{inspectInvoice.invoiceNumber} {inspectInvoice.siteName ? `• Site: ${inspectInvoice.siteName}` : ''}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: 4 }}>
                  {formatCurrency(inspectInvoice.totalAmount)}
                </div>
              </div>
            </div>

            {/* Itemized Line Items */}
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-navy)', display: 'block', marginBottom: 8 }}>
                Itemized Line Items
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(inspectInvoice.lineItems || []).map((li, liIdx) => {
                  let sizeText = '-';
                  if (Array.isArray(li.sizes) && li.sizes.length > 0) {
                    sizeText = li.sizes.map((s) => (typeof s === 'string' ? s : `${s.label ? s.label + ': ' : ''}${s.length}x${s.width}`)).join(', ');
                  } else if (li.size) {
                    sizeText = String(li.size);
                  }

                  return (
                    <div key={liIdx} style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          #{liIdx + 1}. {li.description}
                        </span>
                        <span style={{ fontWeight: 800, color: 'var(--brand-navy)', fontSize: '0.88rem' }}>
                          {formatCurrency(li.amount)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B', marginTop: 4 }}>
                        <span>Sizes: <strong style={{ color: 'var(--brand-navy)' }}>{sizeText}</strong></span>
                        <span>{li.qty} {li.unit || 'sft'} @ {formatCurrency(li.unitPrice)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status & Financial Details (0% GST) */}
            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
                <span className="muted">Subtotal:</span>
                <strong>{formatCurrency(inspectInvoice.subtotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
                <span className="muted">GST (0%):</span>
                <strong>₹0.00</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800, borderTop: '1px solid #E2E8F0', paddingTop: 6, color: 'var(--brand-navy)', marginBottom: 8 }}>
                <span>Total Amount:</span>
                <span>{formatCurrency(inspectInvoice.totalAmount)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #E2E8F0', paddingTop: 8 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Status</span>
                <select
                  value={inspectInvoice.status}
                  onChange={async (e) => {
                    await handleStatusUpdate(inspectInvoice.id, e.target.value);
                    setInspectInvoice((inv) => ({ ...inv, status: e.target.value }));
                  }}
                  disabled={!canManageInvoices}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: canManageInvoices ? 'pointer' : 'default'
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Download PDF Button */}
            <button
              type="button"
              className="secondary-button"
              style={{ width: '100%', minHeight: 40, marginBottom: 10 }}
              onClick={() => handleDownloadPdf(inspectInvoice.id, inspectInvoice.invoiceNumber)}
              disabled={downloadLoading[`pdf_${inspectInvoice.id}`]}
            >
              <FileDown size={15} /> Download Official PDF
            </button>

            {/* Razorpay Online Payment Link Action */}


            {/* Quick Mark Paid Action */}
            {canManageInvoices && inspectInvoice.status !== 'paid' && (
              <button
                type="button"
                className="primary-button"
                style={{ width: '100%', minHeight: 44, marginBottom: 8 }}
                onClick={async () => {
                  await handleStatusUpdate(inspectInvoice.id, 'paid');
                  setInspectInvoice(null);
                }}
              >
                <CheckCircle2 size={16} /> Mark Invoice Paid in Cash/Bank
              </button>
            )}

            {canDelete && (() => {
              const hasPayments = Number(inspectInvoice.paidAmount || 0) > 0 || ['partial', 'paid'].includes(inspectInvoice.status);
              return (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={hasPayments}
                  title={hasPayments ? 'Invoices with payment history cannot be deleted. Change status to Cancelled/Void instead.' : 'Delete invoice'}
                  style={{
                    width: '100%',
                    minHeight: 40,
                    color: hasPayments ? '#CBD5E1' : '#DC2626',
                    borderColor: hasPayments ? '#E2E8F0' : '#FECACA',
                    cursor: hasPayments ? 'not-allowed' : 'pointer'
                  }}
                  onClick={async () => {
                    const inv = inspectInvoice;
                    setInspectInvoice(null);
                    await handleDeleteInvoice(inv);
                  }}
                >
                  <Trash2 size={15} /> Delete Invoice Record
                </button>
              );
            })()}
          </div>
        )}
      </BottomSheet>
    </main>
  );
}
