import { useCallback, useState } from 'react';
import { AuthService } from '../services/AuthService.js';

export function useAuth() {
  const [session, setSession] = useState(() => AuthService.getSession());

  const login = useCallback(async (username, password) => {
    const data = await AuthService.login(username, password);
    setSession({ username: data.username, role: data.role });
    return data;
  }, []);

  const register = useCallback(async (username, password) => {
    return AuthService.register(username, password);
  }, []);

  const logout = useCallback(async () => {
    await AuthService.logout();
    setSession(null);
  }, []);

  return {
    session,
    isLoggedIn: !!session,
    isAdmin: session?.role === 'admin',
    login,
    register,
    logout,
  };
}
