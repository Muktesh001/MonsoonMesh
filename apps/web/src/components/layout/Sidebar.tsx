import {
  Activity, BarChart3, ChevronDown, CloudRain, Droplets,
  Gauge, LogOut, Map as MapIcon, Menu, Siren, X,
} from 'lucide-react';
import type { User } from '../../types.ts';
import type { Page } from '../layout/AppShell.tsx';

type NavItem = { name: Page; icon: typeof Activity; section: string };

const NAV_ITEMS: NavItem[] = [
  { name: 'Overview',      icon: Gauge,    section: 'COMMAND' },
  { name: 'Live map',      icon: MapIcon,  section: 'COMMAND' },
  { name: 'Incidents',     icon: Siren,    section: 'RESPONSE' },
  { name: 'Risk analysis', icon: BarChart3, section: 'INTELLIGENCE' },
  { name: 'Simulation',    icon: CloudRain, section: 'INTELLIGENCE' },
  { name: 'Analytics',     icon: Activity, section: 'INTELLIGENCE' },
];

const SECTIONS = ['COMMAND', 'RESPONSE', 'INTELLIGENCE'] as const;

type SidebarProps = {
  page: Page;
  onNavigate: (p: Page) => void;
  user: User;
  onSignOut: () => void;
  open: boolean;
  onClose: () => void;
  unresolved: number;
};

export function Sidebar({ page, onNavigate, user, onSignOut, open, onClose, unresolved }: SidebarProps) {
  function navigate(p: Page) {
    onNavigate(p);
    onClose();
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          className="sidebar-overlay"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Droplets size={20} />
          </div>
          <div className="brand-text">
            <strong>monsoon<span>mesh</span></strong>
            <small>FLOOD INTELLIGENCE</small>
          </div>
          <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
            <X size={17} />
          </button>
        </div>

        {/* Workspace chip */}
        <div className="workspace-chip">
          <span className="workspace-avatar">P</span>
          <div className="workspace-meta">
            <b>Pune Operations</b>
            <small>DEMO ENVIRONMENT</small>
          </div>
          <ChevronDown size={14} className="workspace-chevron" />
        </div>

        {/* Nav groups */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {SECTIONS.map((section) => (
            <div className="nav-section" key={section}>
              <span className="nav-section-label">{section}</span>
              {NAV_ITEMS.filter((item) => item.section === section).map((item) => (
                <button
                  key={item.name}
                  className={`nav-item${page === item.name ? ' nav-item-active' : ''}`}
                  onClick={() => navigate(item.name)}
                  aria-current={page === item.name ? 'page' : undefined}
                >
                  <span className="nav-item-icon">
                    <item.icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="nav-item-label">{item.name}</span>
                  {item.name === 'Incidents' && unresolved > 0 && (
                    <span className="nav-badge">{unresolved}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="sidebar-footer">
          <div className="connection-status">
            <span className="status-dot" />
            <div>
              <b>Local fixture mode</b>
              <small>External feeds not connected</small>
            </div>
          </div>
          <div className="user-row">
            <div className="user-avatar" aria-hidden="true">
              {user.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="user-meta">
              <b>{user.displayName}</b>
              <small>{user.role.replace('_', ' ')}</small>
            </div>
            <button className="icon-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn mobile-menu-btn" onClick={onClick} aria-label="Open menu">
      <Menu size={19} />
    </button>
  );
}
