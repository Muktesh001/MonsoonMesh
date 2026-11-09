import type { IncidentEvent } from '../../types.ts';
import { Timeline } from './Timeline.tsx';

type StatusTimelineProps = {
  events: IncidentEvent[];
};

export function StatusTimeline({ events }: StatusTimelineProps) {
  // Transform incident events into timeline events, filtering for status changes
  const timelineEvents = events
    .map((event) => ({
      id: event.event_type + event.created_at,
      title: event.event_type.replace(/_/g, ' '),
      timestamp: event.created_at,
      type: 'status' as const,
      description: event.details && typeof event.details === 'object'
        ? (event.details as Record<string, unknown>).to
          ? `Status changed to ${(event.details as Record<string, unknown>).to}`
          : undefined
        : undefined,
      metadata: event.details as Record<string, unknown> | undefined,
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return <Timeline events={timelineEvents} />;
}
