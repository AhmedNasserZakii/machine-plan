import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/modules/auth/auth.module';
import { Budget } from 'src/modules/finance/entities/budget.entity';
import { FinanceCategory } from 'src/modules/finance/entities/finance-category.entity';
import { FinanceCategoryTranslation } from 'src/modules/finance/entities/finance-category-translation.entity';
import { FinanceModule } from 'src/modules/finance/finance.module';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Merchant } from 'src/modules/merchants/entities/merchant.entity';
import { MerchantSubscription } from 'src/modules/merchants/entities/merchant-subscription.entity';
import { SettingsModule } from 'src/modules/settings/settings.module';
import { Transfer } from 'src/modules/transfers/entities/transfer.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { UserDevice } from 'src/modules/users/entities/user-device.entity';
import { DevicesController } from './devices.controller';
import { Notification } from './entities/notification.entity';
import { NotificationDedupe } from './entities/notification-dedupe.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationTemplateTranslation } from './entities/notification-template-translation.entity';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationSchedulerService } from './services/notification-scheduler.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { NotificationRecipientsService } from './services/notification-recipients.service';
import { NotificationSweepsService } from './services/notification-sweeps.service';
import { NotificationTemplatesService } from './services/notification-templates.service';
import { NotificationsService } from './services/notifications.service';
import { FcmPushTransport } from './services/push/fcm-push.transport';

/**
 * Notifications, wired for both directions of the feature: the recipient's own inbox, and the
 * fan-out every other module calls into.
 *
 * **Global, for the same reason `CacheModule` is.** Seven feature modules raise notifications —
 * transfers, violations, maintenance, replacements, decommissions, merchants and finance — and
 * importing this module into each of them would draw an edge from every one of them to a module
 * that itself imports auth, finance and settings. Those edges are what a cycle is made of, and
 * the dispatcher is infrastructure rather than a feature dependency: nothing here calls back.
 *
 * The four read-only repositories (`Transfer`, `Machine`, `Merchant`, `MerchantSubscription`) and
 * the finance ones belong to the scheduled sweeps, which ask "what has gone stale" across the
 * whole system. Registering them here rather than importing four more modules keeps the arrows
 * pointing one way; nothing in this module writes to any of them.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      NotificationTemplate,
      NotificationTemplateTranslation,
      NotificationDedupe,
      User,
      UserDevice,
      Transfer,
      Machine,
      Merchant,
      MerchantSubscription,
      Budget,
      FinanceCategory,
      FinanceCategoryTranslation,
    ]),
    // `/devices` is the address `18` gives the push-token endpoints; the implementation already
    // exists under `/auth/devices` and is delegated to rather than duplicated.
    AuthModule,
    // The budget sweep re-runs the `16` computation on date passage, which is the one thing it
    // must not reimplement: two answers to "is this budget blown" would eventually disagree.
    FinanceModule,
    SettingsModule,
  ],
  controllers: [NotificationsController, NotificationPreferencesController, DevicesController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationPreferencesService,
    NotificationRecipientsService,
    NotificationTemplatesService,
    NotificationSweepsService,
    NotificationSchedulerService,
    FcmPushTransport,
  ],
  exports: [
    NotificationDispatcherService,
    NotificationRecipientsService,
    NotificationTemplatesService,
    NotificationSweepsService,
    NotificationsService,
  ],
})
export class NotificationsModule {}
