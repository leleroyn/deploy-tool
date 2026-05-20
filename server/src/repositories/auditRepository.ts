import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLog {
  id: string;
  operator_id: string;
  operator_name: string;
  event_type: string;
  target: string;
  result: string;
  operator_ip: string;
  timestamp: string;
}

export interface AuditFilter {
  username?: string;
  eventType?: string;
  target?: string;
  result?: string;
  operatorIp?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export class AuditRepository {
  async create(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, operator_id, operator_name, event_type, target, result, operator_ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, log.operator_id, log.operator_name, log.event_type, log.target, log.result, log.operator_ip || '');
  }

  private buildWhere(filter: AuditFilter): { clauses: string[]; params: any[] } {
    const whereClauses: string[] = [];
    const params: any[] = [];

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
    if (filter.operatorIp) {
      whereClauses.push('operator_ip = ?');
      params.push(filter.operatorIp);
    }
    if (filter.startTime) {
      whereClauses.push('timestamp >= ?');
      params.push(filter.startTime);
    }
    if (filter.endTime) {
      whereClauses.push('timestamp <= ?');
      params.push(filter.endTime);
    }

    return { clauses: whereClauses, params };
  }

  async find(filter: AuditFilter): Promise<AuditLog[]> {
    let query = 'SELECT * FROM audit_logs';
    const { clauses, params } = this.buildWhere(filter);

    if (clauses.length > 0) {
      query += ' WHERE ' + clauses.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC';

    const limit = filter.limit || 10;
    const offset = filter.offset || 0;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params) as AuditLog[];
  }

  async count(filter: AuditFilter): Promise<number> {
    let query = 'SELECT COUNT(*) as total FROM audit_logs';
    const { clauses, params } = this.buildWhere(filter);

    if (clauses.length > 0) {
      query += ' WHERE ' + clauses.join(' AND ');
    }

    const result = db.prepare(query).get(...params) as any;
    return result.total;
  }
}

export const auditRepository = new AuditRepository();
