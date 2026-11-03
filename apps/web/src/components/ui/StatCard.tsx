import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Tone = 'blue' | 'teal' | 'amber' | 'red' | 'green' | 'purple';
type Trend = 'up' | 'down' | 'neutral';

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  note?: string;
  trend?: Trend;
  trendLabel?: string;
  loading?: boolean;
};

const trendIcon = { up: <TrendingUp size={12} />, down: <TrendingDown size={12} />, neutral: <Minus size={12} /> };

export function StatCard({ label, value, icon, tone = 'blue', note, trend, trendLabel, loading }: StatCardProps) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-top">
        <span className={`stat-icon stat-icon-${tone}`}>{icon}</span>
        {trend && (
          <span className={`stat-trend stat-trend-${trend}`}>
            {trendIcon[trend]}
            {trendLabel}
          </span>
        )}
      </div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">
        {loading ? <span className="skeleton" style={{ width: '3rem', height: '1.75rem', display: 'inline-block' }} /> : value}
      </strong>
      {note && <span className="stat-note">{note}</span>}
      <div className={`stat-accent stat-accent-${tone}`} />
    </article>
  );
}
