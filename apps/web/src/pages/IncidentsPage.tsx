import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FilePlus2, Search, Filter, Check, X, AlertTriangle,
  ChevronDown, MapPin, Clock, Siren,
} from 'lucide-react';
import { getIncidents, updateIncidentStatus, createIncident } from '../api.ts';
import type { Incident, IncidentStatus } from '../types.ts';
import { SeverityBadge, StatusBadge } from '../components/ui/Badge.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { Card } from '../components/ui/Card.tsx';

type IncidentsPageProps = {
  token: string;
  userRole: string;
  notice: string;
  onNotice: (msg: string) => void;
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING_VERIFICATION: ['VERIFIED', 'REJECTED', 'DUPLICATE'],
  VERIFIED: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS'],
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  DUPLICATE: 'Duplicate',
  REOPENED: 'Reopened',
  SUBMITTED: 'Submitted',
  PROCESSING: 'Processing',
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function IncidentsPage({ token, userRole, notice, onNotice }: IncidentsPageProps) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const incQ = useQuery({
    queryKey: ['incidents', token, statusFilter],
    queryFn: () => getIncidents(token, { limit: 50, status: statusFilter || undefined }),
    enabled: Boolean(token),
    retry: false,
  });

  const incidents = (incQ.data?.items ?? []).filter((inc) =>
    !search || inc.title.toLowerCase().includes(search.toLowerCase()) || inc.category.includes(search.toUpperCase()),
  );

  async function handleStatus(id: string, status: string) {
    try {
      await updateIncidentStatus(token, id, status);
      onNotice(`Incident updated to ${STATUS_LABELS[status] ?? status}.`);
      void qc.invalidateQueries({ queryKey: ['incidents', token] });
      void qc.invalidateQueries({ queryKey: ['dashboard', token] });
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Unable to update incident');
    }
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const result = await createIncident(token, {
        title: fd.get('title') as string,
        description: fd.get('description') as string,
        category: fd.get('category') as string,
        severity: fd.get('severity') as string,
        latitude: Number(fd.get('latitude')),
        longitude: Number(fd.get('longitude')),
      });
      setShowForm(false);
      onNotice(`Incident ${result.incident.id.slice(0, 8)} submitted for review.`);
      void qc.invalidateQueries({ queryKey: ['incidents', token] });
      void qc.invalidateQueries({ queryKey: ['dashboard', token] });
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Unable to submit incident.');
    }
  }

  const canManage = userRole === 'ADMIN' || userRole === 'OPERATOR';

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="RESPONSE COORDINATION"
        title="Incident management"
        description="Review reports, track status, and coordinate operator response."
        action={
          <button className="btn btn-primary btn-md" onClick={() => setShowForm(true)}>
            <FilePlus2 size={15} />
            <span>New report</span>
          </button>
        }
      />

      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{notice}</span>
          <button className="toast-dismiss" onClick={() => onNotice('')} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {incQ.isError && (
        <div className="alert alert-error" role="alert">
          <AlertTriangle size={15} />
          <div className="alert-body">
            <strong className="alert-title">Unable to load incidents</strong>
            <span className="alert-msg">{incQ.error instanceof Error ? incQ.error.message : 'Request failed'}</span>
          </div>
        </div>
      )}

      <Card padding="none">
        {/* Toolbar */}
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="search-field">
              <Search size={14} className="search-icon" />
              <input
                className="search-input"
                placeholder="Search incidents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search incidents"
              />
              {search && (
                <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              className={`btn btn-ghost btn-sm${showFilters ? ' btn-ghost-active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={14} />
              <span>Filter</span>
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="table-toolbar-right">
            <span className="table-count">
              <strong>{incidents.length}</strong> report{incidents.length !== 1 ? 's' : ''}
              {statusFilter && <span className="table-filter-tag">{STATUS_LABELS[statusFilter]}<button onClick={() => setStatusFilter('')}><X size={10} /></button></span>}
            </span>
          </div>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="filter-row">
            <span className="filter-row-label">Status</span>
            {['', 'PENDING_VERIFICATION', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].map((s) => (
              <button
                key={s}
                className={`filter-chip${statusFilter === s ? ' filter-chip-active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s ? STATUS_LABELS[s] : 'All'}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>INCIDENT</th>
                <th>CATEGORY</th>
                <th>SEVERITY</th>
                <th>STATUS</th>
                <th>REPORTED</th>
                {canManage && <th>ACTION</th>}
              </tr>
            </thead>
            <tbody>
              {incQ.isLoading && (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canManage ? 6 : 5 }, (__, j) => (
                      <td key={j}><span className="skeleton" style={{ width: j === 0 ? '70%' : '50%', height: '0.8rem', display: 'block' }} /></td>
                    ))}
                  </tr>
                ))
              )}
              {!incQ.isLoading && incidents.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 6 : 5}>
                    <div className="table-empty-state">
                      <EmptyState
                        icon={<Siren size={24} />}
                        title="No incidents found"
                        description={search ? 'Try adjusting your search or filters.' : 'Submit a report to get started.'}
                      />
                    </div>
                  </td>
                </tr>
              )}
              {!incQ.isLoading && incidents.map((inc) => (
                <IncidentRow
                  key={inc.id}
                  incident={inc}
                  canManage={canManage}
                  onStatus={handleStatus}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New incident modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Submit incident"
        eyebrow="FIELD REPORT"
        footer={
          <div className="modal-footer-btns">
            <button className="btn btn-ghost btn-md" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary btn-md" type="submit" form="incident-form-incidents">
              <FilePlus2 size={14} /> <span>Submit report</span>
            </button>
          </div>
        }
      >
        <form id="incident-form-incidents" onSubmit={(e) => void handleCreate(e)}>
          <div className="field">
            <label className="field-label" htmlFor="i-title">Incident title</label>
            <input id="i-title" name="title" className="field-input" placeholder="e.g. Waterlogging near Swargate junction" minLength={4} maxLength={160} required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="i-desc">Description</label>
            <textarea id="i-desc" name="description" className="field-input field-textarea" placeholder="Describe what you observed." minLength={8} maxLength={5000} rows={3} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="i-cat">Category</label>
              <select id="i-cat" name="category" className="field-input">
                <option>WATERLOGGING</option><option>FLOODING</option>
                <option>DRAINAGE</option><option>ROAD_BLOCKAGE</option><option>OTHER</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="i-sev">Severity</label>
              <select id="i-sev" name="severity" className="field-input">
                <option>MODERATE</option><option>LOW</option><option>HIGH</option><option>CRITICAL</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="i-lat">Latitude</label>
              <input id="i-lat" name="latitude" type="number" step="any" className="field-input" defaultValue="18.5204" required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="i-lon">Longitude</label>
              <input id="i-lon" name="longitude" type="number" step="any" className="field-input" defaultValue="73.8567" required />
            </div>
          </div>
          <div className="form-note">
            <AlertTriangle size={13} />
            Photo upload is available through the incident evidence API.
          </div>
        </form>
      </Modal>
    </div>
  );
}

function IncidentRow({
  incident, canManage, onStatus,
}: {
  incident: Incident;
  canManage: boolean;
  onStatus: (id: string, status: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const nextStates = STATUS_TRANSITIONS[incident.status] ?? [];

  return (
    <tr className="table-row-hover">
      <td>
        <div className="td-title">
          <strong>{incident.title}</strong>
          <span className="td-id">
            #{incident.id.slice(0, 8)}
            {incident.is_synthetic && <span className="demo-chip">DEMO</span>}
          </span>
        </div>
      </td>
      <td>
        <div className="td-category">
          <MapPin size={12} />
          {incident.category.replace('_', ' ')}
        </div>
      </td>
      <td><SeverityBadge severity={incident.severity} /></td>
      <td><StatusBadge status={incident.status as IncidentStatus} /></td>
      <td>
        <div className="td-time">
          <Clock size={12} />
          {fmtDateTime(incident.created_at)}
        </div>
      </td>
      {canManage && (
        <td>
          {nextStates.length > 0 ? (
            <div className="action-dropdown">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowActions(!showActions)}
                aria-expanded={showActions}
              >
                Update <ChevronDown size={12} />
              </button>
              {showActions && (
                <div className="action-menu">
                  {nextStates.map((s) => (
                    <button
                      key={s}
                      className="action-menu-item"
                      onClick={() => { setShowActions(false); void onStatus(incident.id, s); }}
                    >
                      <Check size={12} />
                      {STATUS_LABELS[s] ?? s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="td-muted">—</span>
          )}
        </td>
      )}
    </tr>
  );
}
