import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bell,
  Check, ChevronDown, CloudRain, Droplets, FilePlus2, Gauge,
  LogOut, Map as MapIcon, MapPin, Menu, MessageSquareText,
  Search, ShieldCheck, Siren, X,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
type User = { id: string; email: string; role: 'ADMIN' | 'OPERATOR' | 'FIELD_REPORTER'; displayName: string };
type Incident = { id: string; title: string; category: string; severity: string; status: string; created_at: string; is_synthetic: boolean };
type Dashboard = {
  summary: { total: number; verified: number; unresolved: number };
  recent: Incident[];
  riskDistribution: { category: string; count: number }[];
  dataLabel: string;
};
type Page = 'Overview' | 'Live map' | 'Incidents' | 'Risk analysis' | 'Simulation' | 'Analytics';
const RiskMap = lazy(() => import('./RiskMap.tsx'));

function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
  }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Request failed');
    return body as T;
  });
}

function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [registering, setRegistering] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('operator@monsoonmesh.local');
  const [password, setPassword] = useState('MonsoonDemo!2026');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/${registering ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registering ? { displayName, email, password } : { email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Sign in failed');
      onLogin(body.token as string, body.user as User);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in'); }
    finally { setBusy(false); }
  }
  return <main className="login-page">
    <div className="login-card">
      <div className="brand-mark"><Droplets size={23} /></div>
      <span className="eyebrow">MONSOONMESH / OPERATIONS</span>
      <h1>Flood intelligence,<br /><span>in one place.</span></h1>
      <p className="muted">Sign in to the Pune urban flood decision-support platform.</p>
      <form onSubmit={submit} className="login-form">
        {registering && <label>Full name<input autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} maxLength={100} required /></label>}
        <label>Email address<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 12 : 8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create reporter account' : 'Sign in to workspace'}<span>→</span></button>
      </form>
      <div className="demo-note"><ShieldCheck size={16} /><span>{registering ? 'New accounts are restricted to the field reporter role.' : 'Local demo account prefilled · all sample records are synthetic'}</span></div>
      <button className="login-toggle" onClick={() => { setRegistering(!registering); setError(''); }}>{registering ? 'Back to sign in' : 'Create a field reporter account'}</button>
    </div>
    <aside className="login-visual">
      <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
      <div className="visual-copy"><span>DECISION SUPPORT · NOT A FLOOD FORECAST</span><h2>See the city.<br />Understand the risk.<br /><em>Coordinate a response.</em></h2>
        <div className="visual-caption"><MapPin size={16} />Pune, Maharashtra <span>·</span> Illustrative demonstration environment</div>
      </div>
      <div className="visual-rain"><span /><span /><span /><span /><span /><span /><span /><span /></div>
    </aside>
  </main>;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('mm-token') ?? '');
  const [user, setUser] = useState<User | null>(() => {
    const value = localStorage.getItem('mm-user');
    return value ? JSON.parse(value) as User : null;
  });
  const [page, setPage] = useState<Page>('Overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [simulation, setSimulation] = useState<{ score: number; category: string; label: string } | null>(null);
  const [factors, setFactors] = useState({ rainfall: 70, history: 55, slope: 35, drainage: 60, incidents: 50 });
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', token], queryFn: () => request<Dashboard>('/dashboard', token),
    enabled: Boolean(token), retry: false, refetchInterval: 30_000,
  });
  const incidentsQuery = useQuery({
    queryKey: ['incidents', token], queryFn: () => request<{ items: Incident[] }>('/incidents', token),
    enabled: Boolean(token), retry: false,
  });
  const dashboard = dashboardQuery.data;
  const incidentCount = dashboard?.summary.total ?? 0;
  const riskCount = dashboard?.riskDistribution.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const navigation: { name: Page; icon: typeof Activity; section: string }[] = useMemo(() => [
    { name: 'Overview', icon: Gauge, section: 'COMMAND' }, { name: 'Live map', icon: MapIcon, section: 'COMMAND' },
    { name: 'Incidents', icon: Siren, section: 'RESPONSE' }, { name: 'Risk analysis', icon: BarChart3, section: 'INTELLIGENCE' },
    { name: 'Simulation', icon: CloudRain, section: 'INTELLIGENCE' }, { name: 'Analytics', icon: Activity, section: 'INTELLIGENCE' },
  ], []);
  function signIn(nextToken: string, nextUser: User) {
    localStorage.setItem('mm-token', nextToken); localStorage.setItem('mm-user', JSON.stringify(nextUser));
    setToken(nextToken); setUser(nextUser);
  }
  function signOut() {
    localStorage.removeItem('mm-token'); localStorage.removeItem('mm-user');
    setToken(''); setUser(null);
  }
  async function createIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await request<{ incident: { id: string } }>('/incidents', token, { method: 'POST', body: JSON.stringify({
        title: form.get('title'), description: form.get('description'), category: form.get('category'),
        severity: form.get('severity'), latitude: Number(form.get('latitude')), longitude: Number(form.get('longitude')),
      }) });
      setShowIncidentForm(false); setNotice(`Incident ${result.incident.id.slice(0, 8)} submitted for operator review.`);
      await Promise.all([dashboardQuery.refetch(), incidentsQuery.refetch()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to submit incident.'); }
  }
  async function runSimulation(event: FormEvent) {
    event.preventDefault();
    try {
      setSimulation(await request('/risk/simulate', token, { method: 'POST', body: JSON.stringify(factors) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Simulation failed'); }
  }
  async function updateStatus(id: string, status: string) {
    try {
      await request(`/incidents/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(`Incident updated to ${status.toLowerCase().replace('_', ' ')}.`);
      await Promise.all([dashboardQuery.refetch(), incidentsQuery.refetch()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to update incident'); }
  }

  if (!token || !user) return <Login onLogin={signIn} />;
  const incidents = incidentsQuery.data?.items ?? [];
  const unresolved = dashboard?.summary.unresolved ?? 0;
  const riskTitle = dashboard?.riskDistribution.find((x) => x.category === 'CRITICAL')?.count ?? 0;
  const cards = [
    { label: 'Total incidents', value: dashboard?.summary.total, icon: Siren, tone: 'blue', note: 'All reported events', trend: 'Current' },
    { label: 'Verified reports', value: dashboard?.summary.verified, icon: ShieldCheck, tone: 'teal', note: 'Operator reviewed', trend: 'Tracked' },
    { label: 'Awaiting action', value: unresolved, icon: AlertTriangle, tone: 'amber', note: 'Requires follow-up', trend: 'Open' },
    { label: 'Critical zones', value: riskTitle, icon: MapPin, tone: 'red', note: 'Latest illustrative model', trend: 'Demo' },
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><div className="brand-mark"><Droplets size={20} /></div><div><strong>monsoon<span>mesh</span></strong><small>URBAN FLOOD INTELLIGENCE</small></div><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-switch"><span className="workspace-pin">P</span><span><b>Pune Operations</b><small>DEMO ENVIRONMENT</small></span><ChevronDown size={15} /></div>
      <div className="nav-groups">{['COMMAND', 'RESPONSE', 'INTELLIGENCE'].map((section) => <div className="nav-group" key={section}><span className="nav-heading">{section}</span>
        {navigation.filter((item) => item.section === section).map((item) => <button key={item.name} className={`nav-link ${page === item.name ? 'active' : ''}`} onClick={() => { setPage(item.name); setMenuOpen(false); }}>
          <item.icon size={17} strokeWidth={1.8} /><span>{item.name}</span>{item.name === 'Incidents' && unresolved > 0 && <b className="nav-count">{unresolved}</b>}
        </button>)}</div>)}</div>
      <div className="sidebar-bottom"><div className="source-status"><span className="status-dot" /><div><b>Local fixture mode</b><small>External feeds not connected</small></div></div>
        <div className="user-row"><div className="avatar">{user.displayName.slice(0, 1)}</div><div className="user-info"><b>{user.displayName}</b><small>{user.role.replace('_', ' ')}</small></div><button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={16} /></button></div>
      </div>
    </aside>
    {menuOpen && <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <main className="main-content">
      <header className="topbar"><div className="crumb"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={19} /></button><span>Workspace</span><span className="crumb-slash">/</span><b>{page}</b></div>
        <div className="topbar-right"><div className="environment-tag"><i /> DEMONSTRATION</div><button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button><span className="topbar-date">Pune · <span>Monsoon readiness</span></span></div>
      </header>
      <div className="page-wrap">
        {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
        {dashboardQuery.isError && <div className="error-banner"><AlertTriangle size={16} />API unavailable: {dashboardQuery.error.message}. Start the local Docker services, then sign in again.</div>}
        {page === 'Overview' && <>
          <section className="page-heading"><div><div className="eyebrow">SUNDAY, 01 NOVEMBER 2026 <span className="heading-dot" /> SYNTHETIC DEMONSTRATION</div><h1>Good evening, {user.displayName.split(' ')[0]} <span className="wave">✦</span></h1><p>Here’s the latest demonstration view of flood conditions across Pune.</p></div>
            <button className="primary-button" onClick={() => setShowIncidentForm(true)}><FilePlus2 size={16} /> Report an incident</button></section>
          <div className="data-notice"><span><Activity size={15} /> DEMONSTRATION DATA</span><p>Values below are synthetic fixtures for product demonstration—not live observations or validated flood probabilities.</p><button title="Learn about demo data"><X size={14} /></button></div>
          <section className="stat-grid">{cards.map((card, index) => <article className="stat-card" key={card.label}><div className="stat-top"><span className={`stat-icon ${card.tone}`}><card.icon size={18} /></span><span className={`stat-trend ${index === 2 ? 'trend-amber' : ''}`}>{index === 2 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{card.trend}</span></div>
            <span className="stat-label">{card.label}</span><strong className="stat-value">{dashboardQuery.isLoading ? '—' : card.value ?? '—'}</strong><span className="stat-note">{card.note}</span><div className={`stat-accent ${card.tone}`} /></article>)}</section>
          <section className="dashboard-grid"><div className="panel map-panel"><div className="panel-heading"><div><span className="eyebrow">GEOSPATIAL OVERVIEW</span><h2>Risk across the city</h2></div><button className="subtle-button" onClick={() => setPage('Live map')}>Open full map <span>↗</span></button></div>
              <Suspense fallback={<div className="map-frame loading-state">Loading map…</div>}><RiskMap token={token} /></Suspense><div className="map-summary"><span><i className="summary-dot red-dot" />{riskCount} assessed zones</span><span><i className="summary-dot blue-dot" />Fixtures · updated locally</span><button onClick={() => setPage('Live map')}>View map <span>→</span></button></div></div>
            <div className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">FIELD ACTIVITY</span><h2>Recent incidents</h2></div><button className="text-button" onClick={() => setPage('Incidents')}>View all <span>→</span></button></div>
              {dashboardQuery.isLoading ? <div className="loading-state">Loading incident data…</div> : (dashboard?.recent.length ?? 0) === 0 ? <div className="empty-state"><Siren size={24} /><b>No incidents to display</b><span>Reports will appear here as they are submitted.</span></div> : <div className="incident-list">{dashboard?.recent.slice(0, 5).map((incident) => <article className="incident-item" key={incident.id}><div className={`incident-marker marker-${incident.severity.toLowerCase()}`}><MapPin size={15} /></div><div className="incident-copy"><b>{incident.title}</b><span>{incident.category.replace('_', ' ')} <i /> {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><span className={`severity-pill ${incident.severity.toLowerCase()}`}>{incident.severity}</span></article>)}</div>}
              <button className="activity-footer" onClick={() => setPage('Incidents')}>Go to incident management <span>→</span></button></div></section>
          <section className="bottom-grid"><div className="panel risk-panel"><div className="panel-heading"><div><span className="eyebrow">MODEL OUTPUT</span><h2>Risk distribution</h2></div><span className="model-badge"><Gauge size={13} /> ILLUSTRATIVE V1</span></div>
            <div className="risk-bars">{['CRITICAL','HIGH','MODERATE','LOW'].map((category) => { const count = dashboard?.riskDistribution.find((x) => x.category === category)?.count ?? 0; const max = Math.max(...(dashboard?.riskDistribution.map((x) => x.count) ?? [1]), 1); return <div className="risk-row" key={category}><span>{category}</span><div className="risk-track"><i className={`risk-fill fill-${category.toLowerCase()}`} style={{ width: `${Math.max(3, count / max * 100)}%` }} /></div><b>{count}</b></div>; })}</div>
            <p className="panel-footnote">Risk index is a configurable decision-support score, not a validated flood probability.</p></div>
            <div className="panel sources-panel"><div className="panel-heading"><div><span className="eyebrow">DATA FRESHNESS</span><h2>Source status</h2></div><button className="icon-button" title="Source information"><Search size={16} /></button></div>
              <div className="source-row"><span className="source-icon"><CloudRain size={16} /></span><div><b>Weather fixtures</b><small>Synthetic observations</small></div><span className="source-state"><i /> DEMO</span></div>
              <div className="source-row"><span className="source-icon"><MapIcon size={16} /></span><div><b>Zone boundaries</b><small>Pune local fixtures</small></div><span className="source-state"><i /> DEMO</span></div>
              <div className="source-row"><span className="source-icon"><MessageSquareText size={16} /></span><div><b>AI assistant</b><small>Local fallback available</small></div><span className="source-state source-local"><i /> LOCAL</span></div></div></section>
        </>}
        {page === 'Live map' && <section className="page-heading standalone"><div><div className="eyebrow">GEOSPATIAL INTELLIGENCE</div><h1>City risk map</h1><p>Stored zone boundaries and latest illustrative risk assessments.</p></div><div className="map-filter"><Search size={15} /><input placeholder="Search zone or area" /><button><ChevronDown size={14} /> All zones</button></div></section>}
        {page === 'Live map' && <div className="panel full-map-panel"><Suspense fallback={<div className="map-frame loading-state">Loading map…</div>}><RiskMap token={token} /></Suspense><div className="full-map-footer"><span><i className="status-dot" /> {riskCount} synthetic zone assessments</span><span>Coordinates and zones are illustrative demonstration fixtures.</span></div></div>}
        {page === 'Incidents' && <><section className="page-heading standalone"><div><div className="eyebrow">RESPONSE COORDINATION</div><h1>Incident management</h1><p>Review reports, track status, and coordinate operator response.</p></div><button className="primary-button" onClick={() => setShowIncidentForm(true)}><FilePlus2 size={16} /> New report</button></section>
          <div className="panel table-panel"><div className="table-toolbar"><div><b>{incidents.length} reports</b><span> · all statuses</span></div><button className="subtle-button"><Search size={15} /> Search reports</button></div>
            <div className="table-scroll"><table><thead><tr><th>INCIDENT</th><th>CATEGORY</th><th>SEVERITY</th><th>STATUS</th><th>REPORTED</th><th>ACTION</th></tr></thead><tbody>
              {incidentsQuery.isLoading ? <tr><td colSpan={6} className="table-empty">Loading reports…</td></tr> : incidents.length === 0 ? <tr><td colSpan={6} className="table-empty">No reports found. Submit a report to get started.</td></tr> : incidents.map((incident) => <tr key={incident.id}><td><b>{incident.title}</b><small>{incident.id.slice(0, 8)}{incident.is_synthetic && <span className="demo-chip">DEMO</span>}</small></td>
                <td>{incident.category.replace('_', ' ')}</td><td><span className={`severity-pill ${incident.severity.toLowerCase()}`}>{incident.severity}</span></td><td><span className="status-text"><i className={`status-${incident.status.toLowerCase()}`} />{incident.status.replaceAll('_', ' ')}</span></td>
                <td>{new Date(incident.created_at).toLocaleString()}</td><td>{['ADMIN','OPERATOR'].includes(user.role) && incident.status === 'PENDING_VERIFICATION' ? <button className="action-button" onClick={() => void updateStatus(incident.id, 'VERIFIED')}>Verify <Check size={13} /></button> : <span className="muted">—</span>}</td></tr>)}
            </tbody></table></div></div></>}
        {page === 'Simulation' && <><section className="page-heading standalone"><div><div className="eyebrow">SCENARIO PLANNING</div><h1>What-if simulation</h1><p>Explore how assumed conditions affect the illustrative risk index.</p></div><span className="model-badge"><CloudRain size={14} /> SIMULATED ONLY</span></section>
          <section className="simulation-layout"><form className="panel simulation-form" onSubmit={(e) => void runSimulation(e)}><div className="panel-heading"><div><span className="eyebrow">SCENARIO INPUTS</span><h2>Adjust risk factors</h2></div></div>
            {(Object.keys(factors) as (keyof typeof factors)[]).map((key) => <label className="slider-field" key={key}><span><b>{key.charAt(0).toUpperCase() + key.slice(1)}</b><output>{factors[key]}</output></span><input type="range" min="0" max="100" value={factors[key]} onChange={(e) => setFactors({ ...factors, [key]: Number(e.target.value) })} /></label>)}
            <button className="primary-button full-width"><Gauge size={16} /> Calculate scenario risk</button><p className="panel-footnote">Simulation does not alter weather observations or verified incident records.</p></form>
            <div className="panel simulation-result"><span className="eyebrow">SCENARIO OUTPUT</span>{simulation ? <><div className="result-score">{simulation.score}<small>/100</small></div><span className={`severity-pill ${simulation.category.toLowerCase()}`}>{simulation.category} RISK</span><p>{simulation.label}</p><div className="scenario-baseline"><span>Active model</span><b>illustrative-v1 · deterministic</b></div></> : <div className="simulation-empty"><CloudRain size={27} /><b>Ready to model a scenario</b><span>Change the inputs and calculate to compare factors.</span></div>}</div></section></>}
        {['Risk analysis','Analytics'].includes(page) && <section className="standalone placeholder-panel panel"><span className="stat-icon teal"><BarChart3 size={20} /></span><h2>{page} workspace</h2><p>Aggregates are sourced from the API; this area will expand as historical observations and verified reports are collected.</p><div className="data-notice"><span><Activity size={15} /> AVAILABLE NOW</span><p>{incidentCount} stored reports · {riskCount} latest zone assessments · {dashboard?.dataLabel ?? 'Awaiting API data'}</p></div><button className="subtle-button" onClick={() => setPage('Overview')}>Back to overview <span>→</span></button></section>}
        <footer className="page-footer"><span>MONSOONMESH <i /> FLOOD INTELLIGENCE PLATFORM</span><span>Decision support only · Verify all field conditions before action</span></footer>
      </div>
    </main>
    {showIncidentForm && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowIncidentForm(false); }}><form className="incident-modal" onSubmit={(e) => void createIncident(e)}>
      <div className="modal-heading"><div><span className="eyebrow">FIELD REPORT</span><h2>Submit incident</h2></div><button type="button" className="icon-button" onClick={() => setShowIncidentForm(false)} aria-label="Close form"><X size={19} /></button></div>
      <label>Incident title<input name="title" minLength={4} maxLength={160} placeholder="e.g. Waterlogging near junction" required /></label>
      <label>Description<textarea name="description" minLength={8} maxLength={5000} rows={3} placeholder="Describe what you observed. Avoid assumptions about cause." required /></label>
      <div className="form-columns"><label>Category<select name="category"><option>WATERLOGGING</option><option>FLOODING</option><option>DRAINAGE</option><option>ROAD_BLOCKAGE</option><option>OTHER</option></select></label><label>Proposed severity<select name="severity"><option>MODERATE</option><option>LOW</option><option>HIGH</option><option>CRITICAL</option></select></label></div>
      <div className="form-columns"><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" defaultValue="18.5204" required /></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" defaultValue="73.8567" required /></label></div>
      <div className="modal-note"><AlertTriangle size={15} />Report locations are stored for operator review. Photo upload is available through the incident evidence API.</div>
      <div className="modal-actions"><button type="button" className="subtle-button" onClick={() => setShowIncidentForm(false)}>Cancel</button><button className="primary-button"><FilePlus2 size={15} /> Submit report</button></div>
    </form></div>}
  </div>;
}

export default App;
