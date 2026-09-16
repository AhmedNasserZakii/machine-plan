'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ReplaceMachineDialog } from '@/features/maintenance/components/replace-machine-dialog';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { asText } from '../lib/value';
import { isRetiredStatus, isWarehouseStatus, type Machine } from '../model';

type MachineDetailActionsProps = {
  machine: Machine;
  onOpenMaintenance: () => void;
  onPrintSticker: () => void;
};

type ActionSpec = {
  id: string;
  label: string;
  perm: string;
  disabledReason?: string;
  href?: string;
  onClick?: () => void;
};

export function MachineDetailActions({
  machine,
  onOpenMaintenance,
  onPrintSticker,
}: MachineDetailActionsProps) {
  const t = useTranslations();
  const { user, permissions } = useSession();
  const [replaceOpen, setReplaceOpen] = useState(false);
  const status = machine.status;
  const holderId = asText(machine.holder?.id);
  const inCallerCustody = Boolean(
    user &&
      holderId &&
      user.id === holderId &&
      (machine.holder?.type === 'SUPERVISOR' || machine.holder?.type === 'REPRESENTATIVE'),
  );

  const actions: ActionSpec[] = [
    {
      id: 'edit',
      label: t('web.machines.edit'),
      perm: P.machinesUpdate,
      disabledReason: isRetiredStatus(status) ? t('web.machines.blockedRetired') : undefined,
      href: `/machines/${machine.id}/edit`,
    },
    {
      id: 'transfer',
      label: t('web.machines.createTransfer'),
      perm: P.transfersCreate,
      disabledReason:
        status === 'IN_TRANSIT'
          ? t('web.machines.blockedInTransit')
          : !inCallerCustody
            ? t('web.machines.blockedNotInCustody')
            : undefined,
      href: `/transfers/new?machineId=${machine.id}`,
    },
    {
      id: 'maintenance',
      label: t('web.machines.openMaintenance'),
      perm: P.maintenanceCreate,
      disabledReason:
        status === 'UNDER_MAINTENANCE'
          ? t('web.machines.blockedUnderMaintenance')
          : isRetiredStatus(status)
            ? t('web.machines.blockedRetired')
            : undefined,
      onClick: onOpenMaintenance,
    },
    {
      id: 'replace',
      label: t('web.machines.replace'),
      perm: P.maintenanceUpdate,
      disabledReason: isRetiredStatus(status) ? t('web.machines.blockedRetired') : undefined,
      onClick: () => setReplaceOpen(true),
    },
    {
      id: 'decommission',
      label: t('web.machines.decommission'),
      perm: P.machinesDecommission,
      disabledReason: !isWarehouseStatus(status)
        ? t('web.machines.blockedNotInWarehouse')
        : undefined,
      href: `/maintenance/decommissions?machineId=${machine.id}`,
    },
    {
      id: 'print',
      label: t('web.machines.printSticker'),
      perm: P.machinesRead,
      onClick: onPrintSticker,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-sm">
        {actions.map((action) => {
          if (!can(permissions, action.perm)) return null;
          const disabled = Boolean(action.disabledReason);
          const title = action.disabledReason;

          if (action.href && !disabled) {
            return (
              <Link
                key={action.id}
                href={action.href}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
              >
                {action.label}
              </Link>
            );
          }

          return (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              disabled={disabled}
              title={title}
              onClick={disabled ? undefined : action.onClick}
            >
              {action.label}
            </Button>
          );
        })}
      </div>

      <ReplaceMachineDialog
        machineId={machine.id}
        machineSerial={machine.serial}
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
      />
    </>
  );
}
