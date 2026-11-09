import { lazy, Suspense, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, Activity, FilePlus2, Gauge, MapPin,
  Siren, ShieldCheck, CloudRain, Map as MapIcon, Check, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getDashboard, getIncidents, createIncident, getWeatherData, getRiskAssessments } from '../api.ts';
import type { Incident, Severity } from '../types.ts';
import { StatCard } from '../components/ui/StatCard.tsx';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { SeverityBadge } from '../components/ui/Badge.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { DataNotice } from '../components/ui/Alert.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import type { Page } from '../components/layout/AppShell.tsx';

const RiskMap = lazy(() => import('../components/map/RiskMap.tsx'));

const RISK_COLORS: Record<string, string> = {
  CRITICAL: 'var(--red)',
  HIGH: 'var(--amber)',
  MODERATE: 'var(--teal)',
  LOW: 'var(--green)',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type OverviewPageProps = {
  token: string;
  userName: string;
  userRole: string;
  onNavigate: (p: Page) => void;
  notice: string;
  onNotice: (msg: string) => void;
  showIncidentForm: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
};

export function OverviewPage({
  token, userName, userRole, onNavigate,
  notice, onNotice, showIncidentForm, onOpenForm, onCloseForm,
}: OverviewPageProps) {
  const dashQ = useQuery({
    queryKey: ['dashboard', token],
    queryFn: () => getDashboard(token),
    enabled: Boolean(token),
    refetchInterval: 30_000,
    retry: false,
  });
  const incQ = useQuery({
    queryKey: ['incidents', token],
    queryFn: () => getIncidents(token, { limit: 6 }),
    enabled: Boolean(token),
    retry: false,
  });
  const weatherQ = useQuery({
    queryKey: ['weather', token],
    queryFn: () => getWeatherData(token),
    enabled: Boolean(token),
    refetchInterval: 60_000,
    retry: false,
  });
  const riskQ = useQuery({
    queryKey: ['riskAssessments', token],
    queryFn: () => getRiskAssessments(token),
    enabled: Boolean(token),
    refetchInterval: 60_000,
    retry: false,
  });

  const d = dashQ.data;
  const loading = dashQ.isLoading;
  const weather = weatherQ.data?.items ?? [];
  const risks = riskQ.data?.items ?? [];

  const criticalCount = (risks.filter(r => r.category === 'CRITICAL').length) || (d?.riskDistribution.find((x) => x.category === 'CRITICAL')?.count ?? 0);
  const chartData = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((cat) => ({
    name: cat.charAt(0) + cat.slice(1).toLowerCase(),
    count: (risks.filter(r => r.category === cat).length) || (d?.riskDistribution.find((x) => x.category === cat)?.count ?? 0),
    fill: RISK_COLORS[cat],
  }));

  async function handleCreateIncident(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const result = await createIncident(token, {
        title: fd.get('title') as string,
        description: fd.get('description') as string,
        category: fd.get('category') as string,
        severity: fd.get('severity') as string,
        latitude: Number(fd.get('latitude')),
        longitude: Number(fd.get('longitude')),
      });
      onCloseForm();
      onNotice(`Incident ${result.incident.id.slice(0, 8)} submitted for review.`);
      void dashQ.refetch();
      void incQ.refetch();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Unable to submit incident.');
    }
  }

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? 'Good morning' : greetHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page-content">
      {/* Header */}
      <PageHeader
        eyebrow="SUNDAY, 01 NOVEMBER 2026 · SYNTHETIC DEMONSTRATION"
        title={`${greeting}, ${userName}`}
        description="Here's the latest demonstration view of flood conditions across Pune."
        action={
          <button className="btn btn-primary btn-md" onClick={onOpenForm}>
            <FilePlus2 size={15} />
            <span>Report incident</span>
          </button>
        }
      />

      {/* Data notice */}
      <DataNotice />

      {/* Error banner */}
      {dashQ.isError && (
        <div className="alert alert-network" role="alert">
          <AlertTriangle size={15} />
          <div className="alert-body">
            <strong className="alert-title">API unavailable</strong>
            <span className="alert-msg">
              {dashQ.error instanceof Error ? dashQ.error.message : 'Unable to load dashboard.'}
              {' '}Start the local Docker services to load live data.
            </span>
          </div>
        </div>
      )}

      {/* Toast */}
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{notice}</span>
          <button className="toast-dismiss" onClick={() => onNotice('')} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard
          label="Total incidents"
          value={d?.summary.total ?? '—'}
          icon={<Siren size={17} />}
          tone="blue"
          note="All reported events"
          trend="neutral"
          trendLabel="All time"
          loading={loading}
        />
        <StatCard
          label="Verified reports"
          value={d?.summary.verified ?? '—'}
          icon={<ShieldCheck size={17} />}
          tone="teal"
          note="Operator reviewed"
          trend="neutral"
          trendLabel="Tracked"
          loading={loading}
        />
        <StatCard
          label="Weather observations"
          value={weather.length}
          icon={<CloudRain size={17} />}
          tone="teal"
          note="Real external data feeds"
          trend={weather.length > 0 ? 'up' : 'neutral'}
          trendLabel="Live"
          loading={weatherQ.isLoading}
        />
        <StatCard
          label="Critical zones"
          value={criticalCount}
          icon={<MapPin size={17} />}
          tone="red"
          note="Latest risk assessment"
          trend={criticalCount > 0 ? 'up' : 'neutral'}
          trendLabel="Active"
          loading={riskQ.isLoading}
        />
      </div>

      {/* Main grid: map + activity */}
      <div className="dashboard-grid">
        {/* Map panel */}
        <Card padding="none">
          <div className="card-pad-md">
            <CardHeader
              eyebrow="GEOSPATIAL OVERVIEW"
              title="Risk across the city"
              action={
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('Live map')}>
                  Full map ↗
                </button>
              }
            />
          </div>
          <Suspense fallback={<div className="map-placeholder">Loading map…</div>}>
            <RiskMap token={token} height="300px" />
          </Suspense>
          <div className="card-pad-sm map-card-footer">
            <span className="map-stat"><span className="dot dot-red" />{risks.length} assessed zones</span>
            <span className="map-stat"><span className="dot dot-blue" />{weather.length} weather observations</span>
            <button className="link-btn" onClick={() => onNavigate('Live map')}>View full map →</button>
          </div>
        </Card>

        {/* Recent incidents */}
        <Card padding="none">
          <div className="card-pad-md">
            <CardHeader
              eyebrow="FIELD ACTIVITY"
              title="Recent incidents"
              action={
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('Incidents')}>
                  View all →
                </button>
              }
            />
          </div>
          <div className="activity-list">
            {loading && (
              Array.from({ length: 4 }, (_, i) => (
                <div className="activity-item" key={i}>
                  <span className="skeleton" style={{ width: '2rem', height: '2rem', borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <span className="skeleton" style={{ width: '70%', height: '0.8rem', display: 'block' }} />
                    <span className="skeleton" style={{ width: '40%', height: '0.7rem', display: 'block', marginTop: 6 }} />
                  </div>
                </div>
              ))
            )}
            {!loading && (d?.recent.length ?? 0) === 0 && (
              <div className="card-pad-md">
                <EmptyState
                  icon={<Siren size={24} />}
                  title="No incidents yet"
                  description="Reports will appear here once submitted."
                />
              </div>
            )}
            {!loading && d?.recent.slice(0, 5).map((inc) => (
              <IncidentRow key={inc.id} incident={inc} />
            ))}
          </div>
          <div className="card-pad-sm activity-footer-btn">
            <button className="link-btn-full" onClick={() => onNavigate('Incidents')}>
              Go to incident management →
            </button>
          </div>
        </Card>
      </div>

      {/* Bottom grid: risk chart + source status */}
      <div className="bottom-grid">
        {/* Risk distribution chart */}
        <Card padding="md">
          <CardHeader
            eyebrow="MODEL OUTPUT"
            title="Risk distribution"
            action={<span className="model-badge"><Gauge size={12} /> ILLUSTRATIVE V1</span>}
          />
          {loading ? (
            <div className="chart-placeholder">
              <span className="skeleton" style={{ width: '100%', height: '140px' }} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                  itemStyle={{ color: 'var(--text)' }}
                  cursor={{ fill: 'var(--border)' }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="panel-footnote">Risk index is a configurable decision-support score, not a validated flood probability.</p>
        </Card>

        {/* Source status */}
        <Card padding="md">
          <CardHeader eyebrow="DATA FRESHNESS" title="Source status" />
          <div className="source-list">
            <SourceRow icon={<CloudRain size={15} />} label="Weather feeds" sub={`${weather.length} observations ingested`} state={weather.length > 0 ? 'active' : 'demo'} />
            <SourceRow icon={<MapIcon size={15} />} label="Risk assessments" sub={`${risks.length} zones assessed`} state={risks.length > 0 ? 'active' : 'demo'} />
            <SourceRow icon={<Activity size={15} />} label="AI assistant" sub="Local fallback available" state="local" />
            <SourceRow icon={<Siren size={15} />} label="Incident stream" sub={`${d?.summary.total ?? '—'} records loaded`} state="active" />
          </div>
        </Card>
      </div>

      {/* Report incident modal */}
      <Modal
        open={showIncidentForm}
        onClose={onCloseForm}
        title="Submit incident"
        eyebrow="FIELD REPORT"
        footer={
          <div className="modal-footer-btns">
            <button className="btn btn-ghost btn-md" type="button" onClick={onCloseForm}>Cancel</button>
            <button className="btn btn-primary btn-md" type="submit" form="incident-form">
              <FilePlus2 size={14} /> <span>Submit report</span>
            </button>
          </div>
        }
      >
        <form id="incident-form" onSubmit={(e) => void handleCreateIncident(e)}>
          <IncidentForm userRole={userRole} />
        </form>
      </Modal>
    </div>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  const sevColor: Record<Severity, string> = {
    CRITICAL: 'marker-critical',
    HIGH: 'marker-high',
    MODERATE: 'marker-moderate',
    LOW: 'marker-low',
  };
  return (
    <div className="activity-item">
      <div className={`activity-marker ${sevColor[incident.severity]}`}>
        <MapPin size={13} />
      </div>
      <div className="activity-copy">
        <strong>{incident.title}</strong>
        <span>
          {incident.category.replace('_', ' ')}
          <i className="dot-sep" />
          {fmtDate(incident.created_at)} {fmtTime(incident.created_at)}
        </span>
      </div>
      <SeverityBadge severity={incident.severity} />
    </div>
  );
}

function SourceRow({ icon, label, sub, state }: { icon: React.ReactNode; label: string; sub: string; state: 'demo' | 'local' | 'active' }) {
  return (
    <div className="source-row">
      <span className="source-icon">{icon}</span>
      <div className="source-meta">
        <b>{label}</b>
        <small>{sub}</small>
      </div>
      <span className={`source-state source-${state}`}>
        <span className="source-dot" />
        {state.toUpperCase()}
      </span>
    </div>
  );
}

function IncidentForm({ userRole: _userRole }: { userRole: string }) {
  return (
    <>
      <div className="field">
        <label className="field-label" htmlFor="inc-title">Incident title</label>
        <input id="inc-title" name="title" className="field-input" placeholder="e.g. Waterlogging near Swargate junction" minLength={4} maxLength={160} required />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="inc-desc">Description</label>
        <textarea id="inc-desc" name="description" className="field-input field-textarea" placeholder="Describe what you observed. Avoid assumptions about cause." minLength={8} maxLength={5000} rows={3} required />
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="inc-cat">Category</label>
          <select id="inc-cat" name="category" className="field-input">
            <option>WATERLOGGING</option>
            <option>FLOODING</option>
            <option>DRAINAGE</option>
            <option>ROAD_BLOCKAGE</option>
            <option>OTHER</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="inc-sev">Severity</label>
          <select id="inc-sev" name="severity" className="field-input">
            <option>MODERATE</option>
            <option>LOW</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="inc-lat">Latitude</label>
          <input id="inc-lat" name="latitude" type="number" step="any" min="-90" max="90" className="field-input" defaultValue="18.5204" required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="inc-lon">Longitude</label>
          <input id="inc-lon" name="longitude" type="number" step="any" min="-180" max="180" className="field-input" defaultValue="73.8567" required />
        </div>
      </div>
      <div className="form-note">
        <AlertTriangle size={13} />
        Report locations are stored for operator review. Photo upload is available through the incident evidence API.
      </div>
    </>
  );
}
