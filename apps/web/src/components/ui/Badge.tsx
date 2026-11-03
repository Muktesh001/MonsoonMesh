import type { ReactNode } from 'react';
import type { Severity, IncidentStatus, RiskCategory } from '../../types.ts';

type BadgeVariant = 'severity' | 'status' | 'risk' | 'neutral' | 'demo' | 'local' | 'warning';

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  severity?: Severity | RiskCategory;
  status?: IncidentStatus;
  size?: 'sm' | 'md';
};

function severityClass(s?: Severity | RiskCategory): string {
  switch (s) {
    case 'CRITICAL': return 'badge-critical';
    case 'HIGH': return 'badge-high';
    case 'MODERATE': return 'badge-moderate';
    case 'LOW': return 'badge-low';
    default: return 'badge-neutral';
  }
}

function statusClass(s?: IncidentStatus): string {
  switch (s) {
    case 'VERIFIED':
    case 'RESOLVED': return 'badge-success';
    case 'IN_PROGRESS':
    case 'ASSIGNED': return 'badge-info';
    case 'PENDING_VERIFICATION':
    case 'SUBMITTED':
    case 'PROCESSING': return 'badge-warning';
    case 'REJECTED':
    case 'DUPLICATE': return 'badge-muted';
    case 'REOPENED': return 'badge-amber';
    default: return 'badge-neutral';
  }
}

export function Badge({ children, variant = 'neutral', severity, status, size = 'sm' }: BadgeProps) {
  let cls = 'badge';
  if (size === 'md') cls += ' badge-md';

  if (variant === 'severity' || variant === 'risk') cls += ` ${severityClass(severity)}`;
  else if (variant === 'status') cls += ` ${statusClass(status)}`;
  else if (variant === 'demo') cls += ' badge-demo';
  else if (variant === 'local') cls += ' badge-local';
  else if (variant === 'warning') cls += ' badge-warning';
  else cls += ' badge-neutral';

  return <span className={cls}>{children}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge variant="severity" severity={severity}>{severity}</Badge>;
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge variant="status" status={status}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
