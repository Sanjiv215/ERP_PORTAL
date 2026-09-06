import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ChevronLeft, Download } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { getPayslip, downloadPayslipPdf } from '../api/payroll.js';

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
  return 'Rolling Period';
}

export function PayslipPage() {
  const { runId, lineItemId } = useParams();
  const { authenticatedRequest, accessToken } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const empName = data?.employee?.name || data?.lineItem?.employeeName || 'employee';
      await downloadPayslipPdf(accessToken, runId, lineItemId, empName);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const loadPayslip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPayslip(authenticatedRequest, runId, lineItemId);
      setData(res);
      document.title = `Payslip — ${res.employee.name} — TheWoodWise`;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, runId, lineItemId]);

  useEffect(() => {
    loadPayslip();
  }, [loadPayslip]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading payslip...</div>;
  if (error) return <div style={{ padding: 40, color: '#DC2626' }}>{error}</div>;
  if (!data) return null;

  const tenant = data.tenant || { businessName: 'TheWoodWise', gstNumber: '' };
  const run = data.run || { periodMonth: 1, periodYear: 2026 };
  const employee = data.employee || {
    name: data.lineItem?.employeeName || 'Staff Member',
    wageType: data.lineItem?.wageType || 'daily',
    wageRate: data.lineItem?.wageRate || 0,
    phone: null
  };
  const lineItem = data.lineItem || {};
  const adjustments = Array.isArray(data.adjustments)
    ? data.adjustments
    : Array.isArray(lineItem.adjustments)
      ? lineItem.adjustments
      : [];

  const bonuses = adjustments.filter((a) => a && a.type === 'bonus');
  const deductions = adjustments.filter((a) => a && a.type === 'deduction');

  return (
    <div style={{ background: '#F1F5F9', minHeight: '100vh', padding: '32px 16px' }}>
      {/* Print Controls (Hidden during print) */}
      <div className="no-print" style={{ maxWidth: 780, margin: '0 auto 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <button
          className="icon-btn"
          type="button"
          onClick={() => navigate(-1)}
          style={{ minHeight: 44, touchAction: 'manipulation' }}
        >
          <ChevronLeft size={16} /> Back to Payroll
        </button>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="secondary-button"
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            style={{ minHeight: 44, touchAction: 'manipulation' }}
          >
            <Download size={16} /> {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => window.print()}
            style={{ minHeight: 44, touchAction: 'manipulation' }}
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Payslip Document */}
      <div
        id="payslip-doc"
        style={{
          background: '#FFFFFF',
          maxWidth: 780,
          margin: '0 auto',
          padding: '48px 56px',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}
      >
        {/* Letterhead Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--brand-navy)', paddingBottom: 24, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/woodwise-logo.svg" alt="TheWoodWise" style={{ width: 52, height: 52, borderRadius: '50%' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                {tenant.businessName || 'TheWoodWise'}
              </h1>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
                Precision Woodworking & Joinery Management
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                background: 'var(--brand-teal-light)',
                color: 'var(--brand-teal-dark)',
                padding: '4px 12px',
                borderRadius: 6,
                fontWeight: 800,
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Wage Payslip
            </span>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 6, color: 'var(--brand-navy)' }}>
              {formatDateRange(lineItem.periodStartDate || run.periodStartDate, lineItem.periodEndDate || run.periodEndDate, run.periodMonth, run.periodYear)}
            </div>
          </div>
        </div>

        {/* Employee & Payment Details Box */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, background: '#F8FAFC', padding: 20, borderRadius: 8, marginBottom: 28 }}>
          <div>
            <div className="muted" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Employee Name</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>{employee.name || lineItem.employeeName}</div>
            {employee.phone && <div style={{ fontSize: '0.82rem', color: '#64748B' }}>{employee.phone}</div>}
            {(employee.bankDetailsLast4 || employee.upiIdLast4) && (
              <div style={{ fontSize: '0.75rem', color: '#0F5394', marginTop: 4, fontWeight: 600 }}>
                {employee.bankDetailsLast4 ? `Bank A/C: •••• ${employee.bankDetailsLast4}` : `UPI ID: •••• ${employee.upiIdLast4}`}
              </div>
            )}
          </div>

          <div>
            <div className="muted" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Wage Structure</div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
              DAILY RATE @ {formatCurrency(employee.wageRate || lineItem.wageRate)}/day
            </div>
            <div style={{ fontSize: '0.82rem', color: (lineItem.paymentStatus === 'paid' ? '#059669' : '#D97706'), fontWeight: 600 }}>
              Payment Status: {(lineItem.paymentStatus || 'pending').toUpperCase()}
            </div>
          </div>
        </div>

        {/* Attendance Units */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>
            Attendance & Work Units
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th style={{ padding: 8 }}>Present Days (1.0×)</th>
                <th style={{ padding: 8 }}>Half Days (0.5×)</th>
                <th style={{ padding: 8 }}>Overtime (1.5×)</th>
                <th style={{ padding: 8 }}>Absent (0.0×)</th>
                <th style={{ padding: 8 }}>Total Day Units</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 10, fontWeight: 700, color: '#065F46' }}>{lineItem.presentDays ?? 0}</td>
                <td style={{ padding: 10, fontWeight: 700, color: '#92400E' }}>{lineItem.halfDays ?? 0}</td>
                <td style={{ padding: 10, fontWeight: 700, color: '#1E40AF' }}>{lineItem.overtimeDays ?? 0}</td>
                <td style={{ padding: 10, fontWeight: 700, color: '#991B1B' }}>{lineItem.absentDays ?? 0}</td>
                <td style={{ padding: 10, fontWeight: 800, background: '#F8FAFC' }}>
                  {lineItem.totalDayEquivalents !== undefined ? lineItem.totalDayEquivalents : (lineItem.dayEquivalents ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Earnings & Deductions Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 32 }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: '#065F46', marginBottom: 10 }}>
              Earnings
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '0.88rem' }}>
              <span>Base Gross Wages</span>
              <strong>{formatCurrency(lineItem.grossAmount)}</strong>
            </div>
            {bonuses.map((b) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '0.88rem', color: '#065F46' }}>
                <span>{b.label}</span>
                <strong>+{formatCurrency(b.amount)}</strong>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: '#991B1B', marginBottom: 10 }}>
              Deductions & Advances
            </h3>
            {(() => {
              const advancesList = deductions.filter((d) => d.advanceId || (d.label && d.label.toLowerCase().includes('advance')));
              const otherDeductions = deductions.filter((d) => !advancesList.includes(d));
              const totalAdvancesDeducted = advancesList.reduce((sum, a) => sum + Number(a.amount || 0), 0);

              if (deductions.length === 0) {
                return <p className="muted" style={{ fontSize: '0.82rem', padding: '8px 0' }}>No deductions recorded.</p>;
              }

              return (
                <div>
                  {advancesList.length > 0 && (
                    <div style={{ marginBottom: 12, background: '#FEF2F2', padding: 10, borderRadius: 6, border: '1px solid #FCA5A5' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', marginBottom: 6 }}>
                        Employee Advances Taken
                      </div>
                      {advancesList.map((adv) => (
                        <div key={adv.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#7F1D1D', padding: '2px 0' }}>
                          <span>• {adv.label}</span>
                          <strong>−{formatCurrency(adv.amount)}</strong>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 800, color: '#991B1B', borderTop: '1px dashed #FCA5A5', marginTop: 6, paddingTop: 4 }}>
                        <span>Total Advances Deducted:</span>
                        <span>−{formatCurrency(totalAdvancesDeducted)}</span>
                      </div>
                    </div>
                  )}

                  {otherDeductions.map((d) => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '0.88rem', color: '#991B1B' }}>
                      <span>{d.label}</span>
                      <strong>−{formatCurrency(d.amount)}</strong>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Net Salary Total Box */}
        <div style={{ background: 'var(--brand-navy)', color: '#FFFFFF', padding: '20px 24px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Disbursed Amount</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-teal)' }}>
              {formatCurrency(lineItem.netAmount)}
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.8 }}>
            Auto-Generated by TheWoodWise Engine<br />
            Date: {new Date().toLocaleDateString('en-IN')}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print, .sidebar, .topbar { display: none !important; }
          body, html { background: #fff !important; }
          #payslip-doc { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; padding: 20px !important; }
        }
      `}</style>
    </div>
  );
}
