import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action, meta }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}
