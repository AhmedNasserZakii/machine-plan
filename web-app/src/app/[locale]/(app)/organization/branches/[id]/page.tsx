import { BranchDetailPage } from '@/features/organization/components';

type Props = { params: Promise<{ id: string }> };

export default async function BranchDetailRoute({ params }: Props) {
  const { id } = await params;
  return <BranchDetailPage id={id} />;
}
