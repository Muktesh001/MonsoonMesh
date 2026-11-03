import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Activity, Construction,
  TrendingUp, Database, Clock,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getDashboard } from '../api.ts';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { DataNotice } from '../components/ui/Alert.tsx';
import type { Page } from '../components/layout/AppShell.tsx';

type PlaceholderPageProps = {
  page: Page;
  token: string;
  onNavigate: (p: Page) => void;
};

// Generate synthetic trend data for visual interest
function mockTrend(seed: number, points = 14) {
  return Array.from({ length: points }, (_, i) => ({
    day: `Day ${i + 1}`,
    incidents: Math.max(0, Math.round(seed + Math.sin((i + seed) * 0.8) * 4 + i * 0.5)),
    risk: Math.max(0, Math.min(100, Math.round(50 + Math.sin((i + seed) * 0.6) * 20))),
  }));
}

export function PlaceholderPage({ page, token, onNavigate }: PlaceholderPageProps) {
  const dashQ = useQuery({
    queryKey: ['dashboard', token],
    queryFn: () => getDashboard(token),
    enabled: Boolean(token),
    retry: false,
  });

  const d = dashQ.data;
  const trend = mockTrend(page === 'Analytics' ? 5 : 12);

  if (page === 'Risk analysis') {
    return (
      <div className="page-content">
        <PageHeader
          eyebrow="INTELLIGENCE"
          title="Risk analysis"
          description="Aggregated zone assessments and historical risk trends sourced from the API."
        />
        <DataNotice />

        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          {['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((cat) => {
            const count = d?.riskDistribution.find((x) => x.category === cat)?.count ?? 0;
            return (
              <div className={`stat-card stat-card-${cat.toLowerCase() === 'critical' ? 'red' : cat.toLowerCase() === 'high' ? 'amber' : cat.toLowerCase() === 'moderate' ? 'teal' : 'green'}`} key={cat}>
                <span className="stat-label">{cat.charAt(0) + cat.slice(1).toLowerCase()} risk zones</span>
                <strong className="stat-value">{dashQ.isLoading ? '—' : count}</strong>
                <div className={`stat-accent stat-accent-${cat.toLowerCase() === 'critical' ? 'red' : cat.toLowerCase() === 'high' ? 'amber' : cat.toLowerCase() === 'moderate' ? 'teal' : 'green'}`} />
              </div>
            );
          })}
        </div>

        <div className="dashboard-grid">
          <Card padding="md">
            <CardHeader eyebrow="TREND ANALYSIS" title="Risk index over time (synthetic)" />
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Line type="monotone" dataKey="risk" stroke="var(--teal)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="panel-footnote">Synthetic trend data for demonstration only.</p>
          </Card>

          <Card padding="md">
            <CardHeader eyebrow="SUMMARY" title="Available data" />
            <div className="source-list">
              <div className="source-row">
                <span className="source-icon"><Database size={14} /></span>
                <div className="source-meta"><b>Total incidents</b><small>{d?.summary.total ?? '—'} stored records</small></div>
                <span className="source-state source-active"><span className="source-dot" />LIVE</span>
              </div>
              <div className="source-row">
                <span className="source-icon"><TrendingUp size={14} /></span>
                <div className="source-meta"><b>Verified reports</b><small>{d?.summary.verified ?? '—'} operator reviewed</small></div>
                <span className="source-state source-active"><span className="source-dot" />LIVE</span>
              </div>
              <div className="source-row">
                <span className="source-icon"><Clock size={14} /></span>
                <div className="source-meta"><b>Unresolved</b><small>{d?.summary.unresolved ?? '—'} awaiting action</small></div>
                <span className="source-state source-demo"><span className="source-dot" />DEMO</span>
              </div>
            </div>

            <div className="coming-soon-block">
              <Construction size={18} />
              <div>
                <strong>Advanced analytics coming soon</strong>
                <p>Time-series risk modeling, zone correlation maps, and response benchmarking will be available as historical observations are collected.</p>
              </div>
            </div>

            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('Overview')}>
              ← Back to overview
            </button>
          </Card>
        </div>
      </div>
    );
  }

  // Analytics page
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="INTELLIGENCE"
        title="Analytics"
        description="Incident trends, response times, and seasonal patterns across the Pune metropolitan area."
      />
      <DataNotice />

      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <Card padding="md">
          <CardHeader eyebrow="INCIDENT VOLUME" title="Daily incident trend (synthetic)" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                itemStyle={{ color: 'var(--text)' }}
              />
              <Line type="monotone" dataKey="incidents" stroke="var(--cyan)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="panel-footnote">Synthetic demonstration trend. Not derived from real observations.</p>
        </Card>

        <Card padding="md">
          <CardHeader eyebrow="STATUS" title="Platform metrics" />
          <div className="source-list">
            <div className="source-row">
              <span className="source-icon"><Activity size={14} /></span>
              <div className="source-meta"><b>Reports logged</b><small>{d?.summary.total ?? '—'} total</small></div>
            </div>
            <div className="source-row">
              <span className="source-icon"><BarChart3 size={14} /></span>
              <div className="source-meta"><b>Risk assessments</b><small>{d?.riskDistribution.reduce((s, x) => s + x.count, 0) ?? '—'} zones</small></div>
            </div>
          </div>

          <div className="coming-soon-block">
            <Construction size={18} />
            <div>
              <strong>Historical analytics coming soon</strong>
              <p>Seasonal pattern analysis, response-time benchmarks, and multi-zone correlation will expand here as data is collected over time.</p>
            </div>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('Overview')}>
            ← Back to overview
          </button>
        </Card>
      </div>
    </div>
  );
}
