import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { diffSnapshots } from './audit-diff';
import { currentAuditContext } from './audit-context';
import { AuditLog } from './audit-log.entity';
import { AuditQueueService } from './audit-queue.service';
import { AuditRecordInput, AuditRecordRow } from './audit.types';

const USER_AGENT_MAX_LENGTH = 255;

/**
 * The one entry point every audited action goes through (`21`). `record()` never throws and
 * never makes the caller wait on the database: it reduces the given snapshots to changed keys,
 * redacts them, fills in the request context automatically, and hands the row to the queue.
 *
 * Kept deliberately dumb about *what* happened — that is the caller's job (`AuditAction`,
 * `entityType`/`entityId`, the two snapshots). This service only knows how to turn that into a
 * safe, durable row.
 */
@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
    private readonly queue: AuditQueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.start((record) => this.write(record));
  }

  async record(input: AuditRecordInput): Promise<void> {
    try {
      const ambient = currentAuditContext();
      const { before, after } = diffSnapshots(input.before, input.after);

      const row: AuditRecordRow = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        userId: input.userId,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        before,
        after,
        requestId: input.requestId ?? ambient?.requestId ?? null,
        ipAddress: input.ipAddress ?? ambient?.ipAddress ?? null,
        userAgent:
          (input.userAgent ?? ambient?.userAgent ?? null)?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
      };

      await this.queue.enqueue(row);
    } catch (error) {
      // Recording the fact that recording failed is enough here: throwing would turn an audit
      // gap into a failed business transaction, which `21` explicitly rules out.
      this.logger.error({ err: error, action: input.action }, 'Failed to record audit event');
    }
  }

  private async write(record: AuditRecordRow): Promise<void> {
    await this.logs.insert({
      id: record.id,
      createdAt: new Date(record.createdAt),
      userId: record.userId,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      before: record.before,
      after: record.after,
      requestId: record.requestId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
    });
  }
}
