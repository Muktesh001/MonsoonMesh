import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, X, ChevronDown, Layers } from 'lucide-react';
import { getDashboard, getRiskAssessments } from '../api.ts';
import type { ZoneProperties } from '../types.ts';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';

const RiskMap = lazy(() => import('../components/map/RiskMap.tsx'));

type LiveMapPageProps = {
  token: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-high',
  MODERATE: 'badge-moderate',
  LOW: 'badge-low',
};

export function LiveMapPage({ token }: LiveMapPageProps) {
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState<ZoneProperties | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const dashQ = useQuery({
    queryKey: ['dashboard', token],
    queryFn: () => getDashboard(token),
    enabled: Boolean(token),
    retry: false,
  });

  const riskQ = useQuery({
    queryKey: ['riskAssessments', token],
    queryFn: () => getRiskAssessments(token),
    enabled: Boolean(token),
    refetchInterval: 60_000,
    retry: false,
  });

  const risks = riskQ.data?.items ?? [];
  const riskDist = [
    { category: 'CRITICAL', count: risks.filter(r => r.category === 'CRITICAL').length },
    { category: 'HIGH', count: risks.filter(r => r.category === 'HIGH').length },
    { category: 'MODERATE', count: risks.filter(r => r.category === 'MODERATE').length },
    { category: 'LOW', count: risks.filter(r => r.category === 'LOW').length },
  ];
  const totalZones = risks.length || (dashQ.data?.riskDistribution.reduce((s, x) => s + x.count, 0) ?? 0);

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="GEOSPATIAL INTELLIGENCE"
        title="City risk map"
        description="Stored zone boundaries and latest illustrative risk assessments across the Pune metropolitan area."
        action={
          <div className="map-page-toolbar">
            <div className="search-field">
              <Search size={14} className="search-icon" />
              <input
                className="search-input"
                placeholder="Search zone or area…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search zones"
              />
              {search && <button className="search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
            </div>
            <button className="btn btn-ghost btn-sm">
              <Filter size={14} />
              <span>All zones</span>
              <ChevronDown size={12} />
            </button>
          </div>
        }
      />

      {/* Risk category quick-filters */}
      <div className="map-filter-bar">
        {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((cat) => (
          <button
            key={cat}
            className={`map-filter-chip${activeFilter === cat ? ' active' : ''}`}
            onClick={() => setActiveFilter(cat)}
          >
            {cat !== 'ALL' && <span className={`map-filter-dot dot-${cat.toLowerCase()}`} />}
            {cat === 'ALL' ? 'All zones' : cat.charAt(0) + cat.slice(1).toLowerCase()}
            {cat !== 'ALL' && (
              <span className="map-filter-count">
                {riskDist.find((x) => x.category === cat)?.count ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="map-page-layout">
        {/* Map */}
        <Card padding="none" className="map-page-card">
          <Suspense fallback={<div className="map-placeholder map-placeholder-lg">Loading map…</div>}>
            <RiskMap token={token} height="100%" onZoneClick={setSelectedZone} />
          </Suspense>
          <div className="map-page-footer">
            <div className="map-page-footer-left">
              <Layers size={13} />
              <span>{totalZones} {risks.length > 0 ? 'assessed zones' : 'zones'}</span>
            </div>
            <span className="map-page-footer-note">
              {risks.length > 0 ? 'Real external risk assessments' : 'Coordinates and zones are demonstration fixtures.'}
            </span>
          </div>
        </Card>

        {/* Side panel */}
        <div className="map-side-panel">
          {/* Zone detail */}
          {selectedZone ? (
            <Card padding="md">
              <div className="zone-detail-header">
                <div>
                  <span className="eyebrow">SELECTED ZONE</span>
                  <h3 className="zone-detail-name">{selectedZone.name}</h3>
                </div>
                <button className="icon-btn" onClick={() => setSelectedZone(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <div className="zone-detail-rows">
                <div className="zone-detail-row">
                  <span>Risk category</span>
                  <span className={`badge ${CATEGORY_COLORS[selectedZone.category ?? 'LOW']}`}>
                    {selectedZone.category ?? 'Unknown'}
                  </span>
                </div>
                <div className="zone-detail-row">
                  <span>Risk score</span>
                  <strong>{selectedZone.risk != null ? selectedZone.risk.toFixed(0) : 'Not assessed'}</strong>
                </div>
                <div className="zone-detail-row">
                  <span>Zone type</span>
                  <span>{selectedZone.zoneType ?? '—'}</span>
                </div>
                <div className="zone-detail-row">
                  <span>Data source</span>
                  <Badge variant={risks.length > 0 ? 'neutral' : 'demo'}>
                    {risks.length > 0 ? 'EXTERNAL' : 'SYNTHETIC'}
                  </Badge>
                </div>
              </div>
              <p className="zone-detail-note">
                Risk score is derived from external data feeds (weather, historical, infrastructure) and is a decision-support tool, not a validated flood probability.
              </p>
            </Card>
          ) : (
            <Card padding="md">
              <span className="eyebrow">ZONE DETAIL</span>
              <div className="zone-empty-hint">
                <Layers size={28} />
                <span>Click a zone on the map to view risk details.</span>
              </div>
            </Card>
          )}

          {/* Risk summary */}
          <Card padding="md">
            <span className="eyebrow">RISK SUMMARY</span>
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Zone breakdown</h3>
            <div className="risk-summary-bars">
              {riskDist.map((item) => {
                const count = item.count;
                const max = Math.max(...riskDist.map((x) => x.count), 1);
                return (
                  <div className="risk-bar-row" key={item.category}>
                    <span className="risk-bar-label">{item.category.charAt(0) + item.category.slice(1).toLowerCase()}</span>
                    <div className="risk-bar-track">
                      <div
                        className={`risk-bar-fill risk-fill-${item.category.toLowerCase()}`}
                        style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                      />
                    </div>
                    <span className="risk-bar-count">{count}</span>
                  </div>
                );
              })}
            </div>
            <p className="panel-footnote">{risks.length > 0 ? 'Real external risk assessments. Updated every minute.' : 'Synthetic demonstration data. Not validated flood probabilities.'}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
