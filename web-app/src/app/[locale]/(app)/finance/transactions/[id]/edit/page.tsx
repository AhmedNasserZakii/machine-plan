'use client';

import { use } from 'react';

import { ErrorState } from '@/components/feedback/error-state';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { TransactionFormPage } from '@/features/finance/components/transaction-form-page';
import { useTransactionDetail } from '@/features/finance/hooks';

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useTransactionDetail(id);

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return <DetailSkeleton />;
  if (!query.data.isEditable) {
    return <ErrorState error={new Error('Not editable')} />;
  }
  return <TransactionFormPage mode="edit" transaction={query.data} />;
}
