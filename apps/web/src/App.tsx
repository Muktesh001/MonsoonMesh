import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from './api.ts';
import type { User } from './types.ts';
import { AppShell, type Page } from './components/layout/AppShell.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { IncidentsPage } from './pages/IncidentsPage.tsx';
import { LiveMapPage } from './pages/LiveMapPage.tsx';
import { SimulationPage } from './pages/SimulationPage.tsx';
import { RiskAnalysisPage } from './pages/RiskAnalysisPage.tsx';
import { AnalyticsPage } from './pages/AnalyticsPage.tsx';

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('mm-token') ?? '');
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('mm-user');
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [page, setPage] = useState<Page>('Overview');
  const [notice, setNotice] = useState('');
  const [showIncidentForm, setShowIncidentForm] = useState(false);

  // Prefetch dashboard so the shell always has unresolved count
  const dashQ = useQuery({
    queryKey: ['dashboard', token],
    queryFn: () => getDashboard(token),
    enabled: Boolean(token),
    refetchInterval: 30_000,
    retry: false,
  });

  const unresolved = dashQ.data?.summary.unresolved ?? 0;

  function signIn(nextToken: string, nextUser: User) {
    setToken(nextToken);
    setUser(nextUser);
  }

  function signOut() {
    localStorage.removeItem('mm-token');
    localStorage.removeItem('mm-user');
    setToken('');
    setUser(null);
    setPage('Overview');
  }

  if (!token || !user) {
    return <LoginPage onLogin={signIn} />;
  }

  return (
    <AppShell
      user={user}
      page={page}
      onNavigate={setPage}
      onSignOut={signOut}
      unresolved={unresolved}
    >
      {page === 'Overview' && (
        <OverviewPage
          token={token}
          userName={user.displayName}
          userRole={user.role}
          onNavigate={setPage}
          notice={notice}
          onNotice={setNotice}
          showIncidentForm={showIncidentForm}
          onOpenForm={() => setShowIncidentForm(true)}
          onCloseForm={() => setShowIncidentForm(false)}
        />
      )}

      {page === 'Live map' && (
        <LiveMapPage token={token} />
      )}

      {page === 'Incidents' && (
        <IncidentsPage
          token={token}
          userRole={user.role}
          notice={notice}
          onNotice={setNotice}
        />
      )}

      {page === 'Simulation' && (
        <SimulationPage token={token} />
      )}

      {page === 'Risk analysis' && (
        <RiskAnalysisPage token={token} onNavigate={setPage} />
      )}

      {page === 'Analytics' && (
        <AnalyticsPage token={token} />
      )}
    </AppShell>
  );
}

export default App;
