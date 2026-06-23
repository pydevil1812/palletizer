import { useState } from 'react';

export function LoginPage({ onLogin }) {
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
        <h1 className="auth-title">Pallet Stacking Studio</h1>
        <p className="auth-sub muted">box → pallet layout · rotatable 3D · exportable report</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="banner err" style={{ display: 'block', marginBottom: 14 }}>
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-username">Username</label>
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
            <label htmlFor="auth-password">Password</label>
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
            {loading ? '…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
