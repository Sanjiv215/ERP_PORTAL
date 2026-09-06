import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  UserCheck,
  Calendar,
  Check,
  Clock,
  AlertCircle,
  MoreVertical,
  X
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import {
  getAttendanceGrid,
  markAttendance,
  getEmployeeCalendar,
  exportAttendanceCsv,
  downloadAttendancePdf,
  downloadAttendanceExcel
} from '../api/attendance.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { BottomSheet } from '../components/BottomSheet.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

const STATUSES = ['present', 'half_day', 'overtime', 'absent', 'leave'];

const STATUS_LABELS = {
  present: 'Present (1.0)',
  half_day: 'Half Day (0.5)',
  overtime: 'Overtime (1.5)',
  absent: 'Absent (0.0)',
  leave: 'Leave (0.0)'
};

const STATUS_SHORT = {
  present: 'P',
  half_day: 'H',
  overtime: 'OT',
  absent: 'A',
  leave: 'L'
};

const STATUS_COLORS = {
  present: { bg: '#D1FAE5', color: '#065F46', dot: '#10B981', border: '#A7F3D0' },
  half_day: { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B', border: '#FDE68A' },
  overtime: { bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6', border: '#BFDBFE' },
  absent: { bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444', border: '#FECACA' },
  leave: { bg: '#EDE9FE', color: '#5B21B6', dot: '#8B5CF6', border: '#DDD6FE' },
  unmarked: { bg: '#F1F5F9', color: '#64748B', dot: '#CBD5E1', border: '#E2E8F0' }
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function StatusCell({ status, canWrite, onChange }) {
  const [open, setOpen] = useState(false);
  const s = STATUS_COLORS[status || 'unmarked'];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => canWrite && setOpen((o) => !o)}
        style={{
          background: s.bg,
          color: s.color,
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 6,
          cursor: canWrite ? 'pointer' : 'default',
          fontSize: '0.72rem',
          fontWeight: 800,
          padding: '4px 6px',
          minWidth: 32,
          textAlign: 'center',
          transition: 'transform 0.1s ease'
        }}
        title={STATUS_LABELS[status] || 'Click to set status'}
      >
        {status ? STATUS_SHORT[status] : '—'}
      </button>

      {open && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            position: 'absolute',
            top: '110%',
            left: 0,
            zIndex: 60,
            minWidth: 150,
            padding: 6
          }}
        >
          {STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                onChange(st);
                setOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '6px 8px',
                border: 'none',
                background: status === st ? STATUS_COLORS[st].bg : 'transparent',
                color: STATUS_COLORS[st].color,
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span
                style={{
                  background: STATUS_COLORS[st].dot,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  display: 'inline-block'
                }}
              />
              {STATUS_LABELS[st]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeCalendarView({ employee, year, month, onBack, authenticatedRequest }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getEmployeeCalendar(authenticatedRequest, employee.id, year, month)
      .then(setDays)
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [authenticatedRequest, employee.id, year, month]);

  const dayMap = useMemo(() => {
    const m = {};
    for (const d of days) {
      m[d.date] = d;
    }
    return m;
  }, [days]);

  const totalDays = daysInMonth(year, month);
  const firstDow = new Date(year, month - 1, 1).getDay();
  const blanks = Array.from({ length: firstDow }, (_, i) => i);
  const monthDays = Array.from({ length: totalDays }, (_, i) => i + 1);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="icon-btn" type="button" onClick={onBack}>
          <ChevronLeft size={18} /> Back to Attendance View
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{employee.name} — Attendance Calendar</h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            {MONTH_NAMES[month - 1]} {year} · Daily wage (₹{employee.wageRate}/day)
          </p>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading monthly calendar...</p>
      ) : (
        <div className="panel" style={{ maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', marginBottom: 8 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {blanks.map((b) => <div key={`blank-${b}`} />)}
            {monthDays.map((d) => {
              const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
              const rec = dayMap[dateStr];
              const st = rec ? rec.status : null;
              const c = STATUS_COLORS[st || 'unmarked'];
              return (
                <div
                  key={d}
                  style={{
                    background: c.bg,
                    border: `1px solid ${c.border || 'var(--border-color)'}`,
                    borderRadius: 8,
                    padding: '8px 4px',
                    minHeight: 52,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{d}</span>
                  {st && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: c.color }}>
                      {STATUS_SHORT[st]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AttendancePage() {
  const { user, authenticatedRequest, accessToken } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [calendarEmployee, setCalendarEmployee] = useState(null);
  const [inspectEmployee, setInspectEmployee] = useState(null);
  const [mobileViewMode, setMobileViewMode] = useState('day'); // 'day' | 'calendar'

  const dateStripRef = useRef(null);

  const canWrite = user?.role === 'TenantAdmin' || user?.role === 'Manager';

  const selectedDateStr = `${year}-${pad2(month)}-${pad2(selectedDay)}`;

  const loadGrid = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAttendanceGrid(authenticatedRequest, year, month);
      setGrid(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, year, month]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  // Center the active day in horizontal date strip on mobile
  useEffect(() => {
    if (dateStripRef.current) {
      const activeEl = dateStripRef.current.querySelector('.mobile-date-chip.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDay, month]);

  function handlePrevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDay(1);
  }

  function handleNextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDay(1);
  }

  async function handleSingleChange(employeeId, workDate, status) {
    if (!canWrite) {
      alert('You do not have permission to mark attendance.');
      return;
    }
    try {
      await markAttendance(authenticatedRequest, workDate, [{ employeeId, status }]);
      setGrid((g) => {
        if (!g) return g;
        return {
          ...g,
          attendance: {
            ...g.attendance,
            [employeeId]: {
              ...(g.attendance[employeeId] || {}),
              [workDate]: { status, note: null }
            }
          }
        };
      });
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      await downloadAttendancePdf(accessToken, year, month);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      await downloadAttendanceExcel(accessToken, year, month);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportAttendanceCsv(accessToken, year, month);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  const numDays = daysInMonth(year, month);
  const dayCols = Array.from({ length: numDays }, (_, i) => i + 1);

  // Calculate stats for current selected date on mobile
  const dayStats = useMemo(() => {
    if (!grid?.employees) return { present: 0, half: 0, overtime: 0, absent: 0, leave: 0, unmarked: 0 };
    let p = 0, h = 0, ot = 0, a = 0, l = 0, u = 0;
    const active = grid.employees.filter((e) => e.isActive);
    for (const emp of active) {
      const st = grid.attendance?.[emp.id]?.[selectedDateStr]?.status;
      if (st === 'present') p++;
      else if (st === 'half_day') h++;
      else if (st === 'overtime') ot++;
      else if (st === 'absent') a++;
      else if (st === 'leave') l++;
      else u++;
    }
    return { present: p, half: h, overtime: ot, absent: a, leave: l, unmarked: u, total: active.length };
  }, [grid, selectedDateStr]);

  const selectedDateObj = new Date(year, month - 1, selectedDay);
  const formattedDayName = selectedDateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        {calendarEmployee ? (
          <EmployeeCalendarView
            employee={calendarEmployee}
            year={year}
            month={month}
            onBack={() => setCalendarEmployee(null)}
            authenticatedRequest={authenticatedRequest}
          />
        ) : (
          <PullToRefresh onRefresh={loadGrid}>
            <Header
              title="Daily Attendance"
              subtitle="Mark daily attendance, overtime, half-days, and export clean summaries for payroll."
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  title="Download Attendance PDF"
                >
                  <Download size={15} /> PDF
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  title="Download Attendance Excel (.xlsx)"
                >
                  <Download size={15} /> Excel
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  title="Export Attendance CSV"
                >
                  <Download size={15} /> CSV
                </button>
              </div>
            </Header>

            {/* ════════════════════════════════════════════════════════════════
                MOBILE-NATIVE DAY-FIRST VIEW (<1024px)
            ════════════════════════════════════════════════════════════════ */}
            <div className="mobile-only-view">
              {/* Month Selector Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                  type="button"
                  className="mobile-back-btn"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                >
                  <ChevronLeft size={18} />
                </button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {MONTH_NAMES[month - 1]} {year}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {grid?.employees?.filter((e) => e.isActive)?.length || 0} active staff
                  </span>
                </div>
                <button
                  type="button"
                  className="mobile-back-btn"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Swipeable Horizontal Date Strip */}
              <div className="mobile-date-strip" ref={dateStripRef}>
                {dayCols.map((d) => {
                  const dObj = new Date(year, month - 1, d);
                  const dow = DOW_NAMES[dObj.getDay()];
                  const isToday =
                    today.getFullYear() === year &&
                    today.getMonth() + 1 === month &&
                    today.getDate() === d;
                  const isActive = selectedDay === d;

                  return (
                    <button
                      key={d}
                      type="button"
                      className={`mobile-date-chip ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => setSelectedDay(d)}
                    >
                      <span className="mobile-date-dow">{dow}</span>
                      <span className="mobile-date-num">{d}</span>
                      {isToday && !isActive && (
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--brand-teal)' }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Status Banner */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {formattedDayName}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', fontSize: '0.72rem', fontWeight: 700 }}>
                    <span style={{ color: '#059669' }}>● {dayStats.present} Present</span>
                    {dayStats.half > 0 && <span style={{ color: '#D97706' }}>● {dayStats.half} Half</span>}
                    {dayStats.overtime > 0 && <span style={{ color: '#2563EB' }}>● {dayStats.overtime} OT</span>}
                    {dayStats.absent > 0 && <span style={{ color: '#DC2626' }}>● {dayStats.absent} Absent</span>}
                  </div>
                </div>
              </div>

              {/* Mobile Employee Attendance Cards List */}
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="mobile-card" style={{ height: 100, opacity: 0.6, background: '#F8FAFC' }} />
                  ))}
                </div>
              ) : grid?.employees?.length === 0 ? (
                <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <p className="muted">No active employees found in roster.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {grid?.employees?.map((emp) => {
                    const currentStatus = grid?.attendance?.[emp.id]?.[selectedDateStr]?.status || null;
                    const stColor = STATUS_COLORS[currentStatus || 'unmarked'];

                    return (
                      <div key={emp.id} className="mobile-card">
                        <div className="mobile-card-top" style={{ marginBottom: 12 }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                            onClick={() => setInspectEmployee(emp)}
                          >
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
                                ₹{emp.wageRate}/day · <span style={{ color: 'var(--brand-navy)', fontWeight: 700 }}>History →</span>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              background: stColor.bg,
                              color: stColor.color,
                              border: `1px solid ${stColor.border || 'transparent'}`,
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              textTransform: 'uppercase'
                            }}
                          >
                            {currentStatus ? currentStatus.replace('_', ' ') : 'Unmarked'}
                          </div>
                        </div>

                        {/* 1-Tap Status Selector Buttons */}
                        {canWrite && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                            {STATUSES.map((st) => {
                              const isSelected = currentStatus === st;
                              const cfg = STATUS_COLORS[st];
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleSingleChange(emp.id, selectedDateStr, st)}
                                  style={{
                                    minHeight: 44,
                                    borderRadius: 8,
                                    border: isSelected ? `2px solid ${cfg.color}` : '1px solid var(--border-color)',
                                    background: isSelected ? cfg.bg : '#FFFFFF',
                                    color: isSelected ? cfg.color : 'var(--text-secondary)',
                                    fontWeight: isSelected ? 800 : 600,
                                    fontSize: '0.78rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 2,
                                    cursor: 'pointer',
                                    touchAction: 'manipulation',
                                    transition: 'all 0.1s ease'
                                  }}
                                >
                                  <span>{STATUS_SHORT[st]}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                DESKTOP FULL MATRIX VIEW (>=1024px)
            ════════════════════════════════════════════════════════════════ */}
            <div className="desktop-only-view">

              <section className="panel">
                <div className="section-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="icon-btn" type="button" onClick={handlePrevMonth}>
                      <ChevronLeft size={18} />
                    </button>
                    <h2 style={{ margin: 0, minWidth: 160, textAlign: 'center', fontSize: '1.15rem' }}>
                      {MONTH_NAMES[month - 1]} {year}
                    </h2>
                    <button className="icon-btn" type="button" onClick={handleNextMonth}>
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.78rem', flexWrap: 'wrap' }}>
                    {STATUSES.map((st) => (
                      <span key={st} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{
                            background: STATUS_COLORS[st].bg,
                            color: STATUS_COLORS[st].color,
                            fontWeight: 800,
                            padding: '2px 5px',
                            borderRadius: 4,
                            fontSize: '0.7rem'
                          }}
                        >
                          {STATUS_SHORT[st]}
                        </span>
                        {STATUS_LABELS[st].split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <p className="muted">Loading monthly matrix...</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 180, position: 'sticky', left: 0, background: '#F8FAFC', zIndex: 3 }}>
                            Employee
                          </th>
                          <th style={{ minWidth: 80 }}>Type</th>
                          {dayCols.map((d) => (
                            <th key={d} style={{ textAlign: 'center', minWidth: 36, padding: '8px 2px' }}>
                              {d}
                            </th>
                          ))}
                          <th style={{ textAlign: 'center', minWidth: 60, background: 'var(--brand-teal-light)' }}>
                            Units
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {grid?.employees?.map((emp) => {
                          const empAtt = grid.attendance?.[emp.id] || {};
                          let dayUnits = 0;
                          for (const d of dayCols) {
                            const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
                            const st = empAtt[dateStr]?.status;
                            if (st === 'present') dayUnits += 1.0;
                            else if (st === 'half_day') dayUnits += 0.5;
                            else if (st === 'overtime') dayUnits += 1.5;
                          }

                          return (
                            <tr key={emp.id}>
                              <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: '#FFFFFF', zIndex: 2 }}>
                                <button
                                  type="button"
                                  onClick={() => setCalendarEmployee(emp)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--brand-navy)',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    padding: 0
                                  }}
                                >
                                  {emp.name}
                                </button>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Daily (₹{emp.wageRate})
                              </td>
                              {dayCols.map((d) => {
                                const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
                                const status = empAtt[dateStr]?.status || null;
                                return (
                                  <td key={d} style={{ textAlign: 'center', padding: '4px 2px' }}>
                                    <StatusCell
                                      status={status}
                                      canWrite={canWrite}
                                      onChange={(newStatus) => handleSingleChange(emp.id, dateStr, newStatus)}
                                    />
                                  </td>
                                );
                              })}
                              <td
                                style={{
                                  textAlign: 'center',
                                  fontWeight: 800,
                                  color: 'var(--brand-teal-dark)',
                                  background: 'var(--brand-teal-light)'
                                }}
                              >
                                {dayUnits.toFixed(1)}
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

            {/* Mobile Employee Detail & Calendar Bottom Sheet */}
            <BottomSheet
              isOpen={Boolean(inspectEmployee)}
              onClose={() => setInspectEmployee(null)}
              title={inspectEmployee?.name ? `${inspectEmployee.name} — Attendance` : 'Employee Details'}
            >
              {inspectEmployee && (
                <div>
                  <div className="mobile-user-card" style={{ marginBottom: 16 }}>
                    <div className="mobile-user-avatar">
                      {inspectEmployee.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="mobile-user-name">{inspectEmployee.name}</div>
                      <div className="mobile-card-sub">
                        ₹{inspectEmployee.wageRate}/day · {inspectEmployee.phone || 'No phone'}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 800 }}>Quick Actions</h4>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ width: '100%', marginBottom: 8 }}
                      onClick={() => {
                        const emp = inspectEmployee;
                        setInspectEmployee(null);
                        setCalendarEmployee(emp);
                      }}
                    >
                      <Calendar size={18} /> Open Full Monthly Calendar View
                    </button>
                  </div>
                </div>
              )}
            </BottomSheet>
          </PullToRefresh>
        )}
      </section>
    </main>
  );
}
