'use client';

import { use } from 'react';

import { ErrorState } from '@/components/feedback/error-state';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { BudgetFormPage } from '@/features/finance/components/budget-form-page';
import { useBudgetDetail } from '@/features/finance/hooks';

export default function EditBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useBudgetDetail(id);

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return <DetailSkeleton />;
  return <BudgetFormPage mode="edit" budget={query.data} />;
}
