'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/feedback/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';

import { machineKeys, submitBulkChunks, useMachineModelsQuery, useMachineTypesQuery } from '../hooks';
import { downloadTextFile, toCsv } from '../lib/value';
import type { CreateMachineDto } from '../model';

const STORAGE_KEY = 'machines.import.columnMap';
const CHUNK = 50;

const FIELD_KEYS = [
  'serial',
  'batterySerial',
  'simSerial',
  'boxSerial',
  'machineModelId',
  'machineModelCode',
  'purchasePrice',
  'purchaseDate',
  'factoryInvoiceNo',
  'warrantyStart',
  'warrantyEnd',
  'hasBox',
  'notes',
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];
type WizardStep = 'upload' | 'map' | 'validate' | 'preview' | 'submit' | 'result';

type ParsedRow = { __row: number; [key: string]: string | number };
type RowIssue = { row: number; field?: string; message: string };
type FailureRow = { row: number; serial: string; code: string; message: string };

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const split = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = split(lines[0]!);
  const rows = lines.slice(1).map((line, index) => {
    const cells = split(line);
    const row: ParsedRow = { __row: index + 2 };
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

function autoMap(headers: string[]): Record<FieldKey, string> {
  const map = {} as Record<FieldKey, string>;
  for (const field of FIELD_KEYS) {
    const hit = headers.find(
      (h) => h.trim().toLowerCase() === field.toLowerCase() || h.trim() === field,
    );
    map[field] = hit ?? '';
  }
  return map;
}

function loadSavedMap(): Partial<Record<FieldKey, string>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<
      Record<FieldKey, string>
    >;
  } catch {
    return {};
  }
}

export function MachineImportWizard() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const typesQuery = useMachineTypesQuery();
  const modelsQuery = useMachineModelsQuery(undefined, { requireType: false });

  const [step, setStep] = useState<WizardStep>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>(
    () => Object.fromEntries(FIELD_KEYS.map((k) => [k, ''])) as Record<FieldKey, string>,
  );
  const [issues, setIssues] = useState<RowIssue[]>([]);
  const [payload, setPayload] = useState<CreateMachineDto[]>([]);
  const [chunkKeys] = useState(() => new Map<number, string>());
  const [succeededChunks] = useState(() => new Set<number>());
  const [progress, setProgress] = useState({ done: 0, total: 0, created: 0 });
  const [failures, setFailures] = useState<FailureRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const modelsById = useMemo(() => {
    const map = new Map<string, { requiresSim: boolean; id: string; code?: string }>();
    for (const model of modelsQuery.data ?? []) {
      map.set(model.id, {
        id: model.id,
        requiresSim: model.machineType.requiresSim,
        code: model.code,
      });
    }
    return map;
  }, [modelsQuery.data]);

  const modelsByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const model of modelsQuery.data ?? []) {
      if (model.code) map.set(model.code.toUpperCase(), model.id);
    }
    return map;
  }, [modelsQuery.data]);

  const downloadTemplate = () => {
    const headerRow = [
      'serial',
      'batterySerial',
      'simSerial',
      'boxSerial',
      'machineModelId',
      'purchasePrice',
      'purchaseDate',
      'factoryInvoiceNo',
      'warrantyStart',
      'warrantyEnd',
      'hasBox',
      'notes',
    ];
    const example =
      locale === 'ar'
        ? [
            'SN-EXAMPLE-001',
            'BT-EXAMPLE-001',
            '8920011234567890123',
            'BX-EXAMPLE-001',
            '{machineModelId}',
            '4200',
            '2025-02-10',
            'INV-100',
            '2025-02-10',
            '2026-02-10',
            'true',
            'دفعة مصنع',
          ]
        : [
            'SN-EXAMPLE-001',
            'BT-EXAMPLE-001',
            '8920011234567890123',
            'BX-EXAMPLE-001',
            '{machineModelId}',
            '4200',
            '2025-02-10',
            'INV-100',
            '2025-02-10',
            '2026-02-10',
            'true',
            'Factory delivery',
          ];
    downloadTextFile('machines-import-template.csv', toCsv([headerRow, example]));
  };

  const onFile = async (file: File) => {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      toast.error(t('web.machines.importXlsxUnsupported'));
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.headers.length) {
      toast.error(t('web.machines.importEmptyFile'));
      return;
    }
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    const saved = loadSavedMap();
    const auto = autoMap(parsed.headers);
    setMapping({ ...auto, ...Object.fromEntries(
      Object.entries(saved).filter(([, v]) => parsed.headers.includes(String(v))),
    ) } as Record<FieldKey, string>);
    setStep('map');
  };

  const cell = (row: ParsedRow, field: FieldKey) => {
    const header = mapping[field];
    if (!header) return '';
    const value = row[header];
    return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  };

  const validate = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
    const nextIssues: RowIssue[] = [];
    const nextPayload: CreateMachineDto[] = [];
    const seenSerial = new Map<string, number>();
    const seenBattery = new Map<string, number>();
    const seenSim = new Map<string, number>();
    const seenBox = new Map<string, number>();

    for (const row of rows) {
      const serial = cell(row, 'serial');
      const batterySerial = cell(row, 'batterySerial');
      const simSerial = cell(row, 'simSerial') || undefined;
      const boxSerial = cell(row, 'boxSerial') || undefined;
      let machineModelId = cell(row, 'machineModelId');
      const modelCode = cell(row, 'machineModelCode');
      if (!machineModelId && modelCode) {
        machineModelId = modelsByCode.get(modelCode.toUpperCase()) ?? '';
      }

      if (!serial) nextIssues.push({ row: row.__row, field: 'serial', message: t('web.form.required') });
      if (!batterySerial)
        nextIssues.push({ row: row.__row, field: 'batterySerial', message: t('web.form.required') });
      if (!machineModelId)
        nextIssues.push({
          row: row.__row,
          field: 'machineModelId',
          message: t('web.machines.importUnknownModel'),
        });

      const model = modelsById.get(machineModelId);
      if (model) {
        if (model.requiresSim && !simSerial) {
          nextIssues.push({
            row: row.__row,
            field: 'simSerial',
            message: t('web.machines.importSimRequired'),
          });
        }
        if (!model.requiresSim && simSerial) {
          nextIssues.push({
            row: row.__row,
            field: 'simSerial',
            message: t('web.machines.importSimForbidden'),
          });
        }
      }

      const checkDup = (value: string | undefined, map: Map<string, number>, field: string) => {
        if (!value) return;
        const first = map.get(value);
        if (first !== undefined) {
          nextIssues.push({
            row: row.__row,
            field,
            message: t('web.machines.importDupInFile', { row: first }),
          });
        } else {
          map.set(value, row.__row);
        }
      };
      checkDup(serial, seenSerial, 'serial');
      checkDup(batterySerial, seenBattery, 'batterySerial');
      checkDup(simSerial, seenSim, 'simSerial');
      checkDup(boxSerial, seenBox, 'boxSerial');

      const purchasePriceRaw = cell(row, 'purchasePrice');
      const purchasePrice = purchasePriceRaw ? Number(purchasePriceRaw) : undefined;
      if (purchasePriceRaw && (!Number.isFinite(purchasePrice) || (purchasePrice ?? 0) <= 0)) {
        nextIssues.push({
          row: row.__row,
          field: 'purchasePrice',
          message: t('web.machines.importBadPrice'),
        });
      }

      const hasBoxRaw = cell(row, 'hasBox').toLowerCase();
      const hasBox = hasBoxRaw === 'true' || hasBoxRaw === '1' || hasBoxRaw === 'yes';

      if (serial && batterySerial && machineModelId) {
        nextPayload.push({
          serial,
          machineModelId,
          battery: { serial: batterySerial },
          hasBox,
          ...(simSerial ? { simSerial } : {}),
          ...(boxSerial ? { boxSerial } : {}),
          ...(purchasePrice !== undefined && Number.isFinite(purchasePrice)
            ? { purchasePrice }
            : {}),
          ...(cell(row, 'purchaseDate') ? { purchaseDate: cell(row, 'purchaseDate') } : {}),
          ...(cell(row, 'factoryInvoiceNo')
            ? { factoryInvoiceNo: cell(row, 'factoryInvoiceNo') }
            : {}),
          ...(cell(row, 'warrantyStart') ? { warrantyStart: cell(row, 'warrantyStart') } : {}),
          ...(cell(row, 'warrantyEnd') ? { warrantyEnd: cell(row, 'warrantyEnd') } : {}),
          ...(cell(row, 'notes') ? { notes: cell(row, 'notes') } : {}),
        });
      }
    }

    setIssues(nextIssues);
    setPayload(nextPayload);
    setStep(nextIssues.length ? 'validate' : 'preview');
  };

  const submit = async () => {
    setSubmitting(true);
    setStep('submit');
    setFailures([]);
    const totalChunks = Math.ceil(payload.length / CHUNK) || 0;
    setProgress({ done: 0, total: totalChunks, created: 0 });

    const result = await submitBulkChunks(payload, {
      chunkKeys,
      succeededChunks,
      onChunkStart: (index, total) => setProgress((p) => ({ ...p, done: index, total })),
      onChunkSuccess: (index, created) =>
        setProgress((p) => ({ ...p, done: index + 1, created: p.created + created })),
      onChunkFailure: (index, error) => {
        const message = error instanceof Error ? error.message : t('web.errors.generic');
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: string }).code)
            : 'ERROR';
        const start = index * CHUNK;
        const chunk = payload.slice(start, start + CHUNK);
        setFailures((prev) => [
          ...prev,
          ...chunk.map((row, offset) => ({
            row: start + offset + 2,
            serial: row.serial,
            code,
            message,
          })),
        ]);
      },
    });

    setProgress((p) => ({ ...p, created: result.created, done: result.totalChunks }));
    setSubmitting(false);
    setStep('result');
    if (result.created > 0) {
      void qc.invalidateQueries({ queryKey: machineKeys.all });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    }
    if (result.failures.length === 0) {
      toast.success(t('web.machines.importAllOk', { count: result.created }));
    } else {
      toast.error(
        t('web.machines.importPartial', {
          created: result.created,
          failed: result.failures.length,
        }),
      );
    }
  };

  const downloadFailures = () => {
    downloadTextFile(
      'machines-import-failures.csv',
      toCsv([
        ['row', 'serial', 'code', 'message'],
        ...failures.map((f) => [String(f.row), f.serial, f.code, f.message]),
      ]),
    );
  };

  const steps: WizardStep[] = ['upload', 'map', 'validate', 'preview', 'submit', 'result'];

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.machines.importTitle')}
        subtitle={t('web.machines.importSubtitle')}
        actions={
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            {t('web.machines.downloadTemplate')}
          </Button>
        }
      />

      <ol className="flex flex-wrap gap-sm t-caption text-text-secondary">
        {steps.map((s) => (
          <li key={s} className={s === step ? 'text-primary' : undefined}>
            {t(`web.machines.importStep.${s}` as 'web.machines.importStep.upload')}
          </li>
        ))}
      </ol>

      {step === 'upload' ? (
        <div
          className="rounded-md border border-dashed border-border bg-surface p-lg text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void onFile(file);
          }}
        >
          <p className="t-body">{t('web.machines.importDrop')}</p>
          <Input
            type="file"
            accept=".csv,text/csv"
            className="mx-auto mt-md max-w-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <p className="mt-sm t-caption text-text-secondary">{t('web.machines.importCsvOnly')}</p>
        </div>
      ) : null}

      {step === 'map' ? (
        <div className="space-y-md">
          <p className="t-body text-text-secondary">
            {t('web.machines.importMapHint', { count: rows.length })}
          </p>
          <div className="grid gap-sm md:grid-cols-2">
            {FIELD_KEYS.map((field) => (
              <div key={field} className="space-y-xs">
                <Label htmlFor={`map-${field}`}>{field}</Label>
                <select
                  id={`map-${field}`}
                  className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
                  value={mapping[field]}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-sm">
            <Button type="button" variant="outline" onClick={() => setStep('upload')}>
              {t('web.common.cancel')}
            </Button>
            <Button type="button" onClick={validate} disabled={!mapping.serial || !mapping.batterySerial}>
              {t('web.machines.importValidate')}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'validate' ? (
        <div className="space-y-md">
          <p className="t-body text-danger">
            {t('web.machines.importIssueCount', { count: issues.length })}
          </p>
          <div className="max-h-80 overflow-auto rounded-md border border-border">
            <table className="w-full text-start">
              <thead className="bg-surface-alt t-caption">
                <tr>
                  <th className="px-md py-sm">{t('web.machines.importRow')}</th>
                  <th className="px-md py-sm">{t('web.machines.importField')}</th>
                  <th className="px-md py-sm">{t('web.machines.importMessage')}</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue, i) => (
                  <tr key={`${issue.row}-${issue.field}-${i}`} className="border-t border-divider">
                    <td className="px-md py-sm t-mono">{issue.row}</td>
                    <td className="px-md py-sm">{issue.field ?? '—'}</td>
                    <td className="px-md py-sm">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-sm">
            <Button type="button" variant="outline" onClick={() => setStep('map')}>
              {t('web.machines.importBackMap')}
            </Button>
            <Button type="button" onClick={validate}>
              {t('web.machines.importRevalidate')}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'preview' ? (
        <div className="space-y-md">
          <p className="t-body">
            {t('web.machines.importPreviewSummary', {
              total: payload.length,
              chunks: Math.ceil(payload.length / CHUNK) || 0,
            })}
          </p>
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-start">
              <thead className="bg-surface-alt t-caption">
                <tr>
                  <th className="px-md py-sm">{t('web.machines.serial')}</th>
                  <th className="px-md py-sm">{t('web.machines.batterySerial')}</th>
                  <th className="px-md py-sm">{t('web.machines.model')}</th>
                </tr>
              </thead>
              <tbody>
                {payload.slice(0, 20).map((row) => (
                  <tr key={row.serial} className="border-t border-divider">
                    <td className="px-md py-sm t-mono" dir="ltr">
                      {row.serial}
                    </td>
                    <td className="px-md py-sm t-mono" dir="ltr">
                      {row.battery.serial}
                    </td>
                    <td className="px-md py-sm t-mono" dir="ltr">
                      {row.machineModelId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-sm">
            <Button type="button" variant="outline" onClick={() => setStep('map')}>
              {t('web.machines.importBackMap')}
            </Button>
            <Button type="button" onClick={() => void submit()}>
              {t('web.machines.importSubmit')}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'submit' ? (
        <div className="space-y-md">
          <p className="t-body">{t('web.machines.importSubmitting')}</p>
          <div className="h-3 overflow-hidden rounded-pill bg-surface-alt">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="t-caption text-text-secondary">
            {t('web.machines.importProgress', {
              done: progress.done,
              total: progress.total,
              created: progress.created,
            })}
          </p>
          {submitting ? null : (
            <Button type="button" onClick={() => void submit()}>
              {t('web.machines.importRetryFailed')}
            </Button>
          )}
        </div>
      ) : null}

      {step === 'result' ? (
        <div className="space-y-md">
          <p className="t-body">
            {t('web.machines.importResultSummary', {
              created: progress.created,
              failed: failures.length,
            })}
          </p>
          {failures.length ? (
            <>
              <div className="max-h-80 overflow-auto rounded-md border border-border">
                <table className="w-full text-start">
                  <thead className="bg-surface-alt t-caption">
                    <tr>
                      <th className="px-md py-sm">{t('web.machines.importRow')}</th>
                      <th className="px-md py-sm">{t('web.machines.serial')}</th>
                      <th className="px-md py-sm">{t('web.machines.importCode')}</th>
                      <th className="px-md py-sm">{t('web.machines.importMessage')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.map((f, i) => (
                      <tr key={`${f.row}-${i}`} className="border-t border-divider">
                        <td className="px-md py-sm t-mono">{f.row}</td>
                        <td className="px-md py-sm t-mono" dir="ltr">
                          {f.serial}
                        </td>
                        <td className="px-md py-sm">{f.code}</td>
                        <td className="px-md py-sm">{f.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-sm">
                <Button type="button" variant="outline" onClick={downloadFailures}>
                  {t('web.machines.importDownloadFailures')}
                </Button>
                <Button type="button" onClick={() => void submit()}>
                  {t('web.machines.importRetryFailed')}
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" onClick={() => router.push('/machines')}>
              {t('web.machines.importBackToList')}
            </Button>
          )}
          <p className="t-caption text-text-secondary">
            <Link href="/machines" className="text-primary hover:underline">
              {t('web.machines.importBackToList')}
            </Link>
          </p>
        </div>
      ) : null}

      {!typesQuery.isLoading && !modelsQuery.data?.length ? (
        <p className="t-caption text-warning">{t('web.machines.importNeedCatalogue')}</p>
      ) : null}
    </div>
  );
}
