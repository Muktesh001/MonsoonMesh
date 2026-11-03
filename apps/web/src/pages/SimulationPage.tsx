import { useState, type FormEvent } from 'react';
import { CloudRain, Gauge, RotateCcw, Info } from 'lucide-react';
import { runSimulation } from '../api.ts';
import type { SimulationFactors, SimulationResult } from '../types.ts';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { SeverityBadge } from '../components/ui/Badge.tsx';

type SimulationPageProps = {
  token: string;
};

const DEFAULT_FACTORS: SimulationFactors = {
  rainfall: 70,
  history: 55,
  slope: 35,
  drainage: 60,
  incidents: 50,
};

const FACTOR_META: Record<keyof SimulationFactors, { label: string; description: string; icon: string }> = {
  rainfall:  { label: 'Rainfall intensity',  description: 'Assumed rainfall in mm/hr (0 = dry, 100 = extreme)', icon: '🌧' },
  history:   { label: 'Historical flooding', description: 'Prior flood events in this zone (0 = none, 100 = frequent)', icon: '📋' },
  slope:     { label: 'Terrain slope',       description: 'Gradient of terrain affecting runoff (0 = flat, 100 = steep)', icon: '⛰' },
  drainage:  { label: 'Drainage capacity',   description: 'Current drainage infrastructure load (0 = free, 100 = full)', icon: '🔧' },
  incidents: { label: 'Active incidents',    description: 'Number of related active incidents nearby (scaled 0–100)', icon: '🚨' },
};

function getRiskColor(cat: string): string {
  switch (cat) {
    case 'CRITICAL': return 'var(--red)';
    case 'HIGH': return 'var(--amber)';
    case 'MODERATE': return 'var(--teal)';
    default: return 'var(--green)';
  }
}

function ScoreArc({ score, category }: { score: number; category: string }) {
  const r = 54;
  const cx = 70;
  const cy = 70;
  const circ = Math.PI * r; // half circumference for semicircle
  const fill = (score / 100) * circ;
  const color = getRiskColor(category);

  return (
    <svg viewBox="0 0 140 80" className="score-arc" aria-hidden="true">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="var(--border)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" className="arc-score" fill="var(--text)">
        {score}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="arc-label" fill="var(--muted)">
        / 100
      </text>
    </svg>
  );
}

export function SimulationPage({ token }: SimulationPageProps) {
  const [factors, setFactors] = useState<SimulationFactors>(DEFAULT_FACTORS);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await runSimulation(token, factors);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFactors(DEFAULT_FACTORS);
    setResult(null);
    setError('');
  }

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="SCENARIO PLANNING"
        title="What-if simulation"
        description="Explore how assumed conditions affect the illustrative risk index. Results are not observations."
        meta={
          <div className="model-badge">
            <CloudRain size={12} /> ILLUSTRATIVE V1 · SIMULATED ONLY
          </div>
        }
      />

      <div className="sim-layout">
        {/* Inputs */}
        <Card padding="md">
          <CardHeader
            eyebrow="SCENARIO INPUTS"
            title="Adjust risk factors"
            action={
              <button className="btn btn-ghost btn-sm" onClick={reset} title="Reset to defaults">
                <RotateCcw size={13} /> <span>Reset</span>
              </button>
            }
          />

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <span className="alert-msg">{error}</span>
            </div>
          )}

          <form onSubmit={(e) => void submit(e)}>
            <div className="sim-factors">
              {(Object.keys(factors) as (keyof SimulationFactors)[]).map((key) => {
                const meta = FACTOR_META[key];
                const val = factors[key];
                return (
                  <div className="sim-factor" key={key}>
                    <div className="sim-factor-header">
                      <div>
                        <span className="sim-factor-icon">{meta.icon}</span>
                        <span className="sim-factor-label">{meta.label}</span>
                      </div>
                      <span className="sim-factor-value">{val}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => setFactors({ ...factors, [key]: Number(e.target.value) })}
                      className="sim-slider"
                      aria-label={meta.label}
                    />
                    <div className="sim-factor-desc">{meta.description}</div>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary btn-md btn-full" type="submit" disabled={loading}>
              {loading
                ? <><span className="btn-spinner" /><span>Calculating…</span></>
                : <><Gauge size={15} /><span>Calculate scenario risk</span></>
              }
            </button>
          </form>
          <p className="panel-footnote" style={{ marginTop: '1rem' }}>
            Simulation does not alter weather observations or verified incident records.
          </p>
        </Card>

        {/* Result */}
        <Card padding="md">
          <CardHeader eyebrow="SCENARIO OUTPUT" title="Risk estimate" />

          {!result && !loading && (
            <div className="sim-empty">
              <CloudRain size={32} />
              <strong>Ready to model a scenario</strong>
              <span>Adjust the factors on the left and click Calculate to see the estimated risk index.</span>
            </div>
          )}

          {loading && (
            <div className="sim-empty">
              <span className="btn-spinner" style={{ width: '2rem', height: '2rem', borderWidth: '3px' }} />
              <span>Running simulation…</span>
            </div>
          )}

          {result && !loading && (
            <div className="sim-result">
              <ScoreArc score={result.score} category={result.category} />
              <div className="sim-result-category">
                <SeverityBadge severity={result.category as 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'} />
                <span className="sim-result-risk-label">RISK LEVEL</span>
              </div>
              <p className="sim-result-label">{result.label}</p>

              <div className="sim-breakdown">
                <div className="sim-breakdown-title"><Info size={12} /> Factor contribution</div>
                {(Object.keys(factors) as (keyof SimulationFactors)[]).map((key) => {
                  const val = factors[key];
                  return (
                    <div className="sim-breakdown-row" key={key}>
                      <span>{FACTOR_META[key].label}</span>
                      <div className="sim-breakdown-bar-track">
                        <div
                          className="sim-breakdown-bar-fill"
                          style={{ width: `${val}%`, background: getRiskColor(result.category) }}
                        />
                      </div>
                      <span className="sim-breakdown-val">{val}</span>
                    </div>
                  );
                })}
              </div>

              <div className="sim-result-footer">
                <span>Active model</span>
                <strong>{result.modelVersion ?? 'illustrative-v1'}</strong>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
