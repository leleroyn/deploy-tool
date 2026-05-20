import { auditRepository, AuditFilter, AuditLog } from '../repositories/auditRepository';

export class AuditService {
  async log(operatorId: string, operatorName: string, eventType: string, target: string, result: string, operatorIp?: string): Promise<void> {
    await auditRepository.create({
      operator_id: operatorId,
      operator_name: operatorName,
      event_type: eventType,
      target: target,
      result: result,
      operator_ip: operatorIp || ''
    });
  }

  async getLogs(filter: AuditFilter): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      auditRepository.find(filter),
      auditRepository.count(filter),
    ]);
    return { logs, total };
  }
}

export const auditService = new AuditService();
