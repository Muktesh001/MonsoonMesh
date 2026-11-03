import { useState, type ReactNode } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import type { User } from '../../types.ts';
import { Sidebar, MobileMenuButton } from './Sidebar.tsx';

export type Page = 'Overview' | 'Live map' | 'Incidents' | 'Risk analysis' | 'Simulation' | 'Analytics';

type AppShellProps = {
  user: User;
  page: Page;
  onNavigate: (p: Page) => void;
  onSignOut: () => void;
  unresolved: number;
  children: ReactNode;
};

export function AppShell({ user, page, onNavigate, onSignOut, unresolved, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={onNavigate}
        user={user}
        onSignOut={onSignOut}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unresolved={unresolved}
      />

      <div className="app-main">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <MobileMenuButton onClick={() => setSidebarOpen(true)} />
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <span className="breadcrumb-root">Workspace</span>
              <ChevronRight size={13} className="breadcrumb-sep" />
              <span className="breadcrumb-current">{page}</span>
            </nav>
          </div>
          <div className="topbar-right">
            <div className="env-tag">
              <span className="env-dot" />
              DEMONSTRATION
            </div>
            <button className="icon-btn notif-btn" aria-label="Notifications">
              <Bell size={17} />
              <span className="notif-dot" />
            </button>
            <div className="topbar-user">
              <div className="topbar-avatar" aria-hidden="true">
                {user.displayName.slice(0, 1).toUpperCase()}
              </div>
              <span className="topbar-username">{user.displayName.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="page-wrap">
          {children}
          <footer className="page-footer">
            <span>MONSOONMESH · FLOOD INTELLIGENCE PLATFORM</span>
            <span>Decision support only · Verify all field conditions before action</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
