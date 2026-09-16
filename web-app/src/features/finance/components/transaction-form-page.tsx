'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { PageHeader } from '@/components/feedback/page-header';
import { AppForm } from '@/components/form/app-form';
import { DateField } from '@/components/form/fields/date-field';
import { FieldShell } from '@/components/form/fields/field-shell';
import { MoneyField } from '@/components/form/fields/money-field';
import { SelectField } from '@/components/form/fields/select-field';
import { TextareaField } from '@/components/form/fields/textarea-field';
import { FormActions } from '@/components/form/form-actions';
import { FormSection } from '@/components/form/form-section';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { ErrorCode } from '@/lib/api/error-codes';
import type { ListMeta } from '@/lib/api/pagination';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import {
  useCategoriesTree,
  useCreateTransactionMutation,
  usePaymentMethods,
  useSuppliers,
  useUpdateTransactionMutation,
} from '../hooks';
import { minAllowedTransactionDate } from '../lib/period';
import { todayIsoDate } from '../lib/value';
import {
  FINANCE_BACKDATE_LIMIT_DAYS,
  type FinanceTransaction,
  transactionFormDefaults,
  transactionFormSchema,
  type TransactionFormValues,
} from '../model';
import { CategoryTreePicker } from './category-tree-picker';

type TransactionFormPageProps = {
  mode: 'create' | 'edit';
  transaction?: FinanceTransaction;
};

function KindSync({ onKind }: { onKind: (kind: 'EXPENSE' | 'INCOME') => void }) {
  const kind = useWatch({ name: 'kind' }) as 'EXPENSE' | 'INCOME';
  useEffect(() => {
    onKind(kind);
  }, [kind, onKind]);
  return null;
}

export function TransactionFormPage({ mode, transaction }: TransactionFormPageProps) {
  const t = useTranslations();
  const router = useRouter();
  const { permissions } = useSession();
  const createMutation = useCreateTransactionMutation();
  const updateMutation = useUpdateTransactionMutation(transaction?.id ?? '');
  const [kind, setKind] = useState<'EXPENSE' | 'INCOME'>(transaction?.kind ?? 'EXPENSE');

  const tree = useCategoriesTree({ kind });
  const paymentMethods = usePaymentMethods();
  const suppliers = useSuppliers('', true);
  const branches = useQuery({
    queryKey: ['branches', 'finance-form'] as const,
    queryFn: async () => {
      const result = await api.get<Array<{ id: string; name: string }>, ListMeta>(
        endpoints.branches.list,
        { limit: 100 },
      );
      return result.data ?? [];
    },
    enabled: can(permissions, P.financeReadAll),
    staleTime: 5 * 60_000,
  });

  const minDate = minAllowedTransactionDate(FINANCE_BACKDATE_LIMIT_DAYS);
  const maxDate = todayIsoDate();

  const defaults = useMemo<TransactionFormValues>(() => {
    if (!transaction) {
      return {
        ...transactionFormDefaults,
        kind: 'EXPENSE',
        transactionDate: todayIsoDate(),
      };
    }
    return {
      kind: transaction.kind,
      amount: transaction.amount,
      categoryId: transaction.category.id,
      transactionDate: transaction.transactionDate,
      paymentMethodId: transaction.paymentMethod.id,
      branchId: transaction.branch?.id ?? '',
      supplierId: transaction.supplier?.id ?? '',
      notes: typeof transaction.notes === 'string' ? transaction.notes : '',
    };
  }, [transaction]);

  const paymentOptions = useMemo(
    () => (paymentMethods.data ?? []).map((row) => ({ value: row.id, label: row.name })),
    [paymentMethods.data],
  );

  const supplierOptions = useMemo(
    () => [
      { value: '', label: t('shared.finance_none') },
      ...(suppliers.data ?? []).map((row) => ({ value: row.id, label: row.name })),
    ],
    [suppliers.data, t],
  );

  const branchOptions = useMemo(
    () => [
      { value: '', label: t('shared.finance_company_wide') },
      ...(branches.data ?? []).map((row) => ({ value: row.id, label: row.name })),
    ],
    [branches.data, t],
  );

  const onSubmit = async (values: TransactionFormValues) => {
    const body = {
      kind: values.kind,
      amount: values.amount,
      categoryId: values.categoryId,
      transactionDate: values.transactionDate,
      paymentMethodId: values.paymentMethodId,
      ...(values.branchId ? { branchId: values.branchId } : {}),
      ...(values.supplierId ? { supplierId: values.supplierId } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
    };

    try {
      if (mode === 'create') {
        const created = await createMutation.mutateAsync(body);
        toast.success(t('shared.finance_transaction_saved'));
        router.push(`/finance/transactions/${created?.id}`);
        return;
      }
      await updateMutation.mutateAsync({
        amount: body.amount,
        categoryId: body.categoryId,
        transactionDate: body.transactionDate,
        paymentMethodId: body.paymentMethodId,
        supplierId: values.supplierId || null,
        notes: values.notes || null,
      });
      toast.success(t('shared.finance_transaction_saved'));
      router.push(`/finance/transactions/${transaction!.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.CATEGORY_KIND_MISMATCH) {
          void tree.refetch();
        }
        toast.error(t(`errors.${err.code}` as 'errors.INTERNAL_ERROR'));
        throw err;
      }
      toast.error(t('web.errors.generic'));
      throw err;
    }
  };

  return (
    <div className="space-y-md">
      <PageHeader
        title={
          mode === 'create'
            ? t('shared.finance_add_transaction')
            : t('shared.finance_edit_transaction')
        }
        subtitle={t('web.finance.formSubtitle', { days: FINANCE_BACKDATE_LIMIT_DAYS })}
      />

      <AppForm
        schema={transactionFormSchema}
        defaultValues={defaults}
        onSubmit={onSubmit}
        className="mx-auto max-w-2xl space-y-lg"
      >
        {(form) => (
          <>
            <KindSync
              onKind={(next) => {
                if (next !== kind) {
                  setKind(next);
                  form.setValue('categoryId', '');
                }
              }}
            />
            <FormSection title={t('shared.finance_kind')}>
              <SelectField
                name="kind"
                label={t('shared.finance_kind')}
                required
                options={[
                  { value: 'EXPENSE', label: t('shared.finance_expense') },
                  { value: 'INCOME', label: t('shared.finance_income') },
                ]}
              />
            </FormSection>

            <FormSection title={t('shared.finance_category')}>
              <FieldShell name="categoryId" label={t('shared.finance_category')} required>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <CategoryTreePicker
                      id="categoryId"
                      tree={tree.data ?? []}
                      value={field.value}
                      onChange={field.onChange}
                      kind={kind}
                      leavesOnly
                    />
                  )}
                />
              </FieldShell>
            </FormSection>

            <FormSection title={t('shared.finance_amount')}>
              <MoneyField name="amount" label={t('shared.finance_amount')} required />
              <DateField
                name="transactionDate"
                label={t('shared.finance_transaction_date')}
                required
                minDate={minDate}
                maxDate={maxDate}
              />
              <p className="t-caption text-text-secondary md:col-span-2">
                {t('web.finance.dateHint', { min: minDate, max: maxDate })}
              </p>
              <SelectField
                name="paymentMethodId"
                label={t('shared.finance_payment_method')}
                required
                options={paymentOptions}
                searchable
              />
              {can(permissions, P.financeReadAll) ? (
                <SelectField
                  name="branchId"
                  label={t('shared.finance_branch_optional')}
                  options={branchOptions}
                />
              ) : null}
              <SelectField
                name="supplierId"
                label={t('shared.finance_supplier_optional')}
                options={supplierOptions}
                searchable
              />
              <TextareaField name="notes" label={t('shared.finance_notes_optional')} />
            </FormSection>

            <FormActions
              submitLabel={t('shared.finance_save_transaction')}
              onCancel={() =>
                router.push(
                  mode === 'edit' && transaction
                    ? `/finance/transactions/${transaction.id}`
                    : '/finance/transactions',
                )
              }
            />
          </>
        )}
      </AppForm>
    </div>
  );
}
