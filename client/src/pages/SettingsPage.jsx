import { useEffect, useState } from 'react';
import {
  UserPlus, Shield, UserCheck, UserX, FileSignature, Upload, Trash2, CheckCircle2,
  Laptop, Smartphone, Globe, Clock, LogOut, ShieldAlert, KeyRound, Monitor
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { listUserSessions, listTenantSessions, revokeSession, revokeAllOtherSessions } from '../api/sessions.js';

const ROLE_OPTIONS = ['TenantAdmin', 'Manager', 'Accountant', 'Employee'];

function getDeviceIcon(deviceInfo = '') {
  if (/iOS|Android|iPhone|iPad|Mobile/i.test(deviceInfo)) {
    return <Smartphone size={20} color="var(--brand-navy)" />;
  }
  return <Laptop size={20} color="var(--brand-navy)" />;
}

function formatSessionDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function SettingsPage() {
  const { user, authenticatedRequest } = useAuth();
  const [users, setUsers] = useState([]);
  const [tenantSettings, setTenantSettings] = useState({ businessName: '', signatureData: null });
  const [sessions, setSessions] = useState([]);
  const [tenantSessions, setTenantSessions] = useState([]);
  const [sessionTab, setSessionTab] = useState('my'); // 'my' | 'tenant'
  const [sessionError, setSessionError] = useState('');
  const [revoking, setRevoking] = useState({});
  const [revokingAll, setRevokingAll] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Manager',
    temporaryPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigSuccess, setSigSuccess] = useState(false);

  const isAdmin = user?.role === 'TenantAdmin' || user?.role === 'PlatformSuperAdmin';

  async function loadData() {
    setLoading(true);
    setError('');
    setSessionError('');
    try {
      const [usersData, settingsData] = await Promise.all([
        authenticatedRequest('/users'),
        authenticatedRequest('/users/tenant-settings').catch(() => ({ settings: {} }))
      ]);
      setUsers(usersData.users || []);
      if (settingsData.settings) {
        setTenantSettings(settingsData.settings);
      }

      try {
        const mySessionsData = await listUserSessions(authenticatedRequest);
        setSessions(mySessionsData || []);
      } catch (sessErr) {
        setSessions([]);
        setSessionError(`Failed to load active sessions: ${sessErr.message}`);
      }

      if (isAdmin) {
        try {
          const tenantSessData = await listTenantSessions(authenticatedRequest);
          setTenantSessions(tenantSessData || []);
        } catch (tErr) {
          setTenantSessions([]);
          setSessionError((prev) => prev || `Failed to load staff sessions: ${tErr.message}`);
        }
      }
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleRevokeSession(sessionId) {
    if (!window.confirm('Are you sure you want to log out this device?')) return;
    setRevoking((prev) => ({ ...prev, [sessionId]: true }));
    try {
      await revokeSession(authenticatedRequest, sessionId);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to revoke session');
    } finally {
      setRevoking((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }
  }

  async function handleRevokeAllOtherSessions() {
    if (!window.confirm('Are you sure you want to log out all other devices? This will immediately invalidate all logins except this current browser.')) return;
    setRevokingAll(true);
    try {
      const res = await revokeAllOtherSessions(authenticatedRequest);
      alert(res.message || 'All other devices logged out successfully.');
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to log out all other devices');
    } finally {
      setRevokingAll(false);
    }
  }

  async function inviteUser(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        ...form,
        temporaryPassword: form.temporaryPassword || undefined
      };
      const data = await authenticatedRequest('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setUsers((current) => [data.user, ...current]);
      setForm({ name: '', email: '', phone: '', role: 'Manager', temporaryPassword: '' });
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleUser(u) {
    setError('');
    try {
      const data = await authenticatedRequest(`/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive })
      });
      setUsers((current) => current.map((item) => (item.id === u.id ? data.user : item)));
    } catch (apiError) {
      alert(apiError.message);
    }
  }

  async function changeRole(u, role) {
    setError('');
    try {
      const data = await authenticatedRequest(`/users/${u.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });
      setUsers((current) => current.map((item) => (item.id === u.id ? data.user : item)));
    } catch (apiError) {
      alert(apiError.message);
    }
  }

  async function handleSignatureUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a PNG, JPG, or SVG image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setSigSaving(true);
      try {
        const res = await authenticatedRequest('/users/tenant-settings', {
          method: 'PATCH',
          body: JSON.stringify({ signatureData: base64 })
        });
        setTenantSettings(res.settings);
        setSigSuccess(true);
        setTimeout(() => setSigSuccess(false), 3000);
      } catch (err) {
        alert(err.message || 'Failed to save digital signature');
      } finally {
        setSigSaving(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function removeSignature() {
    setSigSaving(true);
    try {
      const res = await authenticatedRequest('/users/tenant-settings', {
        method: 'PATCH',
        body: JSON.stringify({ signatureData: null })
      });
      setTenantSettings(res.settings);
    } catch (err) {
      alert(err.message);
    } finally {
      setSigSaving(false);
    }
  }

  const activeSessionsCount = sessions.length;
  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <Header
          title="Workspace Settings & Security"
          subtitle="Manage active sessions, logged-in devices, authorized staff logins, and digital signatures."
        />

        <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Active Sessions & Logged-in Devices Panel */}
          <div className="panel" style={{ background: '#FFFFFF', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand-navy)' }}>
                  <ShieldAlert size={20} color="var(--brand-navy)" /> Active Sessions & Logged-in Devices
                </h2>
                <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>
                  Monitor and manage active logins to protect your account's sensitive business data.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {otherSessionsCount > 0 && sessionTab === 'my' && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleRevokeAllOtherSessions}
                    disabled={revokingAll}
                    style={{ fontSize: '0.78rem', color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }}
                  >
                    <LogOut size={14} /> {revokingAll ? 'Logging out...' : 'Log Out All Other Devices'}
                  </button>
                )}
              </div>
            </div>

            {/* Admin View Switcher Tab */}
            {isAdmin && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setSessionTab('my')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: 'none',
                    background: sessionTab === 'my' ? 'var(--brand-navy)' : '#F1F5F9',
                    color: sessionTab === 'my' ? '#FFFFFF' : '#64748B',
                    cursor: 'pointer'
                  }}
                >
                  My Devices ({sessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionTab('tenant')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: 'none',
                    background: sessionTab === 'tenant' ? 'var(--brand-navy)' : '#F1F5F9',
                    color: sessionTab === 'tenant' ? '#FFFFFF' : '#64748B',
                    cursor: 'pointer'
                  }}
                >
                  All Staff Logins ({tenantSessions.length})
                </button>
              </div>
            )}

            {sessionError && (
              <p className="form-error" style={{ marginBottom: 12 }}>{sessionError}</p>
            )}

            {/* Devices List */}
            {loading ? (
              <p className="muted" style={{ padding: '10px 0' }}>Loading active sessions...</p>
            ) : (sessionTab === 'my' ? sessions : tenantSessions).length === 0 ? (
              <p className="muted" style={{ padding: '10px 0' }}>No active sessions found.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {(sessionTab === 'my' ? sessions : tenantSessions).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: s.isCurrent ? '#F0F9FF' : '#F8FAFC',
                      border: s.isCurrent ? '1.5px solid #0284C7' : '1px solid #E2E8F0',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: '#FFFFFF', padding: 8, borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex' }}>
                          {getDeviceIcon(s.deviceInfo)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                            {s.deviceInfo}
                          </div>
                          {sessionTab === 'tenant' && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F5394' }}>
                              {s.userName} ({s.userEmail})
                            </div>
                          )}
                        </div>
                      </div>

                      {s.isCurrent && (
                        <span
                          className="badge"
                          style={{
                            background: '#0284C7',
                            color: '#FFFFFF',
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            fontWeight: 700
                          }}
                        >
                          This Device
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.76rem', color: '#475569', marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Globe size={13} color="#64748B" />
                        <span>IP: <strong>{s.ipAddress}</strong> ({s.locationName})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} color="#64748B" />
                        <span>Last active: {formatSessionDate(s.lastActiveAt)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <KeyRound size={13} color="#64748B" />
                        <span>Logged in: {formatSessionDate(s.createdAt)}</span>
                      </div>
                    </div>

                    {!s.isCurrent && (
                      <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px dashed #CBD5E1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleRevokeSession(s.id)}
                          disabled={revoking[s.id]}
                          style={{ fontSize: '0.78rem', padding: '6px 12px', minHeight: 44, color: '#DC2626', borderColor: '#FECACA', touchAction: 'manipulation' }}
                        >
                          <LogOut size={14} /> {revoking[s.id] ? 'Logging out...' : (sessionTab === 'tenant' ? 'Revoke Session' : 'Log out this device')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <section className="split-layout" style={{ gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 24 }}>
            {/* Left Column: Digital Signature & Invite User */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Digital Signature Card */}
              <div className="panel form-stack">
                <div className="section-header">
                  <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileSignature size={18} color="var(--brand-navy)" />
                    Digital Signature
                  </h2>
                </div>
                <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                  Upload an authorized signature image (transparent PNG recommended) to embed on Quotation and Invoice PDFs when toggled ON.
                </p>

                {tenantSettings.signatureData ? (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <img
                      src={tenantSettings.signatureData}
                      alt="Authorized Signature"
                      style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain', margin: '0 auto 8px' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} /> Active Signature Configured
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={removeSignature}
                      disabled={sigSaving}
                      style={{ fontSize: '0.75rem', padding: '4px 10px', color: '#DC2626' }}
                    >
                      <Trash2 size={13} /> Remove Signature
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed #CBD5E1',
                      borderRadius: 8,
                      padding: '20px 12px',
                      cursor: 'pointer',
                      background: '#F8FAFC',
                      textAlign: 'center'
                    }}
                  >
                    <Upload size={24} color="#64748B" style={{ marginBottom: 6 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                      Upload Signature Image
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>PNG, JPG up to 1MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      disabled={sigSaving}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}

                {sigSuccess && <p style={{ fontSize: '0.78rem', color: '#059669', margin: 0 }}>Signature saved successfully!</p>}
              </div>

              {/* Invite User Card */}
              <form className="panel form-stack" onSubmit={inviteUser}>
                <div className="section-header">
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Invite Team Member</h2>
                </div>

                <label>
                  Full Name
                  <input
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="e.g. Anand Sharma"
                    required
                  />
                </label>

                <label>
                  Email Address
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="anand@company.com"
                    required
                  />
                </label>

                <label>
                  Phone Number
                  <input
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </label>

                <label>
                  Assigned Role
                  <select value={form.role} onChange={(event) => updateField('role', event.target.value)}>
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Temporary Password
                  <input
                    type="password"
                    value={form.temporaryPassword}
                    onChange={(event) => updateField('temporaryPassword', event.target.value)}
                    minLength={10}
                    placeholder="Auto-generated if blank"
                  />
                </label>

                {error && <p className="form-error">{error}</p>}

                <button className="primary-button" type="submit" disabled={submitting}>
                  <UserPlus size={16} />
                  {submitting ? 'Inviting...' : 'Invite Team Member'}
                </button>
              </form>
            </div>

            {/* Active Users Table */}
            <section className="panel">
              <div className="section-header">
                <h2 style={{ margin: 0 }}>Authorized Workspace Users ({users.length})</h2>
              </div>

              {loading ? (
                <p className="muted" style={{ padding: 20 }}>Loading users...</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{u.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{u.email}</div>
                          </td>
                          <td>
                            <select
                              value={u.role}
                              onChange={(event) => changeRole(u, event.target.value)}
                              style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600 }}
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                              <span className="badge-dot" style={{ background: u.isActive ? '#10B981' : '#94A3B8' }} />
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => toggleUser(u)}
                              style={{ fontSize: '0.75rem', padding: '4px 10px', minHeight: 30 }}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        </section>
      </section>
    </main>
  );
}
