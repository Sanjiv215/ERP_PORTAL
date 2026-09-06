import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/http.js';
import { isDemoMode } from '../api/demo/demoMode.js';

const AuthContext = createContext(null);
const DEMO_AUTH_KEY = 'erp_portal_demo_auth_session';

let pendingRefreshPromise = null;

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const applySession = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);

    if (session.tenant) {
      setTenant(session.tenant);
    }

    if (isDemoMode() && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(session));
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  const signup = useCallback(
    async (payload) => {
      const session = await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      applySession(session);
      return session;
    },
    [applySession]
  );

  const login = useCallback(
    async (payload) => {
      const session = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      applySession(session);
      return session;
    },
    [applySession]
  );

  const refresh = useCallback(async () => {
    if (isDemoMode()) {
      return accessToken;
    }

    if (pendingRefreshPromise) {
      return pendingRefreshPromise;
    }

    pendingRefreshPromise = (async () => {
      try {
        const session = await apiRequest('/auth/refresh', { method: 'POST' });
        applySession(session);
        return session.accessToken;
      } finally {
        pendingRefreshPromise = null;
      }
    })();

    return pendingRefreshPromise;
  }, [accessToken, applySession]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' }, accessToken);
    } catch {
      // Gracefully ignore network errors during sign-out
    } finally {
      setAccessToken(null);
      setUser(null);
      setTenant(null);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(DEMO_AUTH_KEY);
        } catch {
          // Ignore storage errors
        }
      }
    }
  }, [accessToken]);

  const authenticatedRequest = useCallback(
    async (path, options = {}) => {
      try {
        return await apiRequest(path, options, accessToken);
      } catch (error) {
        if (error.status !== 401 || isDemoMode()) {
          throw error;
        }

        const nextToken = await refresh();
        return apiRequest(path, options, nextToken);
      }
    },
    [accessToken, refresh]
  );

  // App boot: check demo session or perform silent session restore via httpOnly refresh cookie
  useEffect(() => {
    let mounted = true;

    if (isDemoMode()) {
      try {
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem(DEMO_AUTH_KEY) : null;
        if (saved) {
          const session = JSON.parse(saved);
          if (mounted && session?.accessToken && session?.user) {
            applySession(session);
          }
        }
      } catch (e) {
        console.warn('Could not restore demo session', e);
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
      return () => {
        mounted = false;
      };
    }

    refresh()
      .catch(() => {
        if (mounted) {
          setAccessToken(null);
          setUser(null);
          setTenant(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setBootstrapping(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [applySession, refresh]);

  const value = useMemo(
    () => ({
      accessToken,
      user,
      tenant,
      bootstrapping,
      isAuthenticated: Boolean(accessToken && user),
      signup,
      login,
      refresh,
      authenticatedRequest,
      logout
    }),
    [accessToken, authenticatedRequest, bootstrapping, login, logout, refresh, signup, tenant, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
