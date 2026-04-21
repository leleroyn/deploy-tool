import { auditRepository, AuditFilter, AuditLog } from '../repositories/auditRepository';

export class AuditService {
  async log(operatorId: string, operatorName: string, eventType: string, target: string, result: string): Promise<void> {
    await auditRepository.create({
      operator_id: operatorId,
      operator_name: operatorName,
      event_type: eventType,
      target: target,
      result: result
    });
  }

  async getLogs(filter: AuditFilter): Promise<AuditLog[]> {
    return await auditRepository.find(filter);
  }
}

export const auditService = new AuditService();
