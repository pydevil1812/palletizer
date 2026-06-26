import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../services/AuthService.js';
import { fmt } from '../../utils/format.js';
import { useLang } from '../../i18n/LangContext.jsx';

async function apiRequest(url, options = {}) {
  const res = await apiFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export function AdminPage({ onBack, currentUsername }) {
  const { t } = useLang();
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
    if (!window.confirm(t('admin.confirmDeleteUser'))) return;
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
    if (!window.confirm(t('admin.confirmRoleChange', { username: user.username, role: next }))) return;
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
    if (!window.confirm(t('admin.confirmDeleteAllHistory'))) return;
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
          {t('admin.backToApp')}
        </button>
        <h2 className="admin-heading">{t('admin.heading')}</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          {t('admin.loggedAs')} <strong>{currentUsername}</strong>
        </span>
      </div>

      <div className="admin-tabs-bar">
        <button
          className={`admin-tab${tab === 'users' ? ' active' : ''}`}
          onClick={() => setTab('users')}
        >
          {t('admin.tabUsers')}
        </button>
        <button
          className={`admin-tab${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          {t('admin.tabHistory')}
        </button>
      </div>

      <div className="admin-content">
        {error && (
          <div className="banner err" style={{ display: 'block', marginBottom: 12 }}>
            {error}
          </div>
        )}
        {loading && <p className="muted">{t('admin.loading')}</p>}

        {/* ── Users ── */}
        {tab === 'users' && !loading && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                className="primary"
                style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={() => { setShowCreateForm((v) => !v); setCreateError(''); }}
              >
                {showCreateForm ? t('admin.cancel') : t('admin.createUser')}
              </button>
            </div>
            {showCreateForm && (
              <div style={{ background: 'var(--panel2)', padding: '12px 16px', borderRadius: 6, marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>{t('admin.newUser')}</strong>
                {createError && (
                  <div className="banner err" style={{ display: 'block', margin: '6px 0' }}>
                    {createError}
                  </div>
                )}
                <div className="admin-pw-row" style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder={t('admin.usernamePlaceholder')}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="password"
                    placeholder={t('admin.passwordPlaceholder')}
                    value={newUserPw}
                    onChange={(e) => setNewUserPw(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="primary" onClick={createUser}>{t('admin.create')}</button>
                </div>
              </div>
            )}
          <div className="admin-table-wrap">
            <table className="boxes">
              <thead>
                <tr>
                  <th className="l">{t('admin.colId')}</th>
                  <th className="l">{t('admin.colUsername')}</th>
                  <th className="l">{t('admin.colRole')}</th>
                  <th className="l">{t('admin.colCreated')}</th>
                  <th className="l">{t('admin.colActions')}</th>
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
                          <span className="muted" style={{ fontSize: 11 }}>{t('admin.builtin')}</span>
                        ) : u.username === currentUsername ? (
                          <span className="muted" style={{ fontSize: 11 }}>{t('admin.you')}</span>
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
                              {t('admin.changePassword')}
                            </button>
                            <button
                              className="ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => toggleRole(u)}
                            >
                              {t('admin.makeRole', { role: u.role === 'admin' ? 'user' : 'admin' })}
                            </button>
                            <button
                              className="ghost"
                              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--danger)' }}
                              onClick={() => deleteUser(u.id)}
                            >
                              {t('admin.delete')}
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
                              placeholder={t('admin.newPasswordPlaceholder')}
                              value={newPw}
                              onChange={(e) => setNewPw(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button className="primary" onClick={() => savePassword(u.id)}>
                              {t('admin.save')}
                            </button>
                            <button
                              className="ghost"
                              onClick={() => { setShowPwForm(null); setNewPw(''); }}
                            >
                              {t('admin.cancel')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="l muted">{t('admin.noUsers')}</td>
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
                {t('admin.deleteAllHistory')}
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="boxes history-table">
                <thead>
                  <tr>
                    <th className="l">{t('history.colDate')}</th>
                    <th className="l">{t('history.colUser')}</th>
                    <th className="l">{t('history.colLabel')}</th>
                    <th>{t('history.colBoxes')}</th>
                    <th>{t('history.colLayers')}</th>
                    <th>{t('history.colFill')}</th>
                    <th>{t('history.colHeight')}</th>
                    <th>{t('history.colWeight')}</th>
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
                          title={t('history.deleteEntry')}
                          onClick={() => deleteHistoryEntry(row.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {historyEntries.length === 0 && (
                    <tr>
                      <td colSpan={9} className="l muted">{t('admin.noHistoryEntries')}</td>
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
