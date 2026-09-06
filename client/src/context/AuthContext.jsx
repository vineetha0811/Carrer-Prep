import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { request, setToken, isLoggedIn, getToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUser = useCallback(async () => {
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }
    try {
      const { user } = await request('/auth/me');
      setUser(user);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('cr:unauthorized', handler);
    return () => window.removeEventListener('cr:unauthorized', handler);
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await request('/auth/login', { method: 'POST', body: { email, password } });
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, []);

  const signup = useCallback(async (name, email, password) => {
    setError(null);
    try {
      const data = await request('/auth/signup', { method: 'POST', body: { name, email, password } });
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, error, login, signup, logout, refresh, token: getToken() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}