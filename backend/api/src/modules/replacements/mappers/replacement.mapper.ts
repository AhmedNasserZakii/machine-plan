import { ReplacementResponse } from '../dto/responses/replacement.response';
import { MachineReplacement } from '../entities/machine-replacement.entity';

export function toReplacementResponse(row: MachineReplacement): ReplacementResponse {
  return {
    id: row.id,
    oldMachine: {
      id: row.oldMachine.id,
      serial: row.oldMachine.serial,
      status: row.oldMachine.status,
    },
    newMachine: {
      id: row.newMachine.id,
      serial: row.newMachine.serial,
      status: row.newMachine.status,
    },
    maintenanceOrderId: row.maintenanceOrderId,
    reason: row.reason,
    replacedAt: row.replacedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
