import type { ReactNode, HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

export function Card({ children, padding = 'md', className = '', ...rest }: CardProps) {
  return (
    <div className={`card card-pad-${padding} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

type CardHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
};

export function CardHeader({ eyebrow, title, action }: CardHeaderProps) {
  return (
    <div className="card-header">
      <div className="card-header-left">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="card-title">{title}</h2>
      </div>
      {action && <div className="card-header-action">{action}</div>}
    </div>
  );
}
