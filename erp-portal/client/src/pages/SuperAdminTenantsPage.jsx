import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { Header } from '../components/Header.jsx';

const STATUSES = ['trial', 'active', 'suspended', 'cancelled'];

export function SuperAdminTenantsPage() {
  const { authenticatedRequest } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadTenants() {
    setLoading(true);
    setError('');

    try {
      const data = await authenticatedRequest('/platform/tenants');
      setTenants(data.tenants);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTenants();
  }, []);

  async function changeStatus(tenant, status) {
    try {
      const data = await authenticatedRequest(`/platform/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setTenants((current) => current.map((item) => (item.id === tenant.id ? data.tenant : item)));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="content">
        <Header
          title="Platform Tenant Management"
          subtitle="Manage multi-tenant organizations and subscription states without viewing tenant-isolated private data."
        />

        <section className="panel">
          <div className="section-header">
            <h2 style={{ margin: 0 }}>Registered Organizations ({tenants.length})</h2>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading ? (
            <p className="muted" style={{ padding: 20 }}>Loading tenants...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Organization / Business</th>
                    <th>GSTIN</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Created On</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.businessName}</strong></td>
                      <td>{t.gstNumber || '—'}</td>
                      <td>
                        <span className="badge" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
                          {t.subscriptionPlan}
                        </span>
                      </td>
                      <td>
                        <select
                          value={t.status}
                          onChange={(event) => changeStatus(t, event.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700 }}
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="muted">{new Date(t.createdAt).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
