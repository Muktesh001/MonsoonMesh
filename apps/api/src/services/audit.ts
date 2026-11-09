import { pool } from '../db.js';
import { createChildLogger } from '../logger.js';
import { config } from '../config.js';

const logger = createChildLogger('audit');

export interface AuditLogEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  if (!config.enableAuditLogs) {
    logger.debug('Audit logging disabled, skipping', {
      action: entry.action,
      entityType: entry.entityType,
    });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, request_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.actorId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.requestId,
        entry.details ? JSON.stringify(entry.details) : null,
      ],
    );

    logger.info(`Audit event logged`, {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actor: entry.actorId,
    });
  } catch (error) {
    logger.error(`Failed to log audit event`, {
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Log incident status change
 */
export async function logIncidentStatusChange(
  incidentId: string,
  actorId: string,
  fromStatus: string,
  toStatus: string,
  requestId: string,
): Promise<void> {
  await logAuditEvent({
    actorId,
    action: 'INCIDENT_STATUS_CHANGED',
    entityType: 'INCIDENT',
    entityId: incidentId,
    requestId,
    details: {
      from_status: fromStatus,
      to_status: toStatus,
      changed_at: new Date().toISOString(),
    },
  });
}

/**
 * Log incident creation
 */
export async function logIncidentCreation(
  incidentId: string,
  actorId: string,
  requestId: string,
  details?: Record<string, any>,
): Promise<void> {
  await logAuditEvent({
    actorId,
    action: 'INCIDENT_CREATED',
    entityType: 'INCIDENT',
    entityId: incidentId,
    requestId,
    details: {
      created_at: new Date().toISOString(),
      ...details,
    },
  });
}

/**
 * Log evidence upload
 */
export async function logEvidenceUpload(
  incidentId: string,
  evidenceId: string,
  actorId: string,
  requestId: string,
): Promise<void> {
  await logAuditEvent({
    actorId,
    action: 'EVIDENCE_UPLOADED',
    entityType: 'INCIDENT_EVIDENCE',
    entityId: evidenceId,
    requestId,
    details: {
      incident_id: incidentId,
      uploaded_at: new Date().toISOString(),
    },
  });
}

/**
 * Log authentication event
 */
export async function logAuthEvent(
  userId: string | null,
  action: string,
  requestId: string,
  details?: Record<string, any>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs(actor_id, action, entity_type, request_id, details)
       VALUES ($1, $2, 'AUTH', $3, $4)`,
      [
        userId,
        action,
        requestId,
        details ? JSON.stringify(details) : null,
      ],
    );

    logger.info(`Auth event logged`, {
      action,
      actor: userId || 'anonymous',
    });
  } catch (error) {
    logger.error(`Failed to log auth event`, {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get audit log entries for an entity
 */
export async function getAuditLogs(
  entityType: string,
  entityId: string,
  limit = 50,
): Promise<any[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, actor_id, action, entity_type, entity_id, request_id, details, created_at
       FROM audit_logs
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [entityType, entityId, limit],
    );
    return rows;
  } catch (error) {
    logger.error(`Failed to fetch audit logs`, {
      entityType,
      entityId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
