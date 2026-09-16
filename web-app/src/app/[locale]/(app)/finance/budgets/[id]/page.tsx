import { BudgetDetailPage } from '@/features/finance/components/budget-detail-page';

export default async function BudgetDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BudgetDetailPage id={id} />;
}
