import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ErrorCode } from 'src/common/constants/error-codes';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AppException } from 'src/common/errors/app.exception';
import { Notification } from '../entities/notification.entity';
import { QueryNotificationsDto } from '../dto/notification.dto';

/**
 * The recipient's own view of his notifications (`18`, Endpoints).
 *
 * Every query here is filtered by `user_id` first, and the id of a row belonging to somebody else
 * is treated as not found rather than forbidden: an ownership check that answered 403 would tell
 * the caller that a notification he cannot see exists.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  async list(userId: string, query: QueryNotificationsDto): Promise<PaginatedResult<Notification>> {
    const qb = this.notifications
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .orderBy('notification.created_at', query.order)
      .skip(query.skip)
      .take(query.take);

    if (query.unreadOnly) qb.andWhere('notification.read_at IS NULL');
    if (query.templateCode?.length) {
      qb.andWhere('notification.template_code IN (:...codes)', { codes: query.templateCode });
    }

    const [items, total] = await qb.getManyAndCount();

    return new PaginatedResult(items, total, query.page, query.limit);
  }

  /** The badge. Hit on every app resume, which is why the unread index is partial. */
  async unreadCount(userId: string): Promise<{ unread: number }> {
    return { unread: await this.notifications.count({ where: { userId, readAt: IsNull() } }) };
  }

  /**
   * Marking an already-read notification read again is a no-op rather than an error: the phone
   * that lost its response and retried is doing the right thing.
   */
  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notifications.findOne({ where: { id, userId } });
    if (!notification) throw AppException.notFound(ErrorCode.NOT_FOUND);

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notifications.update(notification.id, { readAt: notification.readAt });
    }

    return notification;
  }

  /** Bulk-read; returns how many rows actually changed so the client can update its badge. */
  async markAllRead(userId: string, ids?: readonly string[]): Promise<{ updated: number }> {
    const result = await this.notifications.update(
      { userId, readAt: IsNull(), ...(ids?.length ? { id: In([...ids]) } : {}) },
      { readAt: new Date() },
    );

    return { updated: result.affected ?? 0 };
  }
}
