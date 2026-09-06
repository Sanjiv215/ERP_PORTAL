import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';

export function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}
