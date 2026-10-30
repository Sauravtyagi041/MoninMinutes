import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, setCsrfToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  const apply = useCallback((data) => {
    setCsrfToken(data?.csrfToken ?? null);
    setUser(data?.user ?? null);
  }, []);

  // Restore the session from the HttpOnly cookie on page load.
  useEffect(() => {
    let alive = true;
    auth
      .me()
      .then(({ data }) => alive && apply(data))
      .catch(() => alive && apply(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [apply]);

  useEffect(() => {
    const onExpired = () => {
      apply(null);
      setExpired(true);
    };
    window.addEventListener('mm:session-expired', onExpired);
    return () => window.removeEventListener('mm:session-expired', onExpired);
  }, [apply]);

  const value = useMemo(
    () => ({
      user,
      loading,
      expired,
      login: async (body) => {
        const { data } = await auth.login(body);
        setExpired(false);
        apply(data);
      },
      register: async (body) => {
        const { data } = await auth.register(body);
        setExpired(false);
        apply(data);
      },
      logout: async () => {
        try {
          await auth.logout();
        } finally {
          apply(null);
        }
      },
    }),
    [user, loading, expired, apply],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
