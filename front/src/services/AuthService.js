const BASE = '/api/auth';
const TOKEN_KEY = 'palletizer_token';
const SESSION_KEY = 'palletizer_session';

export class AuthService {
  static getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  static getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  static _setSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: data.username, role: data.role }));
  }

  static clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  static async login(username, password) {
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Login failed');
    AuthService._setSession(body);
    return body;
  }

  static async register(username, password) {
    const res = await fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Registration failed');
    return body;
  }

  static async logout() {
    const token = AuthService.getToken();
    if (token) {
      await fetch(`${BASE}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    AuthService.clearSession();
  }
}

export function authHeaders() {
  const token = AuthService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    AuthService.clearSession();
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }
  return res;
}
