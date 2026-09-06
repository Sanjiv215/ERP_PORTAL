import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { SuperAdminTenantsPage } from './pages/SuperAdminTenantsPage.jsx';
import { EmployeesPage } from './pages/EmployeesPage.jsx';
import { ProjectsPage } from './pages/ProjectsPage.jsx';
import { AttendancePage } from './pages/AttendancePage.jsx';
import { PayrollPage } from './pages/PayrollPage.jsx';
import { PayslipPage } from './pages/PayslipPage.jsx';
import { AdvancesPage } from './pages/AdvancesPage.jsx';
import { TransactionsPage } from './pages/TransactionsPage.jsx';
import { PLPage } from './pages/PLPage.jsx';
import { QuotationsPage } from './pages/QuotationsPage.jsx';
import { InvoicesPage } from './pages/InvoicesPage.jsx';
import { BillsPage } from './pages/BillsPage.jsx';
import { PendingPaymentsPage } from './pages/PendingPaymentsPage.jsx';
import { MeetingsPage } from './pages/MeetingsPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { RoleRoute } from './components/RoleRoute.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { NavProvider } from './state/NavContext.jsx';

export function App() {
  return (
    <ErrorBoundary>
      <NavProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Dashboard */}
        <Route
          path="/app/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Settings */}
        <Route
          path="/app/settings"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin']}>
                <SettingsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Employees */}
        <Route
          path="/app/employees"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Manager', 'Accountant']}>
                <EmployeesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Projects */}
        <Route
          path="/app/projects"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Manager', 'Accountant', 'Employee']}>
                <ProjectsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Attendance */}
        <Route
          path="/app/attendance"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Manager', 'Accountant']}>
                <AttendancePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Payroll & Payslips */}
        <Route
          path="/app/payroll"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant']}>
                <PayrollPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/payroll/payslip/:runId/:lineItemId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant', 'Employee']}>
                <PayslipPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Global Staff Advances Ledger */}
        <Route
          path="/app/advances"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant', 'Manager']}>
                <AdvancesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Financial Transaction History Timeline */}
        <Route
          path="/app/transactions"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant', 'Manager']}>
                <TransactionsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Profit & Loss */}
        <Route
          path="/app/pl"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant', 'Manager']}>
                <PLPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Quotations, Invoices, Bills, Aging */}
        <Route
          path="/app/quotations"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant', 'Manager']}>
                <QuotationsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/invoices"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant', 'Manager']}>
                <InvoicesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/bills"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant', 'Manager']}>
                <BillsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/pending-payments"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Accountant']}>
                <PendingPaymentsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Meetings */}
        <Route
          path="/app/meetings"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['TenantAdmin', 'Manager', 'Accountant', 'Employee']}>
                <MeetingsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Platform SuperAdmin */}
        <Route
          path="/superadmin/tenants"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['PlatformSuperAdmin']}>
                <SuperAdminTenantsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* 404 Not Found Page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </NavProvider>
    </ErrorBoundary>
  );
}
