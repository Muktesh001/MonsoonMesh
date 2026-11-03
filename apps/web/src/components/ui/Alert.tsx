import type { ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle, X, Wifi } from 'lucide-react';

type AlertVariant = 'error' | 'warning' | 'success' | 'info' | 'network';

type AlertProps = {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
};

const icons: Record<AlertVariant, ReactNode> = {
  error: <AlertTriangle size={16} />,
  warning: <AlertTriangle size={16} />,
  success: <CheckCircle size={16} />,
  info: <Info size={16} />,
  network: <Wifi size={16} />,
};

export function Alert({ variant, title, children, onDismiss }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`} role="alert">
      <span className="alert-icon">{icons[variant]}</span>
      <div className="alert-body">
        {title && <strong className="alert-title">{title}</strong>}
        <span className="alert-msg">{children}</span>
      </div>
      {onDismiss && (
        <button className="alert-dismiss" onClick={onDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function DataNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="data-notice" role="note">
      <Info size={14} />
      <span>
        {children ?? 'All values shown are synthetic demonstration fixtures — not live observations or validated flood probabilities.'}
      </span>
    </div>
  );
}
