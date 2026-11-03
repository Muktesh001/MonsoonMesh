import { useState, type FormEvent } from 'react';
import { Droplets, Eye, EyeOff, ShieldCheck, MapPin, Activity, AlertTriangle, Wifi } from 'lucide-react';
import { login, register, ApiError } from '../api.ts';
import type { User } from '../types.ts';

type LoginPageProps = {
  onLogin: (token: string, user: User) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('operator@monsoonmesh.local');
  const [password, setPassword] = useState('MonsoonDemo!2026');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result =
        mode === 'login'
          ? await login(email, password)
          : await register(email, password, displayName);
      if (rememberMe) {
        localStorage.setItem('mm-token', result.token);
        localStorage.setItem('mm-user', JSON.stringify(result.user));
      }
      onLogin(result.token, result.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setError(err.message);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    if (mode === 'login') {
      setEmail('');
      setPassword('');
    } else {
      setEmail('operator@monsoonmesh.local');
      setPassword('MonsoonDemo!2026');
    }
  }

  const isNetworkError = error.includes('Docker') || error.includes('server');

  return (
    <div className="login-root">
      {/* ── Left: branding panel ───────────────────────────────────────── */}
      <aside className="login-hero" aria-hidden="true">
        <div className="login-hero-grid" />
        <div className="login-hero-content">
          <div className="login-hero-badge">
            <Activity size={14} />
            <span>FLOOD INTELLIGENCE PLATFORM</span>
          </div>
          <h2 className="login-hero-headline">
            See the city.<br />
            Understand the risk.<br />
            <em>Coordinate a response.</em>
          </h2>
          <p className="login-hero-sub">
            MonsoonMesh gives operators and field teams a unified view of flood conditions, incident reports, and resource coordination across Pune.
          </p>
          <div className="login-hero-location">
            <MapPin size={15} />
            <span>Pune Metropolitan Area</span>
            <span className="login-hero-sep">·</span>
            <span className="login-hero-note">Illustrative demonstration environment</span>
          </div>
          <div className="login-hero-stats">
            <div className="login-hero-stat">
              <strong>Real-time</strong>
              <span>Incident tracking</span>
            </div>
            <div className="login-hero-stat-div" />
            <div className="login-hero-stat">
              <strong>AI-assisted</strong>
              <span>Risk assessment</span>
            </div>
            <div className="login-hero-stat-div" />
            <div className="login-hero-stat">
              <strong>PostGIS</strong>
              <span>Geospatial zones</span>
            </div>
          </div>
        </div>
        {/* Decorative rain animation */}
        <div className="login-rain" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <span key={i} />)}
        </div>
        {/* Decorative orbits */}
        <div className="login-orbit login-orbit-1" />
        <div className="login-orbit login-orbit-2" />
        <div className="login-orbit login-orbit-3" />
      </aside>

      {/* ── Right: auth card ────────────────────────────────────────────── */}
      <main className="login-panel">
        <div className="login-card">
          {/* Brand mark */}
          <div className="login-brand">
            <div className="login-brand-icon">
              <Droplets size={22} />
            </div>
            <div>
              <span className="login-brand-name">monsoon<strong>mesh</strong></span>
              <span className="login-brand-env">OPERATIONS CONSOLE</span>
            </div>
          </div>

          <h1 className="login-title">
            {mode === 'login' ? 'Sign in to your workspace' : 'Create a reporter account'}
          </h1>
          <p className="login-subtitle">
            {mode === 'login'
              ? 'Enter your credentials to access the operations dashboard.'
              : 'New accounts are granted the Field Reporter role. Contact an administrator to upgrade.'}
          </p>

          {/* Network error with extra guidance */}
          {error && isNetworkError && (
            <div className="login-error login-error-network">
              <Wifi size={15} />
              <div>
                <strong>Cannot reach the server</strong>
                <p>Make sure the backend services are running:</p>
                <code>docker compose up</code>
              </div>
            </div>
          )}

          {/* Regular error */}
          {error && !isNetworkError && (
            <div className="login-error">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={(e) => void submit(e)} noValidate>
            {mode === 'register' && (
              <div className="field">
                <label className="field-label" htmlFor="displayName">Full name</label>
                <input
                  id="displayName"
                  className="field-input"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Smith"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="email">Email address</label>
              <input
                id="email"
                className="field-input"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <div className="field-label-row">
                <label className="field-label" htmlFor="password">Password</label>
              </div>
              <div className="field-password">
                <input
                  id="password"
                  className="field-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'register' ? 'At least 12 characters' : ''}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === 'register' ? 12 : 8}
                  required
                />
                <button
                  type="button"
                  className="field-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={busy}
            >
              {busy
                ? <><span className="btn-spinner" />Please wait…</>
                : mode === 'login'
                  ? 'Sign in to workspace'
                  : 'Create account'}
            </button>
          </form>

          {/* Demo credentials notice */}
          {mode === 'login' && (
            <div className="login-demo-notice">
              <ShieldCheck size={14} />
              <div>
                <strong>Demo credentials pre-filled</strong>
                <span>All sample records are synthetic demonstration data — not real incidents.</span>
              </div>
            </div>
          )}

          <div className="login-switch">
            <span>{mode === 'login' ? "Need field reporter access?" : 'Already have an account?'}</span>
            <button type="button" onClick={switchMode}>
              {mode === 'login' ? 'Create an account' : 'Sign in instead'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
