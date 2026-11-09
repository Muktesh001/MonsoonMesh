import type { ReactNode } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

type TimelineEvent = {
  id: string;
  title: string;
  timestamp: string;
  description?: string;
  type?: 'status' | 'evidence' | 'comment' | 'system';
  metadata?: Record<string, unknown>;
};

type TimelineProps = {
  events: TimelineEvent[];
};

function getEventColor(type?: string): string {
  switch (type) {
    case 'status': return 'timeline-event-status';
    case 'evidence': return 'timeline-event-evidence';
    case 'comment': return 'timeline-event-comment';
    case 'system': return 'timeline-event-system';
    default: return 'timeline-event-default';
  }
}

function getEventIcon(type?: string): ReactNode {
  switch (type) {
    case 'status': return <CheckCircle2 size={16} />;
    case 'evidence': return <Clock size={16} />;
    case 'comment': return <Clock size={16} />;
    default: return <Clock size={16} />;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Timeline({ events }: TimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="timeline-empty">
        <Clock size={20} />
        <span>No events recorded</span>
      </div>
    );
  }

  return (
    <div className="timeline">
      {events.map((event, index) => (
        <div key={event.id} className="timeline-item">
          <div className={`timeline-marker ${getEventColor(event.type)}`}>
            {getEventIcon(event.type)}
          </div>
          <div className="timeline-content">
            <div className="timeline-header">
              <strong className="timeline-title">{event.title}</strong>
              <span className="timeline-time">{formatDateTime(event.timestamp)}</span>
            </div>
            {event.description && <p className="timeline-description">{event.description}</p>}
            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <div className="timeline-metadata">
                {Object.entries(event.metadata).map(([key, value]) => (
                  <div key={key} className="timeline-meta-item">
                    <span className="meta-label">{key}:</span>
                    <span className="meta-value">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {index < events.length - 1 && <div className="timeline-connector" />}
        </div>
      ))}
    </div>
  );
}
