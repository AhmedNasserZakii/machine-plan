import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { ReportFormat, ReportJobStatus, ReportKey } from 'src/common/enums/report.enum';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * The one row a report is allowed to write (`17`, rule 1).
 *
 * A non-JSON export leaves the request thread, so the caller needs something to poll. The job
 * carries the filters it was created with as well as the file it produced: an xlsx on somebody's
 * desk has to be self-describing, and the header it prints is read back from here.
 *
 * `row_count` is stored rather than derived so the file and the report it came from can be
 * compared without opening the file.
 */
@Entity('report_jobs')
@Index('idx_report_jobs_user_created', ['requestedByUserId', 'createdAt'])
@Index('idx_report_jobs_status', ['status'])
@Index('idx_report_jobs_expires', ['expiresAt'])
export class ReportJob extends BaseEntity {
  @Column({ name: 'report_key', type: 'varchar', length: 40 })
  reportKey: ReportKey;

  @Column({ type: 'varchar', length: 10 })
  format: ReportFormat;

  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requestedByUserId: string;

  /** The exact query the report ran with, including the resolved branch scope. */
  @Column({ type: 'jsonb' })
  filters: Record<string, unknown>;

  @Column({ type: 'varchar', length: 5 })
  locale: string;

  @Column({ type: 'varchar', length: 20, default: ReportJobStatus.QUEUED })
  status: ReportJobStatus;

  @Column({ name: 'row_count', type: 'int', nullable: true })
  rowCount: number | null;

  /** Storage key of the produced file, `null` until the job is `READY`. */
  @Column({ name: 'storage_key', type: 'text', nullable: true })
  storageKey: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  filename: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType: string | null;

  @Column({ name: 'size_bytes', type: 'int', nullable: true })
  sizeBytes: number | null;

  /** A stable `ErrorCode`, so a failed export tells the client the same thing an endpoint would. */
  @Column({ name: 'error_code', type: 'varchar', length: 60, nullable: true })
  errorCode: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy: User;
}
