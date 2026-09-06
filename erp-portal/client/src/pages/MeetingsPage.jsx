import { useCallback, useEffect, useState } from 'react';
import {
  Video,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  ExternalLink,
  X,
  Trash2,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import {
  listMeetings,
  createMeeting,
  updateMeetingStatus,
  deleteMeeting,
  getMeetingDetail,
  saveMeetingMinutes
} from '../api/meetings.js';
import { listProjects } from '../api/projects.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { FloatingActionButton } from '../components/FloatingActionButton.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

const STATUS_BADGES = {
  scheduled: { bg: '#EFF6FF', color: '#1E40AF' },
  completed: { bg: '#D1FAE5', color: '#065F46' },
  cancelled: { bg: '#F1F5F9', color: '#64748B' }
};

function MeetingModal({ projects, onClose, onSaved, authenticatedRequest }) {
  const [form, setForm] = useState({
    title: '',
    projectId: '',
    meetingDate: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '11:00',
    location: '',
    videoLink: '',
    notes: '',
    attendees: []
  });

  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeeName, setAttendeeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function addAttendee() {
    if (!attendeeEmail.trim()) return;
    setForm((f) => ({
      ...f,
      attendees: [...f.attendees, { email: attendeeEmail.trim(), name: attendeeName.trim() || attendeeEmail.trim() }]
    }));
    setAttendeeEmail('');
    setAttendeeName('');
  }

  function removeAttendee(idx) {
    setForm((f) => ({ ...f, attendees: f.attendees.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createMeeting(authenticatedRequest, {
        ...form,
        projectId: form.projectId || null,
        location: form.location.trim() || null,
        videoLink: form.videoLink.trim() || null,
        notes: form.notes.trim() || null
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to schedule meeting.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3>Schedule Site Meeting / Review</h3>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              {error && <p className="form-error">{error}</p>}

              <label>
                Meeting Title
                <input
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="e.g. Site Safety Review & Milestone Walkthrough"
                  required
                />
              </label>

              <label>
                Associated Site Project
                <select value={form.projectId} onChange={(e) => setField('projectId', e.target.value)}>
                  <option value="">General / Company Wide</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <div className="form-grid">
                <label>
                  Meeting Date
                  <input
                    type="date"
                    value={form.meetingDate}
                    onChange={(e) => setField('meetingDate', e.target.value)}
                    required
                  />
                </label>

                <div className="form-grid" style={{ gap: 8 }}>
                  <label>
                    Start Time
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setField('startTime', e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    End Time
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setField('endTime', e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  Physical Location
                  <input
                    value={form.location}
                    onChange={(e) => setField('location', e.target.value)}
                    placeholder="e.g. Site Office Room B"
                  />
                </label>

                <label>
                  Video Call Link
                  <input
                    value={form.videoLink}
                    onChange={(e) => setField('videoLink', e.target.value)}
                    placeholder="https://meet.google.com/..."
                  />
                </label>
              </div>

              {/* Attendee Invitees */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>Invitees & Subcontractors</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                  <input
                    value={attendeeName}
                    onChange={(e) => setAttendeeName(e.target.value)}
                    placeholder="Name"
                  />
                  <input
                    type="email"
                    value={attendeeEmail}
                    onChange={(e) => setAttendeeEmail(e.target.value)}
                    placeholder="Email address"
                  />
                  <button type="button" className="secondary-button" onClick={addAttendee} style={{ minHeight: 44, touchAction: 'manipulation' }}>
                    <Plus size={16} /> Add Invitee
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {form.attendees.map((att, idx) => (
                    <span
                      key={idx}
                      className="badge"
                      style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', color: '#334155', padding: '4px 8px' }}
                    >
                      {att.name} ({att.email})
                      <button
                        type="button"
                        onClick={() => removeAttendee(idx)}
                        style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', padding: '0 4px', minHeight: 28 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MinutesModal({ meeting, onClose, onSaved, authenticatedRequest }) {
  const [minutes, setMinutes] = useState(meeting.notes || '');
  const [actionItems, setActionItems] = useState(meeting.actionItems || []);
  const [newAction, setNewAction] = useState({ description: '', assignee: '' });
  const [saving, setSaving] = useState(false);

  function addActionItem() {
    if (!newAction.description.trim()) return;
    setActionItems((prev) => [
      ...prev,
      { description: newAction.description.trim(), assignee: newAction.assignee.trim() || 'General', isCompleted: false }
    ]);
    setNewAction({ description: '', assignee: '' });
  }

  function toggleActionItem(idx) {
    setActionItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], isCompleted: !next[idx].isCompleted };
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveMeetingMinutes(authenticatedRequest, meeting.id, { minutes, actionItems });
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h3>Meeting Minutes & Action Items — {meeting.title}</h3>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-stack">
            <label>
              Discussion Minutes & Summary
              <textarea
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                rows={5}
                placeholder="Key discussion points, approvals, and decisions..."
                style={{ width: '100%', padding: 10, borderRadius: 8 }}
              />
            </label>

            <div>
              <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>Action Items & Follow-ups</strong>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={newAction.description}
                  onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                  placeholder="Action item task description"
                  style={{ flex: 2 }}
                />
                <input
                  value={newAction.assignee}
                  onChange={(e) => setNewAction({ ...newAction, assignee: e.target.value })}
                  placeholder="Assignee"
                  style={{ flex: 1 }}
                />
                <button type="button" className="secondary-button" onClick={addActionItem}>
                  Add
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actionItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: '#F8FAFC',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={() => toggleActionItem(idx)}
                      style={{ minHeight: 'auto', width: 'auto' }}
                    />
                    <span style={{ flex: 1, textDecoration: item.isCompleted ? 'line-through' : 'none', color: item.isCompleted ? '#94A3B8' : 'inherit' }}>
                      {item.description}
                    </span>
                    <span className="badge" style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: '0.72rem' }}>
                      {item.assignee}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Minutes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MeetingsPage() {
  const { authenticatedRequest } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [minutesMeeting, setMinutesMeeting] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meetData, projData] = await Promise.all([
        listMeetings(authenticatedRequest),
        listProjects(authenticatedRequest)
      ]);
      setMeetings(meetData);
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

  async function handleOpenMinutes(meetingId) {
    try {
      const detail = await getMeetingDetail(authenticatedRequest, meetingId);
      setMinutesMeeting(detail);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(meetingId) {
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    try {
      await deleteMeeting(authenticatedRequest, meetingId);
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
            title="Meetings & Site Reviews"
            subtitle="Coordinate site walkthroughs, safety audits, invitations, and minutes recorder."
          >
            <button className="primary-button" type="button" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Schedule Meeting
            </button>
          </Header>

          {error && <p className="form-error" style={{ marginBottom: 20 }}>{error}</p>}

          <section className="panel">
            <div className="section-header">
              <h2 style={{ margin: 0 }}>Upcoming & Recorded Meetings ({meetings.length})</h2>
            </div>

            {loading ? (
              <p className="muted" style={{ padding: 20 }}>Loading meetings...</p>
            ) : meetings.length === 0 ? (
              <div className="empty-state">
                <Video size={40} />
                <p>No meetings scheduled yet. Click "Schedule Meeting" to create one.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {meetings.map((m) => {
                  const s = STATUS_BADGES[m.status] || STATUS_BADGES.scheduled;
                  return (
                    <div
                      key={m.id}
                      className="mobile-card"
                      style={{
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 14
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span className="badge" style={{ background: s.bg, color: s.color }}>
                            {m.status}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={13} /> {m.meetingDate}
                          </span>
                        </div>

                        <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {m.title}
                        </h3>

                        {m.projectName && (
                          <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--brand-teal-dark)', fontWeight: 600 }}>
                            Site: {m.projectName}
                          </p>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: '#64748B' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={13} /> {m.startTime} {m.endTime ? `– ${m.endTime}` : ''}
                          </div>
                          {m.location && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <MapPin size={13} /> {m.location}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          borderTop: '1px solid var(--border-subtle)',
                          paddingTop: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {m.videoLink && (
                            <a
                              href={m.videoLink}
                              target="_blank"
                              rel="noreferrer"
                              className="accent-button"
                              style={{ fontSize: '0.78rem', padding: '6px 12px', minHeight: 44, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, touchAction: 'manipulation' }}
                            >
                              <Video size={14} /> Call
                            </a>
                          )}

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleOpenMinutes(m.id)}
                            style={{ fontSize: '0.78rem', padding: '6px 12px', minHeight: 44, touchAction: 'manipulation' }}
                          >
                            <FileText size={14} /> Minutes
                          </button>
                        </div>

                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => handleDelete(m.id)}
                          style={{ padding: 8, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
                          title="Delete meeting"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <FloatingActionButton
            label="Schedule"
            onClick={() => setShowCreateModal(true)}
          />
        </PullToRefresh>
      </section>

      {showCreateModal && (
        <MeetingModal
          projects={projects}
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => {
            setShowCreateModal(false);
            await loadData();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}

      {minutesMeeting && (
        <MinutesModal
          meeting={minutesMeeting}
          onClose={() => setMinutesMeeting(null)}
          onSaved={async () => {
            setMinutesMeeting(null);
            await loadData();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}
    </main>
  );
}
