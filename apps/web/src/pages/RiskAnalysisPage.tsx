import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, TrendingUp, Gauge, MapPin, Activity, AlertCircle, Database,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';
import { getRiskDistribution, getAnalyticsTrends } from '../api.ts';
import type { RiskZoneData } from '../api.ts';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { DataNotice } from '../components/ui/Alert.tsx';
import { StatCard } from '../components/ui/StatCard.tsx';
import type { Page } from '../components/layout/AppShell.tsx';

type RiskAnalysisPageProps = {
  token: string;
  onNavigate: (p: Page) => void;
};

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f59e0b',
  MODERATE: '#14b8a6',
  LOW: '#10b981',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RiskAnalysisPage({ token, onNavigate }: RiskAnalysisPageProps) {
  const riskDistQ = useQuery({
    queryKey: ['riskDistribution', token],
    queryFn: () => getRiskDistribution(token),
    enabled: Boolean(token),
    refetchInterval: 60_000,
    retry: false,
  });

  const trendsQ = useQuery({
    queryKey: ['analyticsTrends', token],
    queryFn: () => getAnalyticsTrends(token),
    enabled: Boolean(token),
    refetchInterval: 60_000,
    retry: false,
  });

  const zones = riskDistQ.data?.zones ?? [];
  const trends = trendsQ.data?.incidentTrends ?? [];
  const loading = riskDistQ.isLoading;

  // Calculate risk distribution stats
  const riskCounts = {
    CRITICAL: zones.filter(z => z.category === 'CRITICAL').length,
    HIGH: zones.filter(z => z.category === 'HIGH').length,
    MODERATE: zones.filter(z => z.category === 'MODERATE').length,
    LOW: zones.filter(z => z.category === 'LOW').length,
  };

  const riskChartData = [
    { name: 'Critical', value: riskCounts.CRITICAL, fill: RISK_COLORS.CRITICAL },
    { name: 'High', value: riskCounts.HIGH, fill: RISK_COLORS.HIGH },
    { name: 'Moderate', value: riskCounts.MODERATE, fill: RISK_COLORS.MODERATE },
    { name: 'Low', value: riskCounts.LOW, fill: RISK_COLORS.LOW },
  ].filter((d: { value: number }) => d.value > 0);

  // Contributing factors breakdown - aggregate from all zones
  const factorAggregates: Record<string, number[]> = {
    rainfall: [],
    drainage: [],
    slope: [],
    history: [],
    incidents: [],
  };

  zones.forEach(zone => {
    Object.entries(zone.factors).forEach(([key, value]) => {
      if (key in factorAggregates) {
        factorAggregates[key as keyof typeof factorAggregates].push(Number(value));
      }
    });
  });

  const avgFactors = Object.entries(factorAggregates).map(([name, values]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    average: values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
  }));

  // Sort zones by risk score descending
  const sortedZones = [...zones].sort((a, b) => b.score - a.score);

  return (
    <div className="page-content">
      {/* Header */}
      <PageHeader
        eyebrow="INTELLIGENCE"
        title="Risk analysis"
        description="Zone risk assessments, contributing factors, and historical risk trends across the city."
      />

      <DataNotice />

      {/* Error banner */}
      {riskDistQ.isError && (
        <div className="alert alert-network" role="alert">
          <AlertTriangle size={15} />
          <div className="alert-body">
            <strong className="alert-title">Data unavailable</strong>
            <span className="alert-msg">
              {riskDistQ.error instanceof Error ? riskDistQ.error.message : 'Unable to load risk data.'}
            </span>
          </div>
        </div>
      )}

      {/* Risk distribution stat cards */}
      <div className="stat-grid">
        <StatCard
          label="Critical zones"
          value={riskCounts.CRITICAL}
          icon={<AlertTriangle size={17} />}
          tone="red"
          note="Immediate attention needed"
          trend={riskCounts.CRITICAL > 0 ? 'up' : 'neutral'}
          trendLabel="Active"
          loading={loading}
        />
        <StatCard
          label="High-risk zones"
          value={riskCounts.HIGH}
          icon={<AlertCircle size={17} />}
          tone="amber"
          note="Monitor closely"
          trend="neutral"
          trendLabel="Active"
          loading={loading}
        />
        <StatCard
          label="Total zones assessed"
          value={zones.length}
          icon={<MapPin size={17} />}
          tone="teal"
          note="Latest assessment"
          trend="neutral"
          trendLabel="Tracked"
          loading={loading}
        />
        <StatCard
          label="Avg risk score"
          value={zones.length > 0 ? Math.round(zones.reduce((sum, z) => sum + z.score, 0) / zones.length) : 0}
          icon={<Gauge size={17} />}
          tone="blue"
          note="Across all zones"
          trend="neutral"
          trendLabel="Latest"
          loading={loading}
        />
      </div>

      {/* Main grid: risk distribution + factors */}
      <div className="dashboard-grid">
        {/* Risk distribution by category */}
        <Card padding="md">
          <CardHeader eyebrow="DISTRIBUTION" title="Zones by risk level" />
          {loading ? (
            <div className="chart-placeholder">
              <span className="skeleton" style={{ width: '100%', height: '140px' }} />
            </div>
          ) : riskChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              No risk assessment data available yet.
            </div>
          )}
          <p className="panel-footnote">Risk distribution across assessed zones. Refresh to see latest data.</p>
        </Card>

        {/* Contributing factors breakdown */}
        <Card padding="md">
          <CardHeader eyebrow="INFLUENCERS" title="Risk factors (average)" />
          {loading ? (
            <div className="chart-placeholder">
              <span className="skeleton" style={{ width: '100%', height: '140px' }} />
            </div>
          ) : avgFactors.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={avgFactors} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                  itemStyle={{ color: 'var(--text)' }}
                  cursor={{ fill: 'var(--border)' }}
                />
                <Bar dataKey="average" fill="var(--teal)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              No factor data available.
            </div>
          )}
          <p className="panel-footnote">Average contribution of each factor across zones (0-100 scale).</p>
        </Card>
      </div>

      {/* Risk trends over time */}
      <Card padding="md">
        <CardHeader
          eyebrow="TIME SERIES"
          title="Risk trend over 8 weeks"
          action={<span className="model-badge"><TrendingUp size={12} /> LATEST DATA</span>}
        />
        {loading ? (
          <div className="chart-placeholder">
            <span className="skeleton" style={{ width: '100%', height: '180px' }} />
          </div>
        ) : trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--muted)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(date: string) => new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                itemStyle={{ color: 'var(--text)' }}
              />
              <Line
                type="monotone"
                dataKey="incidents"
                stroke="var(--amber)"
                strokeWidth={2}
                dot={false}
                name="Incidents"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
            No trend data available yet.
          </div>
        )}
        <p className="panel-footnote">Incident count by week over the last 8 weeks. Refresh for latest assessments.</p>
      </Card>

      {/* Zone-by-zone detailed risk scores */}
      <Card padding="none">
        <div className="card-pad-md">
          <CardHeader
            eyebrow="ZONE DETAILS"
            title={`Risk scores (${zones.length} zones)`}
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('Live map')}>
                View on map ↗
              </button>
            }
          />
        </div>

        {loading ? (
          <div className="zone-list">
            {Array.from({ length: 4 }, (_, i) => (
              <div className="zone-item" key={i}>
                <span className="skeleton" style={{ width: '6rem', height: '2rem', borderRadius: '4px' }} />
                <span className="skeleton" style={{ width: '100%', height: '1rem', marginLeft: '1rem' }} />
                <span className="skeleton" style={{ width: '4rem', height: '1.5rem', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        ) : sortedZones.length > 0 ? (
          <div className="zone-list">
            {sortedZones.map(zone => (
              <ZoneRow key={zone.name} zone={zone} />
            ))}
          </div>
        ) : (
          <div className="card-pad-md" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <Database size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
            <p>No risk assessments available yet.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function ZoneRow({ zone }: { zone: RiskZoneData }) {
  const riskColor = RISK_COLORS[zone.category] || RISK_COLORS.LOW;
  const riskBgColor = {
    CRITICAL: 'rgba(220, 38, 38, 0.1)',
    HIGH: 'rgba(245, 158, 11, 0.1)',
    MODERATE: 'rgba(20, 184, 166, 0.1)',
    LOW: 'rgba(16, 185, 129, 0.1)',
  }[zone.category] || 'rgba(16, 185, 129, 0.1)';

  const factors = Object.entries(zone.factors)
    .filter(([key]) => ['rainfall', 'drainage', 'slope', 'history', 'incidents'].includes(key))
    .map(([key, value]) => `${key}: ${Math.round(Number(value))}`)
    .join(' · ');

  return (
    <div className="zone-item">
      <div
        style={{
          padding: '0.5rem 0.75rem',
          borderRadius: '4px',
          backgroundColor: riskBgColor,
          borderLeft: `3px solid ${riskColor}`,
          minWidth: '4rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {zone.category}
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600, color: riskColor }}>
          {zone.score}
        </div>
      </div>

      <div style={{ flex: 1, marginLeft: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{zone.name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          {factors}
        </div>
        {zone.assessed_at && (
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            Assessed: {fmtDate(zone.assessed_at)} {fmtTime(zone.assessed_at)}
          </div>
        )}
      </div>

      <Activity size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
    </div>
  );
}
