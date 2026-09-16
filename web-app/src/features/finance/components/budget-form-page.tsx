'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { PageHeader } from '@/components/feedback/page-header';
import { AppForm } from '@/components/form/app-form';
import { DateField } from '@/components/form/fields/date-field';
import { FieldShell } from '@/components/form/fields/field-shell';
import { MoneyField } from '@/components/form/fields/money-field';
import { NumberField } from '@/components/form/fields/number-field';
import { SelectField } from '@/components/form/fields/select-field';
import { SwitchField } from '@/components/form/fields/switch-field';
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

import { useCategoriesTree, useCreateBudgetMutation, useUpdateBudgetMutation } from '../hooks';
import { todayIsoDate } from '../lib/value';
import {
  type Budget,
  BUDGET_PERIOD_TYPES,
  budgetFormDefaults,
  budgetFormSchema,
  type BudgetFormValues,
} from '../model';
import { CategoryTreePicker } from './category-tree-picker';

type BudgetFormPageProps = {
  mode: 'create' | 'edit';
  budget?: Budget;
};

function periodEndFor(type: BudgetFormValues['periodType'], start: string): string {
  if (!start) return '';
  const [y, m, d] = start.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (type === 'MONTHLY') {
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (type === 'QUARTERLY') {
    date.setUTCMonth(date.getUTCMonth() + 3);
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (type === 'YEARLY') {
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString().slice(0, 10);
}

function PeriodSync() {
  const periodType = useWatch({ name: 'periodType' }) as BudgetFormValues['periodType'];
  const periodStart = useWatch({ name: 'periodStart' }) as string;
  const { setValue } = useFormContext();
  useEffect(() => {
    if (periodType !== 'CUSTOM' && periodStart) {
      setValue('periodEnd', periodEndFor(periodType, periodStart));
    }
  }, [periodType, periodStart, setValue]);
  return null;
}

export function BudgetFormPage({ mode, budget }: BudgetFormPageProps) {
  const t = useTranslations();
  const router = useRouter();
  const { permissions } = useSession();
  const createMutation = useCreateBudgetMutation();
  const updateMutation = useUpdateBudgetMutation(budget?.id ?? '');
  const tree = useCategoriesTree({ kind: 'EXPENSE' });
  const [dateFieldError, setDateFieldError] = useState<string | null>(null);

  const branches = useQuery({
    queryKey: ['branches', 'budget-form'] as const,
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

  const defaults = useMemo<BudgetFormValues>(() => {
    if (!budget) {
      const start = todayIsoDate().slice(0, 8) + '01';
      return {
        ...budgetFormDefaults,
        periodStart: start,
        periodEnd: periodEndFor('MONTHLY', start),
      };
    }
    return {
      categoryId: budget.category.id,
      branchId: budget.branch?.id ?? '',
      periodType: budget.periodType,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
      amount: budget.amount,
      alertThresholdPercent: budget.alertThresholdPercent,
      includeSubcategories: budget.includeSubcategories,
      autoRenew: budget.autoRenew,
    };
  }, [budget]);

  const periodOptions = useMemo(
    () =>
      BUDGET_PERIOD_TYPES.map((value) => ({
        value,
        label: t(`enums.budgetPeriod.${value}` as 'enums.budgetPeriod.MONTHLY'),
      })),
    [t],
  );

  const branchOptions = useMemo(
    () => [
      { value: '', label: t('shared.finance_company_wide') },
      ...(branches.data ?? []).map((row) => ({ value: row.id, label: row.name })),
    ],
    [branches.data, t],
  );

  const onSubmit = async (values: BudgetFormValues) => {
    setDateFieldError(null);
    try {
      if (mode === 'create') {
        const created = await createMutation.mutateAsync({
          categoryId: values.categoryId,
          ...(values.branchId ? { branchId: values.branchId } : {}),
          periodType: values.periodType,
          periodStart: values.periodStart,
          periodEnd: values.periodEnd,
          amount: values.amount,
          alertThresholdPercent: values.alertThresholdPercent,
          includeSubcategories: values.includeSubcategories,
          autoRenew: values.autoRenew,
        });
        toast.success(t('web.finance.budgetSaved'));
        router.push(`/finance/budgets/${created?.id}`);
        return;
      }
      await updateMutation.mutateAsync({
        amount: values.amount,
        alertThresholdPercent: values.alertThresholdPercent,
        includeSubcategories: values.includeSubcategories,
        autoRenew: values.autoRenew,
      });
      toast.success(t('web.finance.budgetSaved'));
      router.push(`/finance/budgets/${budget!.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.OVERLAPPING_BUDGET) {
          setDateFieldError(t('web.finance.overlappingBudget'));
          toast.error(t(`errors.${err.code}` as 'errors.OVERLAPPING_BUDGET'));
          throw err;
        }
        if (err.code === ErrorCode.BUDGET_ON_INCOME_CATEGORY) {
          toast.error(t(`errors.${err.code}` as 'errors.BUDGET_ON_INCOME_CATEGORY'));
          throw err;
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
        title={mode === 'create' ? t('shared.finance_add_budget') : t('shared.finance_edit_budget')}
        subtitle={t('web.finance.budgetFormSubtitle')}
      />

      <AppForm
        schema={budgetFormSchema}
        defaultValues={defaults}
        onSubmit={onSubmit}
        className="mx-auto max-w-2xl space-y-lg"
      >
        {(form) => (
          <>
            {mode === 'create' ? <PeriodSync /> : null}
            <FormSection title={t('shared.finance_expense_category')}>
              {mode === 'create' ? (
                <FieldShell name="categoryId" label={t('shared.finance_expense_category')} required>
                  <Controller
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <CategoryTreePicker
                        id="categoryId"
                        tree={tree.data ?? []}
                        value={field.value}
                        onChange={field.onChange}
                        kind="EXPENSE"
                        leavesOnly
                      />
                    )}
                  />
                </FieldShell>
              ) : (
                <p className="t-body md:col-span-2">
                  {budget?.category.path || budget?.category.name}
                </p>
              )}
              {can(permissions, P.financeReadAll) && mode === 'create' ? (
                <SelectField
                  name="branchId"
                  label={t('shared.finance_branch_optional')}
                  options={branchOptions}
                />
              ) : null}
            </FormSection>

            <FormSection title={t('shared.finance_period')}>
              {mode === 'create' ? (
                <>
                  <SelectField
                    name="periodType"
                    label={t('shared.finance_period')}
                    required
                    options={periodOptions}
                  />
                  <DateField name="periodStart" label={t('web.filters.dateFrom')} required />
                  <DateField name="periodEnd" label={t('web.filters.dateTo')} required />
                  {dateFieldError ? (
                    <p className="t-caption text-danger md:col-span-2" role="alert">
                      {dateFieldError}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="t-body md:col-span-2" dir="ltr">
                  {budget?.periodStart} → {budget?.periodEnd}
                </p>
              )}
              <MoneyField name="amount" label={t('shared.finance_budget_amount')} required />
              <NumberField
                name="alertThresholdPercent"
                label={t('shared.finance_warning_threshold')}
                required
              />
              <SwitchField
                name="includeSubcategories"
                label={t('shared.finance_include_subcategories')}
              />
              <SwitchField name="autoRenew" label={t('shared.finance_auto_renew')} />
            </FormSection>

            <FormActions
              submitLabel={t('shared.finance_save_budget')}
              onCancel={() =>
                router.push(mode === 'edit' && budget ? `/finance/budgets/${budget.id}` : '/finance/budgets')
              }
            />
          </>
        )}
      </AppForm>
    </div>
  );
}
