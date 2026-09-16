'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { HolderChip } from '@/components/common/holder-chip';
import { SerialText } from '@/components/common/serial-text';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { CardGridSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WebScanner } from '@/features/scanning/components';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { ErrorCode } from '@/lib/api/error-codes';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { uploadMedia } from '@/lib/api/media';
import type { ListMeta } from '@/lib/api/pagination';
import type { Schema } from '@/lib/api/types';
import { useSession } from '@/lib/auth/use-session';
import { useCanMutate } from '@/lib/network/use-online';
import { cn } from '@/lib/utils';

import {
  useCreatableTransferTypes,
  useCreateTransferMutation,
  usePickableMerchants,
  useTransferRecipients,
  useValidateTransfer,
} from '../hooks/use-transfers';
import {
  asString,
  type CreatableTransferType,
  type CreateTransferBody,
  type ItemCondition,
  parseValidationProblems,
} from '../model/types';
import {
  clearWizardState,
  createEmptyWizardState,
  itemHasAccessoryMismatch,
  loadWizardState,
  saveWizardState,
  toTransferItemDto,
  type WizardDraftItem,
  type WizardState,
} from '../model/wizard-state';
import { SignaturePad, type SignaturePadHandle } from './signature-pad';

type MachineRow = Schema<'MachineListItemResponse'>;

function StepDots({ step }: { step: number }) {
  const t = useTranslations();
  const labels = [
    t('shared.transfer_step_type'),
    t('shared.transfer_step_machines'),
    t('web.transfers.stepEvidence'),
    t('shared.transfer_step_review'),
  ];
  return (
    <ol className="mb-lg flex flex-wrap gap-sm">
      {labels.map((label, index) => {
        const n = index + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li
            key={label}
            className={cn(
              'rounded-pill px-md py-xs t-caption',
              active && 'bg-primary text-primary-foreground',
              done && 'bg-success-surface text-success',
              !active && !done && 'bg-neutral-surface text-text-secondary',
            )}
          >
            {n}. {label}
          </li>
        );
      })}
    </ol>
  );
}

export function TransferWizardPage() {
  const t = useTranslations();
  const router = useRouter();
  const canMutate = useCanMutate();
  const { user } = useSession();
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<WizardState>(() =>
    createEmptyWizardState(newIdempotencyKey()),
  );
  const [serialInput, setSerialInput] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [validationProblems, setValidationProblems] = useState<
    ReturnType<typeof parseValidationProblems>
  >([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);
  const [sigEmpty, setSigEmpty] = useState(true);

  const creatable = useCreatableTransferTypes();

  const recipients = useTransferRecipients(
    state.receiverKind === 'USER' || state.receiverKind === 'WAREHOUSE' ? state.type : undefined,
    recipientSearch,
  );
  const merchants = usePickableMerchants(recipientSearch, state.receiverKind === 'MERCHANT');

  const validateMutation = useValidateTransfer();
  const createMutation = useCreateTransferMutation();

  useEffect(() => {
    const saved = loadWizardState();
    if (saved) setState(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveWizardState(state);
  }, [hydrated, state]);

  const patch = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const buildCreateBody = useCallback(
    (signatureMediaId?: string): CreateTransferBody => {
      const body: CreateTransferBody = {
        clientUuid: state.clientUuid,
        type: state.type!,
        occurredAt: new Date().toISOString(),
        items: state.items.map(toTransferItemDto),
        ...(state.toPartyId ? { toPartyId: state.toPartyId } : {}),
        ...(state.notes?.trim() ? { notes: state.notes.trim() } : {}),
      };
      if (signatureMediaId) {
        body.senderSignature = {
          method: 'DRAWN_SIGNATURE',
          signatureMediaId,
        };
      }
      return body;
    },
    [state],
  );

  // Live validate while on machines step
  useEffect(() => {
    if (state.step !== 2 || !state.type || state.items.length === 0) {
      setValidationProblems([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void validateMutation
        .mutateAsync(buildCreateBody())
        .then((result) => {
          setValidationProblems(parseValidationProblems(result.problems ?? []));
        })
        .catch(() => {
          /* ignore transient validate failures */
        });
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on item/type changes
  }, [state.step, state.type, state.items, state.toPartyId, buildCreateBody]);

  const custodyQuery = useQuery({
    queryKey: ['machines', 'custody-picker', user?.id, state.allowedFromStatuses, pickerSearch],
    enabled: pickerOpen && Boolean(user?.id),
    queryFn: async () => {
      const result = await api.get<MachineRow[], ListMeta>(endpoints.machines.list, {
        holderId: user!.id,
        status: state.allowedFromStatuses.length ? state.allowedFromStatuses : undefined,
        search: pickerSearch || undefined,
        limit: 50,
      });
      return result.data ?? [];
    },
  });

  const addMachine = (machine: MachineRow) => {
    if (state.items.some((item) => item.machineId === machine.id)) {
      toast.message(t('shared.transfer_machine_already_added'));
      return;
    }
    if (
      state.allowedFromStatuses.length &&
      !state.allowedFromStatuses.includes(machine.status)
    ) {
      toast.error(t('shared.transfer_machine_not_eligible'));
      return;
    }
    const draft: WizardDraftItem = {
      machineId: machine.id,
      serial: machine.serial,
      modelName: machine.model?.name ?? null,
      batterySerialExpected: machine.battery?.serial ?? null,
      simSerialExpected: asString(machine.simSerial),
      boxSerialExpected: asString(machine.boxSerial),
      hasCharger: true,
      hasBox: machine.hasBox,
      condition: 'GOOD',
      photoMediaIds: [],
      accessoryMismatchAcknowledged: false,
    };
    patch({ items: [...state.items, draft] });
  };

  const addBySerial = async () => {
    const code = serialInput.trim();
    if (!code) return;
    try {
      const result = await api.get<{
        matchedOn: string;
        machine: Schema<'MachineResponse'>;
      }>(endpoints.machines.lookup, { code });
      const machine = result.data.machine;
      addMachine({
        id: machine.id,
        serial: machine.serial,
        simSerial: machine.simSerial,
        boxSerial: machine.boxSerial,
        status: machine.status,
        hasBox: machine.hasBox,
        type: machine.type,
        model: machine.model,
        battery: machine.battery,
        branch: machine.branch,
        holder: machine.holder,
        warranty: machine.warranty,
      });
      setSerialInput('');
    } catch {
      toast.error(t('shared.transfer_machine_not_eligible'));
    }
  };

  const updateItem = (machineId: string, partial: Partial<WizardDraftItem>) => {
    patch({
      items: state.items.map((item) =>
        item.machineId === machineId ? { ...item, ...partial } : item,
      ),
    });
  };

  const removeItem = (machineId: string) => {
    patch({ items: state.items.filter((item) => item.machineId !== machineId) });
  };

  const selectType = (row: CreatableTransferType) => {
    patch({
      type: row.type,
      receiverKind: row.receiverKind,
      selfAttestedType: row.selfAttested,
      allowedFromStatuses: row.allowedFromStatuses,
      toPartyId: row.receiverKind === 'NONE' ? undefined : state.toPartyId,
      recipientLabel: row.receiverKind === 'NONE' ? undefined : state.recipientLabel,
      selfAttestedAck: false,
    });
  };

  const canNextStep1 =
    Boolean(state.type) &&
    (state.receiverKind === 'NONE' || Boolean(state.toPartyId));

  const machinesBlocking = state.items.some((item) => {
    const mismatch = itemHasAccessoryMismatch(item);
    return mismatch && !item.accessoryMismatchAcknowledged;
  });

  const problemByMachine = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const problem of validationProblems) {
      const key = problem.machineId ?? problem.field ?? 'general';
      const label = problem.constraint
        ? t(`errors.${problem.constraint}` as 'errors.INTERNAL_ERROR')
        : t('web.errors.generic');
      const list = map.get(key) ?? [];
      list.push(problem.serial ? `${problem.serial}: ${label}` : label);
      map.set(key, list);
    }
    return map;
  }, [t, validationProblems]);

  const canNextStep2 =
    state.items.length > 0 &&
    !machinesBlocking &&
    (validateMutation.data?.valid !== false || validationProblems.length === 0);

  const needsSignature = state.selfAttestedType;
  const canNextStep3 =
    (!needsSignature || (!sigEmpty && state.selfAttestedAck)) &&
    (!state.selfAttestedType || state.selfAttestedAck);

  const goNext = async () => {
    setFormError(null);
    if (state.step === 1 && canNextStep1) {
      patch({ step: 2 });
      return;
    }
    if (state.step === 2) {
      if (!canNextStep2) return;
      try {
        const result = await validateMutation.mutateAsync(buildCreateBody());
        const problems = parseValidationProblems(result.problems ?? []);
        setValidationProblems(problems);
        if (!result.valid) {
          setFormError(t('web.transfers.fixValidationFailed'));
          return;
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(t(`errors.${err.code}` as 'errors.INTERNAL_ERROR'));
          return;
        }
      }
      patch({ step: 3 });
      return;
    }
    if (state.step === 3 && canNextStep3) {
      // Upload signature when leaving evidence if pad has ink
      if (!padRef.current?.isEmpty()) {
        try {
          setUploadProgress(t('web.transfers.uploadingSignature'));
          const blob = await padRef.current!.toPngBlob();
          if (blob) {
            const file = new File([blob], 'signature.png', { type: 'image/png' });
            const uploaded = await uploadMedia({
              file,
              purpose: 'SIGNATURE',
              idempotencyKey: newIdempotencyKey(),
            });
            patch({ step: 4, signatureMediaId: uploaded.id });
            setUploadProgress(null);
            return;
          }
        } catch {
          setUploadProgress(null);
          setFormError(t('shared.transfer_photo_upload_failed'));
          return;
        }
      }
      if (needsSignature) {
        setFormError(t('shared.transfer_signature_required'));
        return;
      }
      patch({ step: 4 });
    }
  };

  const submit = async () => {
    setFormError(null);
    if (!canMutate) {
      setFormError(t('web.shell.offline'));
      return;
    }
    try {
      const signatureMediaId = state.signatureMediaId;
      if (needsSignature && !signatureMediaId) {
        setFormError(t('shared.transfer_signature_required'));
        return;
      }
      const transfer = await createMutation.mutateAsync(
        buildCreateBody(signatureMediaId),
      );
      clearWizardState();
      toast.success(t('web.transfers.created'));
      router.push(`/transfers/${transfer.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.SIGNATURE_REQUIRED) {
          setFormError(t('errors.SIGNATURE_REQUIRED'));
          patch({ step: 3 });
          return;
        }
        if (err.code === ErrorCode.INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED) {
          setFormError(t('errors.INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED'));
          patch({ step: 1 });
          return;
        }
        if (err.code === ErrorCode.TOO_MANY_PHOTOS) {
          setFormError(t('errors.TOO_MANY_PHOTOS'));
          patch({ step: 3 });
          return;
        }
        setFormError(t(`errors.${err.code}` as 'errors.INTERNAL_ERROR'));
        return;
      }
      setFormError(t('web.errors.generic'));
    }
  };

  const uploadPhoto = async (machineId: string, file: File) => {
    const item = state.items.find((row) => row.machineId === machineId);
    if (!item) return;
    if (item.photoMediaIds.length >= 4) {
      toast.error(t('errors.TOO_MANY_PHOTOS'));
      return;
    }
    try {
      setUploadProgress(t('web.transfers.uploadingPhoto'));
      const uploaded = await uploadMedia({
        file,
        purpose: 'TRANSFER_PHOTO',
        idempotencyKey: newIdempotencyKey(),
        onProgress: (loaded, total) => {
          setUploadProgress(
            t('web.transfers.uploadProgress', {
              percent: Math.round((loaded / total) * 100),
            }),
          );
        },
      });
      updateItem(machineId, { photoMediaIds: [...item.photoMediaIds, uploaded.id] });
      setUploadProgress(null);
    } catch {
      setUploadProgress(null);
      toast.error(t('shared.transfer_photo_upload_failed'));
    }
  };

  if (!hydrated || creatable.isLoading) return <CardGridSkeleton count={2} />;
  if (creatable.error) {
    return <ErrorState error={creatable.error} onRetry={() => void creatable.refetch()} />;
  }

  const recipientOptions =
    state.receiverKind === 'MERCHANT' ? (merchants.data ?? []) : (recipients.data ?? []);

  return (
    <div className="mx-auto max-w-[var(--content-max-width)] space-y-md">
      <PageHeader
        title={t('shared.transfer_create_title')}
        subtitle={t('web.transfers.wizardSubtitle')}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clearWizardState();
              setState(createEmptyWizardState(newIdempotencyKey()));
            }}
          >
            {t('web.transfers.resetWizard')}
          </Button>
        }
      />

      <StepDots step={state.step} />

      {formError ? (
        <p className="rounded-md border border-danger bg-danger-surface p-md t-body text-danger" role="alert">
          {formError}
        </p>
      ) : null}
      {uploadProgress ? (
        <p className="t-caption text-text-secondary" role="status">
          {uploadProgress}
        </p>
      ) : null}

      {state.step === 1 ? (
        <section className="space-y-md">
          <div className="space-y-sm">
            <h2 className="t-h3">{t('shared.transfer_select_type')}</h2>
            {(creatable.data ?? []).length === 0 ? (
              <EmptyState
                title={t('web.transfers.noCreatableTypes')}
                description={t('web.transfers.noCreatableTypesBody')}
              />
            ) : (
              <ul className="grid gap-sm md:grid-cols-2">
                {(creatable.data ?? []).map((row) => (
                  <li key={row.type}>
                    <button
                      type="button"
                      className={cn(
                        'w-full rounded-md border p-md text-start transition-colors',
                        state.type === row.type
                          ? 'border-primary bg-info-surface'
                          : 'border-border bg-surface hover:border-primary',
                      )}
                      onClick={() => selectType(row)}
                    >
                      <p className="t-label">
                        {t(`enums.transferType.${row.type}` as 'enums.transferType.UNKNOWN')}
                      </p>
                      <p className="mt-xs t-caption text-text-secondary">
                        {row.selfAttested
                          ? t('web.transfers.selfAttestedTypeHint')
                          : t('web.transfers.receiverKind', { kind: row.receiverKind })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {state.type && state.receiverKind && state.receiverKind !== 'NONE' ? (
            <div className="space-y-sm">
              <h2 className="t-h3">
                {state.receiverKind === 'WAREHOUSE'
                  ? t('shared.transfer_select_warehouse')
                  : t('shared.transfer_select_recipient')}
              </h2>
              <p className="t-caption text-text-secondary">
                {t('web.transfers.interBranchHint')}
              </p>
              <Input
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                placeholder={t('web.form.searchOptions')}
                dir="auto"
              />
              <ul className="max-h-64 space-y-xs overflow-y-auto rounded-md border border-border">
                {recipientOptions.length === 0 ? (
                  <li className="p-md t-caption text-text-secondary">
                    {t('shared.transfer_no_recipients')}
                  </li>
                ) : (
                  recipientOptions.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full flex-col px-md py-sm text-start hover:bg-neutral-surface',
                          state.toPartyId === row.id && 'bg-info-surface',
                        )}
                        onClick={() =>
                          patch({
                            toPartyId: row.id,
                            recipientLabel: row.name,
                          })
                        }
                      >
                        <span className="t-body">{row.name}</span>
                        {typeof row.subtitle === 'string' && row.subtitle ? (
                          <span className="t-caption text-text-secondary">{row.subtitle}</span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          {state.receiverKind === 'NONE' ? (
            <p className="t-body text-text-secondary">{t('shared.transfer_no_recipient_needed')}</p>
          ) : null}
        </section>
      ) : null}

      {state.step === 2 ? (
        <section className="space-y-md">
          <div className="flex flex-wrap gap-sm">
            <Input
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              placeholder={t('shared.transfer_scan_to_add')}
              className="t-mono max-w-xs"
              dir="ltr"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addBySerial();
                }
              }}
            />
            <Button type="button" onClick={() => void addBySerial()}>
              {t('shared.transfer_add_machines')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPickerOpen((v) => !v)}>
              {t('shared.transfer_pick_from_list')}
            </Button>
          </div>
          <WebScanner
            continuous
            onMatch={(result) => {
              const machine = result.machine;
              addMachine({
                id: machine.id,
                serial: machine.serial,
                simSerial: machine.simSerial,
                boxSerial: machine.boxSerial,
                status: machine.status,
                hasBox: machine.hasBox,
                type: machine.type,
                model: machine.model,
                battery: machine.battery,
                branch: machine.branch,
                holder: machine.holder,
                warranty: machine.warranty,
              });
              toast.message(
                t('web.scanning.matchedOn', {
                  field: t(
                    `web.machines.matchedOn.${result.matchedOn}` as 'web.machines.matchedOn.MACHINE',
                  ),
                }),
              );
            }}
          />

          {pickerOpen ? (
            <div className="space-y-sm rounded-md border border-border p-md">
              <Input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={t('shared.transfer_picker_search_hint')}
                dir="ltr"
                className="t-mono"
              />
              {custodyQuery.isLoading ? (
                <p className="t-caption">{t('web.common.loading')}</p>
              ) : (custodyQuery.data ?? []).length === 0 ? (
                <p className="t-caption text-text-secondary">{t('shared.transfer_picker_empty')}</p>
              ) : (
                <ul className="max-h-56 space-y-xs overflow-y-auto">
                  {(custodyQuery.data ?? []).map((machine) => {
                    const added = state.items.some((item) => item.machineId === machine.id);
                    const eligible =
                      !state.allowedFromStatuses.length ||
                      state.allowedFromStatuses.includes(machine.status);
                    return (
                      <li key={machine.id} className="flex items-center justify-between gap-sm">
                        <div>
                          <SerialText value={machine.serial} />
                          <p className="t-caption text-text-secondary">
                            {t(`enums.machineStatus.${machine.status}` as 'enums.machineStatus.UNKNOWN')}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={added || !eligible}
                          onClick={() => addMachine(machine)}
                        >
                          {added
                            ? t('shared.transfer_machine_already_added')
                            : t('shared.transfer_add_machines')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {state.items.length === 0 ? (
            <EmptyState
              title={t('shared.transfer_no_machines_yet')}
              description={t('web.transfers.addMachinesHint')}
            />
          ) : (
            <ul className="space-y-md">
              {state.items.map((item) => {
                const mismatch = itemHasAccessoryMismatch(item);
                const problems = [
                  ...(problemByMachine.get(item.machineId) ?? []),
                  ...(problemByMachine.get(`items`) ?? []),
                ];
                return (
                  <li key={item.machineId} className="space-y-sm rounded-md border border-border p-md">
                    <div className="flex flex-wrap items-start justify-between gap-sm">
                      <div>
                        <SerialText value={item.serial} />
                        <p className="t-caption text-text-secondary">{item.modelName ?? '—'}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(item.machineId)}
                      >
                        {t('web.common.close')}
                      </Button>
                    </div>

                    <div className="grid gap-sm md:grid-cols-3">
                      <div>
                        <Label>{t('shared.transfer_scan_battery')}</Label>
                        <Input
                          className="t-mono"
                          dir="ltr"
                          value={item.batterySerialScanned ?? ''}
                          onChange={(e) =>
                            updateItem(item.machineId, {
                              batterySerialScanned: e.target.value,
                              accessoryMismatchAcknowledged: false,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>{t('web.transfers.sim')}</Label>
                        <Input
                          className="t-mono"
                          dir="ltr"
                          value={item.simSerialScanned ?? ''}
                          onChange={(e) =>
                            updateItem(item.machineId, {
                              simSerialScanned: e.target.value,
                              accessoryMismatchAcknowledged: false,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>{t('web.transfers.boxSerial')}</Label>
                        <Input
                          className="t-mono"
                          dir="ltr"
                          value={item.boxSerialScanned ?? ''}
                          onChange={(e) =>
                            updateItem(item.machineId, {
                              boxSerialScanned: e.target.value,
                              accessoryMismatchAcknowledged: false,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-md">
                      <label className="inline-flex items-center gap-sm t-caption">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={item.hasCharger}
                          onChange={(e) =>
                            updateItem(item.machineId, { hasCharger: e.target.checked })
                          }
                        />
                        {t('shared.transfer_item_charger')}
                      </label>
                      <label className="inline-flex items-center gap-sm t-caption">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={item.hasBox}
                          onChange={(e) =>
                            updateItem(item.machineId, { hasBox: e.target.checked })
                          }
                        />
                        {t('shared.transfer_item_box')}
                      </label>
                      <select
                        className="h-8 rounded-lg border border-border bg-surface px-sm t-caption"
                        value={item.condition}
                        onChange={(e) =>
                          updateItem(item.machineId, {
                            condition: e.target.value as ItemCondition,
                          })
                        }
                      >
                        {(['GOOD', 'DAMAGED', 'NOT_WORKING'] as const).map((value) => (
                          <option key={value} value={value}>
                            {t(
                              `shared.item_condition_${value.toLowerCase()}` as 'shared.item_condition_good',
                            )}
                          </option>
                        ))}
                      </select>
                    </div>

                    {mismatch ? (
                      <label className="flex items-start gap-sm rounded-md border border-warning bg-warning-surface p-sm t-caption">
                        <input
                          type="checkbox"
                          className="mt-xs size-4 accent-warning"
                          checked={item.accessoryMismatchAcknowledged}
                          onChange={(e) =>
                            updateItem(item.machineId, {
                              accessoryMismatchAcknowledged: e.target.checked,
                            })
                          }
                        />
                        <span>{t('web.transfers.accessoryMismatchAck')}</span>
                      </label>
                    ) : null}

                    {problems.length > 0 ? (
                      <ul className="space-y-xs">
                        {problems.map((msg) => (
                          <li key={msg} className="t-caption text-danger">
                            {msg}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {(problemByMachine.get('general') ?? []).map((msg) => (
            <p key={msg} className="t-caption text-danger">
              {msg}
            </p>
          ))}
        </section>
      ) : null}

      {state.step === 3 ? (
        <section className="space-y-lg">
          <div className="space-y-md">
            <h2 className="t-h3">{t('shared.transfer_item_photos')}</h2>
            {state.items.map((item) => (
              <div key={item.machineId} className="rounded-md border border-border p-md">
                <SerialText value={item.serial} />
                <div className="mt-sm flex flex-wrap gap-sm">
                  {item.photoMediaIds.map((mediaId) => (
                    <div
                      key={mediaId}
                      className="flex size-16 items-center justify-center rounded-md border border-border bg-neutral-surface t-caption"
                    >
                      ✓
                      <button
                        type="button"
                        className="ms-xs text-danger"
                        onClick={() =>
                          updateItem(item.machineId, {
                            photoMediaIds: item.photoMediaIds.filter((id) => id !== mediaId),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-sm t-caption hover:bg-neutral-surface">
                    {t('shared.transfer_add_photo')}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadPhoto(item.machineId, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-sm">
            <h2 className="t-h3">{t('shared.transfer_signature_title')}</h2>
            <SignaturePad
              ref={padRef}
              onEmptyChange={setSigEmpty}
              clearLabel={t('shared.transfer_signature_clear')}
              undoLabel={t('shared.transfer_signature_undo')}
              hintLabel={t('shared.transfer_signature_hint')}
            />
          </div>

          {state.selfAttestedType ? (
            <label className="flex items-start gap-sm rounded-md border border-border p-md">
              <input
                type="checkbox"
                className="mt-xs size-4 accent-primary"
                checked={state.selfAttestedAck}
                onChange={(e) => patch({ selfAttestedAck: e.target.checked })}
              />
              <span className="t-body">
                <span className="t-label block">{t('web.transfers.selfAttestedLabel')}</span>
                <span className="t-caption text-text-secondary">
                  {t('web.transfers.selfAttestedConsequence')}
                </span>
              </span>
            </label>
          ) : null}

          <div>
            <Label htmlFor="transfer-notes">{t('shared.transfer_notes')}</Label>
            <Textarea
              id="transfer-notes"
              value={state.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value })}
              dir="auto"
              rows={3}
            />
          </div>
        </section>
      ) : null}

      {state.step === 4 ? (
        <section className="space-y-md">
          <h2 className="t-h3">{t('shared.transfer_review_title')}</h2>
          <dl className="grid gap-md sm:grid-cols-2">
            <div>
              <dt className="t-caption text-text-secondary">{t('shared.transfer_select_type')}</dt>
              <dd className="t-body">
                {state.type
                  ? t(`enums.transferType.${state.type}` as 'enums.transferType.UNKNOWN')
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('shared.transfer_to')}</dt>
              <dd className="t-body">
                {state.recipientLabel ??
                  (state.receiverKind === 'NONE'
                    ? t('shared.transfer_no_recipient_needed')
                    : '—')}
              </dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('shared.transfer_signer')}</dt>
              <dd className="t-body">{user?.fullName ?? '—'}</dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('shared.transfer_machines_title')}</dt>
              <dd className="t-body">{state.items.length}</dd>
            </div>
          </dl>
          <ul className="divide-y divide-border rounded-md border border-border">
            {state.items.map((item) => (
              <li key={item.machineId} className="flex flex-wrap items-center justify-between gap-sm p-md">
                <SerialText value={item.serial} />
                <HolderChip
                  type="MACHINE"
                  name={
                    itemHasAccessoryMismatch(item)
                      ? t('shared.transfer_item_battery_mismatch')
                      : t(
                          `shared.item_condition_${item.condition.toLowerCase()}` as 'shared.item_condition_good',
                        )
                  }
                />
              </li>
            ))}
          </ul>
          {state.selfAttestedType ? (
            <p className="t-caption text-warning">{t('web.transfers.selfAttestedReview')}</p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-sm border-t border-divider pt-md">
        <Button
          type="button"
          variant="outline"
          disabled={state.step === 1 || createMutation.isPending}
          onClick={() => patch({ step: (state.step - 1) as WizardState['step'] })}
        >
          {t('web.transfers.back')}
        </Button>
        <div className="flex flex-wrap gap-sm">
          {state.step < 4 ? (
            <Button
              type="button"
              disabled={
                (state.step === 1 && !canNextStep1) ||
                (state.step === 2 && (!canNextStep2 || validateMutation.isPending)) ||
                (state.step === 3 && !canNextStep3) ||
                !canMutate
              }
              onClick={() => void goNext()}
            >
              {t('web.transfers.next')}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={createMutation.isPending || !canMutate}
              onClick={() => void submit()}
            >
              {createMutation.isPending ? t('web.form.submitting') : t('web.transfers.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
