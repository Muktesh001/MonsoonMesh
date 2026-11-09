import { useQuery } from '@tanstack/react-query';
import {
  Activity, Clock, CloudRain, Zap, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ComposedChart, Area,
} from 'recharts';
import {
  getAnalyticsMetrics, getAnalyticsTrends, getResponseStats, getUptimeStatus,
} from '../api.ts';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { DataNotice } from '../components/ui/Alert.tsx';
import { StatCard } from '../components/ui/StatCard.tsx';

type AnalyticsPageProps = {
  token: string;
};

function fmtDate(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
}

export function AnalyticsPage({ token }: AnalyticsPageProps) {
  const metricsQ = useQuery({
    queryKey: ['analyticsMetrics', token],
    queryFn: () => getAnalyticsMetrics(token),
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

  const responseStatsQ = useQuery({
    queryKey: ['responseStats', token],
    queryFn: () => getResponseStats(token),
    enabled: Boolean(token),
    refetchInterval: 60_000,
    retry: false,
  });

  const uptimeQ = useQuery({
    queryKey: ['uptimeStatus', token],
    queryFn: () => getUptimeStatus(token),
    enabled: Boolean(token),
    refetchInterval: 30_000,
    retry: false,
  });

  const m = metricsQ.data;
  const trends = trendsQ.data;
  const respStats = responseStatsQ.data;
  const uptime = uptimeQ.data;
  const loading = metricsQ.isLoading;

  // Combine incident and weather trends for correlation view
  const correlationData = (trends?.incidentTrends ?? []).map((it, idx) => {
    const wt = trends?.weatherTrends[idx];
    return {
      week: it.week,
      incidents: it.incidents,
      rainfall: wt?.rainfall ?? 0,
    };
  });

  // Response time stats by status
  const responseTimeData = respStats?.byStatus ?? [];

  return (
    <div className="page-content">
      {/* Header */}
      <PageHeader
        eyebrow="INTELLIGENCE"
        title="Analytics"
        description="System-wide metrics, incident trends, response times, and platform health."
      />

      <DataNotice />

      {/* Error banner */}
      {metricsQ.isError && (
        <div className="alert alert-network" role="alert">
          <AlertTriangle size={15} />
          <div className="alert-body">
            <strong className="alert-title">Data unavailable</strong>
            <span className="alert-msg">
              {metricsQ.error instanceof Error ? metricsQ.error.message : 'Unable to load analytics.'}
            </span>
          </div>
        </div>
      )}

      {/* Key metrics stat cards */}
      <div className="stat-grid">
        <StatCard
          label="Total incidents"
          value={m?.totalIncidents ?? '—'}
          icon={<Activity size={17} />}
          tone="blue"
          note="All reported events"
          trend="neutral"
          trendLabel="All time"
          loading={loading}
        />
        <StatCard
          label="Weather events"
          value={m?.weatherEvents ?? '—'}
          icon={<CloudRain size={17} />}
          tone="teal"
          note="External data feeds"
          trend={m && m.weatherEvents > 0 ? 'up' : 'neutral'}
          trendLabel="Live"
          loading={loading}
        />
        <StatCard
          label="Risk assessments"
          value={m?.riskAssessments ?? '—'}
          icon={<Zap size={17} />}
          tone="amber"
          note="Zones evaluated"
          trend="neutral"
          trendLabel="Latest"
          loading={loading}
        />
        <StatCard
          label="Avg resolution time"
          value={m?.avgResolutionTime ? `${m.avgResolutionTime}h` : '—'}
          icon={<Clock size={17} />}
          tone="teal"
          note="Closed incidents"
          trend="neutral"
          trendLabel="Average"
          loading={loading}
        />
      </div>

      {/* Main grid: incident trends + response times */}
      <div className="dashboard-grid">
        {/* Incident trends by week */}
        <Card padding="md">
          <CardHeader
            eyebrow="INCIDENT VOLUME"
            title="Incidents by week (8-week trend)"
          />
          {loading ? (
            <div className="chart-placeholder">
              <span className="skeleton" style={{ width: '100%', height: '180px' }} />
            </div>
          ) : (trends?.incidentTrends ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trends?.incidentTrends ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: 'var(--muted)', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Bar dataKey="incidents" fill="var(--cyan)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              No incident data available.
            </div>
          )}
          <p className="panel-footnote">Incident count aggregated by week. Reflects all reported incidents.</p>
        </Card>

        {/* Response time statistics */}
        <Card padding="md">
          <CardHeader eyebrow="RESOLUTION METRICS" title="Response time by status" />
          {loading ? (
            <div className="chart-placeholder">
              <span className="skeleton" style={{ width: '100%', height: '180px' }} />
            </div>
          ) : responseTimeData.length > 0 ? (
            <div className="response-stats-list">
              {responseTimeData.map(stat => (
                <div key={stat.status} className="response-stat-row">
                  <div className="stat-label">
                    <span style={{ fontWeight: 600 }}>{stat.status}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{stat.count} incidents</span>
                  </div>
                  <div className="stat-times">
                    <span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>Avg</span>
                      <span style={{ fontWeight: 600 }}>{stat.avgResolutionHours}h</span>
                    </span>
                    <span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>Median</span>
                      <span style={{ fontWeight: 600 }}>{stat.medianResolutionHours}h</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              No resolution data available.
            </div>
          )}
          <p className="panel-footnote">Time to resolve incidents by completion status.</p>
        </Card>
      </div>

      {/* Weather-incident correlation */}
      <Card padding="md">
        <CardHeader
          eyebrow="CORRELATION ANALYSIS"
          title="Rainfall vs. incident frequency"
        />
        {loading ? (
          <div className="chart-placeholder">
            <span className="skeleton" style={{ width: '100%', height: '180px' }} />
          </div>
        ) : correlationData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={correlationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--muted)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--muted)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'Incidents', angle: -90, position: 'insideLeft', style: { fill: 'var(--muted)' } }}
              />
              <YAxis
                yAxisId="right"
                tick={{ fill: 'var(--muted)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'Rainfall (mm)', angle: 90, position: 'insideRight', style: { fill: 'var(--muted)' } }}
              />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                itemStyle={{ color: 'var(--text)' }}
              />
              <Bar dataKey="incidents" fill="var(--cyan)" yAxisId="left" radius={[3, 3, 0, 0]} />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="rainfall"
                fill="var(--teal)"
                stroke="var(--teal)"
                opacity={0.3}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
            No correlation data available.
          </div>
        )}
        <p className="panel-footnote">Correlation between external weather data and reported incidents. Higher rainfall typically correlates with more reports.</p>
      </Card>

      {/* System uptime and API health */}
      <div className="dashboard-grid">
        <Card padding="md">
          <CardHeader eyebrow="SYSTEM HEALTH" title="Platform status" />
          {uptimeQ.isLoading ? (
            <div style={{ padding: '2rem' }}>
              <span className="skeleton" style={{ width: '100%', height: '2rem', display: 'block', marginBottom: '1rem' }} />
              <span className="skeleton" style={{ width: '80%', height: '1rem', display: 'block' }} />
            </div>
          ) : (
            <div className="health-status">
              <div className="health-item">
                <span className="health-indicator" style={{ backgroundColor: uptime?.databaseConnected ? 'var(--green)' : 'var(--red)' }} />
                <div className="health-details">
                  <b>Database</b>
                  <small>{uptime?.databaseConnected ? 'Connected' : 'Disconnected'}</small>
                </div>
              </div>
              <div className="health-item">
                <span className="health-indicator" style={{ backgroundColor: 'var(--green)' }} />
                <div className="health-details">
                  <b>API Response</b>
                  <small>{uptime?.apiResponseTime ?? '< 100ms'}</small>
                </div>
              </div>
              <div className="health-item">
                <span className="health-indicator" style={{ backgroundColor: 'var(--green)' }} />
                <div className="health-details">
                  <b>Status</b>
                  <small>{uptime?.status ?? 'Operational'}</small>
                </div>
              </div>
            </div>
          )}
          {uptime?.timestamp && (
            <p className="panel-footnote">Last checked: {fmtDate(uptime.timestamp)}</p>
          )}
        </Card>

        {/* Key insights */}
        <Card padding="md">
          <CardHeader eyebrow="INSIGHTS" title="Key observations" />
          <div className="insights-list">
            {m && (
              <>
                {m.totalIncidents === 0 ? (
                  <div className="insight-item">
                    <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                    <span>No incidents reported in the current period.</span>
                  </div>
                ) : (
                  <div className="insight-item">
                    <Activity size={16} style={{ color: 'var(--cyan)' }} />
                    <span>
                      {m.totalIncidents} incidents recorded
                      {m.avgResolutionTime > 0 ? ` with average resolution time of ${m.avgResolutionTime}h` : ''}
                      .
                    </span>
                  </div>
                )}
                {m.weatherEvents > 0 && (
                  <div className="insight-item">
                    <CloudRain size={16} style={{ color: 'var(--teal)' }} />
                    <span>{m.weatherEvents} weather observations ingested from external feeds.</span>
                  </div>
                )}
                {m.riskAssessments > 0 && (
                  <div className="insight-item">
                    <Zap size={16} style={{ color: 'var(--amber)' }} />
                    <span>{m.riskAssessments} risk assessments completed across zones.</span>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
