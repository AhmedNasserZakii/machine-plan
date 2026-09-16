'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { SerialText } from '@/components/common/serial-text';
import { Button } from '@/components/ui/button';
import { QrCode, qrSvgDataUrl } from '@/lib/qr/qr-code';

import { asNumber, asText } from '../lib/value';
import type { Machine } from '../model';

type MachineDetailRailProps = {
  machine: Machine;
};

export function MachineDetailRail({ machine }: MachineDetailRailProps) {
  const t = useTranslations();
  const purchasePrice = asNumber(machine.purchase.price);
  const purchaseDate = asText(machine.purchase.date);
  const invoiceNo = asText(machine.purchase.invoiceNo);
  const warrantyStart = asText(machine.warranty.start);
  const warrantyEnd = asText(machine.warranty.end);
  const costVs = asNumber(machine.maintenance.costVsPricePercent);
  const qrPayload = asText(machine.qrPayload) ?? machine.serial;

  const printSticker = () => {
    const qr = qrSvgDataUrl(qrPayload, 220);
    const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="ar"><head><meta charset="utf-8"/><title>${machine.serial}</title>
<style>
  @page{size:80mm 100mm;margin:8mm}
  body{font-family:ui-monospace,monospace;padding:16px;text-align:center;color:black}
  .box{border:2px solid black;padding:20px}
  h1{font-size:20px;letter-spacing:0.04em;margin:12px 0 4px}
  p{margin:4px 0;font-size:12px}
  img{width:180px;height:180px;image-rendering:pixelated}
  @media print{button{display:none}}
</style></head><body>
<div class="box">
  <img src="${qr}" alt="QR ${machine.serial}" />
  <h1 dir="ltr">${machine.serial}</h1>
  <p>${machine.model.name}</p>
</div>
<button onclick="window.print()">${t('web.machines.printSticker')}</button>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-md">
      <section className="space-y-xs">
        <h2 className="t-h3">{t('web.machines.railPurchase')}</h2>
        <dl className="space-y-xs t-body">
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.purchasePrice')}</dt>
            <dd>
              <Money value={purchasePrice} />
            </dd>
          </div>
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.purchaseDate')}</dt>
            <dd>
              <DateText value={purchaseDate} />
            </dd>
          </div>
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.invoiceNo')}</dt>
            <dd className="t-mono" dir="ltr">
              {invoiceNo ?? '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-xs">
        <h2 className="t-h3">{t('web.machines.railWarranty')}</h2>
        <dl className="space-y-xs t-body">
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.warrantyStart')}</dt>
            <dd>
              <DateText value={warrantyStart} />
            </dd>
          </div>
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.warrantyEnd')}</dt>
            <dd>
              <DateText value={warrantyEnd} />
            </dd>
          </div>
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.daysRemaining')}</dt>
            <dd
              className={
                machine.warranty.daysRemaining <= 30 && machine.warranty.daysRemaining > 0
                  ? 'text-warning'
                  : machine.warranty.daysRemaining <= 0
                    ? 'text-danger'
                    : undefined
              }
            >
              {machine.warranty.daysRemaining}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-xs">
        <h2 className="t-h3">{t('web.machines.railCosts')}</h2>
        <dl className="space-y-xs t-body">
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.totalRepairCost')}</dt>
            <dd>
              <Money value={machine.maintenance.totalRepairCost} />
            </dd>
          </div>
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.repairCount')}</dt>
            <dd>{machine.maintenance.repairCount}</dd>
          </div>
          <div className="flex justify-between gap-sm">
            <dt className="text-text-secondary">{t('web.machines.costVsPrice')}</dt>
            <dd>{costVs !== null ? `${costVs}%` : '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-sm print:block" data-slot="machine-sticker">
        <h2 className="t-h3">{t('web.machines.railSticker')}</h2>
        <div className="rounded-md border border-border bg-surface-alt p-md text-center">
          <QrCode value={qrPayload} size={168} title={machine.serial} className="mx-auto" />
          <SerialText value={machine.serial} className="mt-sm t-h2 justify-center" />
          <p className="mt-xs t-caption text-text-secondary">{machine.model.name}</p>
        </div>
        <Button type="button" variant="outline" className="w-full no-print" onClick={printSticker}>
          {t('web.machines.printSticker')}
        </Button>
      </section>
    </div>
  );
}
