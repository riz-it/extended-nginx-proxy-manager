import { useState } from 'react';

import { api } from './api';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [identity, setIdentity] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.login(identity, secret);
      if (res.token) {
        localStorage.setItem('npm_auth_token', res.token);
        onLogin();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="header-logo">LB</div>
        </div>
        
        <h2 style={{ fontSize: '20px', marginBottom: '4px', fontWeight: 600 }}>Nginx Proxy Manager</h2>
        <p style={{ marginBottom: '2rem', fontSize: '13px', color: 'var(--text-muted)' }}>Load Balancer Management Module</p>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              className="form-input"
              required
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="admin@example.com"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-input"
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
