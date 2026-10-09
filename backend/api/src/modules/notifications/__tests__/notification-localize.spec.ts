import { Repository } from 'typeorm';
import { NotificationTemplateCode } from 'src/common/enums/notification.enum';
import { Notification } from '../entities/notification.entity';
import { NOTIFICATION_TEMPLATES } from '../notification-templates.catalogue';
import { NotificationTemplatesService } from '../services/notification-templates.service';
import { NotificationsService } from '../services/notifications.service';

/** Resolves straight from the code catalogue, as the real service does with no DB override. */
const templates = {
  resolve: (code: NotificationTemplateCode, locale: 'ar' | 'en') => {
    const definition = NOTIFICATION_TEMPLATES.find((template) => template.code === code)!;
    return Promise.resolve(definition.translations[locale]);
  },
} as unknown as NotificationTemplatesService;

const service = new NotificationsService({} as Repository<Notification>, templates);

function stored(overrides: Partial<Notification>): Notification {
  return {
    templateCode: NotificationTemplateCode.VIOLATION_CHARGED,
    locale: 'ar',
    title: 'تم تحصيل مخالفة',
    body: 'تم تحديد مبلغ 50 جنيه على مخالفة فقد الشاحن',
    data: { amount: '50', violationType: 'فقد الشاحن' },
    ...overrides,
  } as Notification;
}

describe('NotificationsService.localize', () => {
  it('re-words a stored Arabic notification for an English reader', async () => {
    const result = await service.localize(stored({}), 'en');

    expect(result.locale).toBe('en');
    expect(result.title).toBe('A violation was charged');
    expect(result.body).toBe('An amount of EGP 50 was assigned to your فقد الشاحن violation');
  });

  it('returns the row untouched when it is already in the reader’s language', async () => {
    const row = stored({});

    expect(await service.localize(row, 'ar')).toBe(row);
  });

  it('keeps the stored wording when the params no longer fill the template', async () => {
    const row = stored({ data: {} });

    expect(await service.localize(row, 'en')).toBe(row);
  });
});
