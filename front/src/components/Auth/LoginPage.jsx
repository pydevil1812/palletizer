import { useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';

export function LoginPage({ onLogin }) {
  const { t } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-box">
        <div className="auth-logo">📦</div>
        <h1 className="auth-title">{t('login.title')}</h1>
        <p className="auth-sub muted">{t('login.subtitle')}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="banner err" style={{ display: 'block', marginBottom: 14 }}>
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-username">{t('login.username')}</label>
            <input
              id="auth-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="auth-password">{t('login.password')}</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            className="primary auth-submit"
            disabled={loading}
          >
            {loading ? t('login.signing') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
