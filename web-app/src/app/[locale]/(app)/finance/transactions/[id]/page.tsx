import { TransactionDetailPage } from '@/features/finance/components/transaction-detail-page';

export default async function TransactionDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TransactionDetailPage id={id} />;
}
