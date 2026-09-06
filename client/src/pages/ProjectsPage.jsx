import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Building2, Calendar, User, X, Trash2 } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject
} from '../api/projects.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';
import { FloatingActionButton } from '../components/FloatingActionButton.jsx';
import { PullToRefresh } from '../components/PullToRefresh.jsx';

const STATUS_BADGES = {
  active: { bg: '#D1FAE5', text: '#065F46', dot: '#10B981', label: 'Active Site' },
  planned: { bg: '#EDE9FE', text: '#5B21B6', dot: '#8B5CF6', label: 'Planned' },
  on_hold: { bg: '#FEF9C3', text: '#854D0E', dot: '#F59E0B', label: 'On Hold' },
  completed: { bg: '#E0F2FE', text: '#0369A1', dot: '#0284C7', label: 'Completed' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'Cancelled' }
};

function ProjectModal({ initialData, onClose, onSaved, authenticatedRequest }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    clientName: initialData?.clientName || '',
    status: initialData?.status || 'active',
    startDate: initialData?.startDate || new Date().toISOString().slice(0, 10)
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        clientName: form.clientName.trim() || null,
        status: form.status,
        startDate: form.startDate || null
      };

      if (initialData?.id) {
        await updateProject(authenticatedRequest, initialData.id, payload);
      } else {
        await createProject(authenticatedRequest, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>{initialData?.id ? 'Edit Site Project' : 'Create Site Project'}</h3>
          <button className="close-btn" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              {error && <p className="form-error">{error}</p>}

              <label>
                Project / Site Name
                <input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Skyline Luxury Villa Phase 1"
                  required
                />
              </label>

              <label>
                Client / Firm Name
                <input
                  value={form.clientName}
                  onChange={(e) => setField('clientName', e.target.value)}
                  placeholder="e.g. Skyline Developers Ltd"
                />
              </label>

              <div className="form-grid">
                <label>
                  Current Status
                  <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                    <option value="active">Active Site</option>
                    <option value="planned">Planned</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>

                <label>
                  Start Date
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setField('startDate', e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const { user, authenticatedRequest } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [modalData, setModalData] = useState(null);

  const canManage = user?.role === 'TenantAdmin' || user?.role === 'Manager';
  const isAdmin = user?.role === 'TenantAdmin';

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects(authenticatedRequest);
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleDelete(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteProject(authenticatedRequest, projectId);
      await loadProjects();
    } catch (err) {
      alert(err.message);
    }
  }

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.clientName && p.clientName.toLowerCase().includes(q)) ||
        p.status.toLowerCase().includes(q)
    );
  }, [projects, search]);

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <PullToRefresh onRefresh={loadProjects}>
          <Header
            title="Projects & Construction Sites"
            subtitle="Track active construction sites, client contracts, and milestones."
          >
            {canManage && (
              <button
                className="primary-button"
                type="button"
                onClick={() => setModalData({})}
              >
                <Plus size={16} /> New Project
              </button>
            )}
          </Header>

          {error && <p className="form-error" style={{ marginBottom: 20 }}>{error}</p>}

          <section className="panel">
            <div className="section-header">
              <h2 style={{ margin: 0 }}>Active Projects ({filteredProjects.length})</h2>

              <div className="search-input-wrap" style={{ minWidth: 260 }}>
                <Search size={16} />
                <input
                  className="search-input"
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <p className="muted" style={{ padding: 20 }}>Loading projects...</p>
            ) : filteredProjects.length === 0 ? (
              <div className="empty-state">
                <Building2 size={40} />
                <p>No projects found. Click "New Project" to create your first site.</p>
              </div>
            ) : (
              <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {filteredProjects.map((p) => {
                  const s = STATUS_BADGES[p.status] || STATUS_BADGES.active;
                  return (
                    <div
                      key={p.id}
                      className="project-card mobile-card"
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
                          <span
                            className="badge"
                            style={{ background: s.bg, color: s.text }}
                          >
                            <span className="badge-dot" style={{ background: s.dot }} />
                            {s.label}
                          </span>
                          {p.startDate && (
                            <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={12} /> {p.startDate}
                            </span>
                          )}
                        </div>

                        <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {p.name}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={13} /> {p.clientName || 'General Client'}
                        </p>
                      </div>

                      {canManage && (
                        <div
                          style={{
                            borderTop: '1px solid var(--border-subtle)',
                            paddingTop: 10,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 6
                          }}
                        >
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setModalData(p)}
                            style={{ fontSize: '0.78rem', padding: '4px 10px', minHeight: 32 }}
                          >
                            Edit
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => handleDelete(p.id)}
                              style={{ padding: 6, minHeight: 32 }}
                              title="Delete project"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {canManage && (
            <FloatingActionButton
              label="New Project"
              onClick={() => setModalData({})}
            />
          )}
        </PullToRefresh>
      </section>

      {modalData && (
        <ProjectModal
          initialData={modalData.id ? modalData : null}
          onClose={() => setModalData(null)}
          onSaved={async () => {
            setModalData(null);
            await loadProjects();
          }}
          authenticatedRequest={authenticatedRequest}
        />
      )}
    </main>
  );
}
