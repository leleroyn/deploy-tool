import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLog {
  id: string;
  operator_id: string;
  operator_name: string;
  event_type: string;
  target: string;
  result: string;
  timestamp: string;
}

export interface AuditFilter {
  username?: string;
  eventType?: string;
  target?: string;
  result?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export class AuditRepository {
  async create(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, operator_id, operator_name, event_type, target, result)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, log.operator_id, log.operator_name, log.event_type, log.target, log.result);
  }

  async find(filter: AuditFilter): Promise<AuditLog[]> {
    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (filter.username) {
      whereClauses.push('operator_name = ?');
      params.push(filter.username);
    }
    if (filter.eventType) {
      whereClauses.push('event_type = ?');
      params.push(filter.eventType);
    }
    if (filter.target) {
      whereClauses.push('target = ?');
      params.push(filter.target);
    }
    if (filter.result) {
      whereClauses.push('result = ?');
      params.push(filter.result);
    }
    if (filter.startTime) {
      whereClauses.push('timestamp >= ?');
      params.push(filter.startTime);
    }
    if (filter.endTime) {
      whereClauses.push('timestamp <= ?');
      params.push(filter.endTime);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC';

    const limit = filter.limit || 20;
    const offset = filter.offset || 0;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params) as AuditLog[];
  }
}

export const auditRepository = new AuditRepository();
