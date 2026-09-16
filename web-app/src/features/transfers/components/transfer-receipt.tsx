'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { HolderChip } from '@/components/common/holder-chip';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { TRANSFER_STATUS_TONE } from '@/lib/theme/status-tone';

import { useSignatureMedia } from '../hooks/use-transfers';
import { asString, partyName, type Transfer, type TransferSignature } from '../model/types';

function SignatureImage({
  transferId,
  signature,
}: {
  transferId: string;
  signature: TransferSignature;
}) {
  const t = useTranslations();
  const enabled = signature.method === 'DRAWN_SIGNATURE';
  const query = useSignatureMedia(transferId, signature.id, enabled);

  if (!enabled) {
    return (
      <p className="t-caption text-text-secondary">
        {t('web.transfers.biometricSignature')}
        {asString(signature.deviceModel) ? ` · ${asString(signature.deviceModel)}` : ''}
      </p>
    );
  }

  if (query.isLoading) {
    return <p className="t-caption text-text-secondary">{t('web.common.loading')}</p>;
  }

  if (!query.data?.url) {
    return <p className="t-caption text-text-secondary">—</p>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={query.data.url}
      alt={t('shared.transfer_signature_title')}
      className="max-h-32 rounded-md border border-border bg-surface"
    />
  );
}

type TransferReceiptProps = {
  transfer: Transfer;
};

export function TransferReceipt({ transfer }: TransferReceiptProps) {
  const t = useTranslations();

  return (
    <article data-slot="transfer-receipt" className="print-only space-y-md p-lg">
      <header className="space-y-sm border-b border-divider pb-md">
        <h1 className="t-h2">{t('web.transfers.receiptTitle')}</h1>
        <p className="t-mono t-h3">{transfer.referenceNo}</p>
        <div className="flex flex-wrap items-center gap-sm">
          <StatusChip
            status={transfer.status}
            tone={TRANSFER_STATUS_TONE[transfer.status] ?? 'neutral'}
            label={t(`enums.transferStatus.${transfer.status}` as 'enums.transferStatus.UNKNOWN')}
          />
          <span className="t-body">
            {t(`enums.transferType.${transfer.type}` as 'enums.transferType.UNKNOWN')}
          </span>
        </div>
      </header>

      <section className="grid gap-md sm:grid-cols-2">
        <div>
          <h2 className="t-label text-text-secondary">{t('shared.transfer_from')}</h2>
          <HolderChip type={transfer.from.type} name={partyName(transfer.from)} />
        </div>
        <div>
          <h2 className="t-label text-text-secondary">{t('shared.transfer_to')}</h2>
          <HolderChip type={transfer.to.type} name={partyName(transfer.to)} />
        </div>
        <div>
          <h2 className="t-label text-text-secondary">{t('shared.transfer_occurred_at')}</h2>
          <DateText value={transfer.occurredAt} format="datetime" />
        </div>
        <div>
          <h2 className="t-label text-text-secondary">{t('shared.transfer_confirmed_at')}</h2>
          <DateText
            value={typeof transfer.confirmedAt === 'string' ? transfer.confirmedAt : null}
            format="datetime"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-sm t-h3">{t('shared.transfer_machines_title')}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-divider t-caption">
              <th className="py-xs text-start font-medium">{t('web.machines.serial')}</th>
              <th className="py-xs text-start font-medium">{t('shared.transfer_item_condition')}</th>
              <th className="py-xs text-start font-medium">{t('shared.transfer_item_charger')}</th>
              <th className="py-xs text-start font-medium">{t('shared.transfer_item_box')}</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((item) => (
              <tr key={item.id} className="border-b border-divider">
                <td className="py-sm">
                  <SerialText value={item.machine.serial} />
                </td>
                <td className="py-sm t-caption">
                  {t(
                    `shared.item_condition_${item.condition.toLowerCase()}` as 'shared.item_condition_good',
                  )}
                </td>
                <td className="py-sm t-caption">
                  {item.hasCharger ? t('web.common.yes') : t('web.common.no')}
                </td>
                <td className="py-sm t-caption">
                  {item.hasBox ? t('web.common.yes') : t('web.common.no')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-sm t-h3">{t('shared.transfer_signatures_title')}</h2>
        <div className="grid gap-md sm:grid-cols-2">
          {transfer.signatures.map((signature) => (
            <div key={signature.id} className="space-y-xs rounded-md border border-border p-md">
              <p className="t-label">
                {t('web.transfers.signedBy', {
                  name: asString(signature.userFullName) ?? signature.userId,
                })}
              </p>
              <p className="t-caption text-text-secondary">
                {signature.partyRole} · <DateText value={signature.signedAt} format="datetime" />
              </p>
              <SignatureImage transferId={transfer.id} signature={signature} />
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
