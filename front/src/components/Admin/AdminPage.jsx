import { useCallback, useEffect, useState } from 'react';
import { authHeaders } from '../../services/AuthService.js';
import { fmt } from '../../utils/format.js';

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export function AdminPage({ onBack, currentUsername }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPwForm, setShowPwForm] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPw, setNewUserPw] = useState('');
  const [createError, setCreateError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await apiRequest('/api/admin/users'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setHistoryEntries(await apiRequest('/api/admin/history'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else loadHistory();
  }, [tab, loadUsers, loadHistory]);

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user? Their history entries will remain.')) return;
    try {
      await apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const savePassword = async (id) => {
    if (!newPw) return;
    try {
      await apiRequest(`/api/admin/users/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPw }),
      });
      setShowPwForm(null);
      setNewPw('');
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleRole = async (user) => {
    const next = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Change ${user.username}'s role to "${next}"?`)) return;
    try {
      await apiRequest(`/api/admin/users/${user.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: next }),
      });
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteHistoryEntry = async (id) => {
    try {
      await apiRequest(`/api/admin/history/${id}`, { method: 'DELETE' });
      setHistoryEntries((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const createUser = async () => {
    setCreateError('');
    try {
      await apiRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername, password: newUserPw }),
      });
      setShowCreateForm(false);
      setNewUsername('');
      setNewUserPw('');
      await loadUsers();
    } catch (err) {
      setCreateError(err.message);
    }
  };

  const clearAllHistory = async () => {
    if (!window.confirm('Delete ALL history? This cannot be undone.')) return;
    try {
      await apiRequest('/api/admin/history', { method: 'DELETE' });
      setHistoryEntries([]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <button className="ghost" onClick={onBack}>
          ← Back to App
        </button>
        <h2 className="admin-heading">Administration</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          Logged in as <strong>{currentUsername}</strong>
        </span>
      </div>

      <div className="admin-tabs-bar">
        <button
          className={`admin-tab${tab === 'users' ? ' active' : ''}`}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          className={`admin-tab${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          Request History
        </button>
      </div>

      <div className="admin-content">
        {error && (
          <div className="banner err" style={{ display: 'block', marginBottom: 12 }}>
            {error}
          </div>
        )}
        {loading && <p className="muted">Loading…</p>}

        {/* ── Users ── */}
        {tab === 'users' && !loading && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                className="primary"
                style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={() => { setShowCreateForm((v) => !v); setCreateError(''); }}
              >
                {showCreateForm ? 'Cancel' : '+ Create User'}
              </button>
            </div>
            {showCreateForm && (
              <div style={{ background: 'var(--panel2)', padding: '12px 16px', borderRadius: 6, marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>New user</strong>
                {createError && (
                  <div className="banner err" style={{ display: 'block', margin: '6px 0' }}>
                    {createError}
                  </div>
                )}
                <div className="admin-pw-row" style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Username (min 3 chars)"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="password"
                    placeholder="Password (min 6 chars)"
                    value={newUserPw}
                    onChange={(e) => setNewUserPw(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="primary" onClick={createUser}>Create</button>
                </div>
              </div>
            )}
          <div className="admin-table-wrap">
            <table className="boxes">
              <thead>
                <tr>
                  <th className="l">ID</th>
                  <th className="l">Username</th>
                  <th className="l">Role</th>
                  <th className="l">Created</th>
                  <th className="l">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <>
                    <tr key={u.id}>
                      <td className="l">{u.id === 0 ? '–' : u.id}</td>
                      <td className="l">{u.username}</td>
                      <td className="l">
                        <span className={`role-badge ${u.role}`}>{u.role}</span>
                      </td>
                      <td className="l">{u.created_at}</td>
                      <td className="l">
                        {u.builtin ? (
                          <span className="muted" style={{ fontSize: 11 }}>built-in</span>
                        ) : u.username === currentUsername ? (
                          <span className="muted" style={{ fontSize: 11 }}>you</span>
                        ) : (
                          <div className="admin-row-actions">
                            <button
                              className="ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => {
                                setShowPwForm(showPwForm === u.id ? null : u.id);
                                setNewPw('');
                              }}
                            >
                              Password
                            </button>
                            <button
                              className="ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => toggleRole(u)}
                            >
                              → {u.role === 'admin' ? 'user' : 'admin'}
                            </button>
                            <button
                              className="ghost"
                              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--danger)' }}
                              onClick={() => deleteUser(u.id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {showPwForm === u.id && (
                      <tr key={`pw-${u.id}`}>
                        <td colSpan={5} style={{ background: 'var(--panel2)', padding: '8px 12px' }}>
                          <div className="admin-pw-row">
                            <input
                              type="password"
                              placeholder="New password (min 6 chars)"
                              value={newPw}
                              onChange={(e) => setNewPw(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button className="primary" onClick={() => savePassword(u.id)}>
                              Save
                            </button>
                            <button
                              className="ghost"
                              onClick={() => { setShowPwForm(null); setNewPw(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="l muted">No users.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* ── History ── */}
        {tab === 'history' && !loading && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                className="ghost"
                style={{ color: 'var(--danger)' }}
                onClick={clearAllHistory}
              >
                Delete All History
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="boxes history-table">
                <thead>
                  <tr>
                    <th className="l">Date</th>
                    <th className="l">User</th>
                    <th className="l">Label</th>
                    <th>Boxes</th>
                    <th>Layers</th>
                    <th>Fill</th>
                    <th>Height</th>
                    <th>Weight</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.map((row) => (
                    <tr key={row.id}>
                      <td className="l">{row.created_at}</td>
                      <td className="l">{row.username || '–'}</td>
                      <td className="l">{row.label}</td>
                      <td>{fmt(row.total_boxes)}</td>
                      <td>{fmt(row.layers)}</td>
                      <td>{fmt(row.fill_pct, 0)}%</td>
                      <td>{fmt(row.height_mm, 0)}</td>
                      <td>{fmt(row.weight_kg, 0)}</td>
                      <td>
                        <button
                          className="ghost row-delete"
                          title="Delete this entry"
                          onClick={() => deleteHistoryEntry(row.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {historyEntries.length === 0 && (
                    <tr>
                      <td colSpan={9} className="l muted">No history entries.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
