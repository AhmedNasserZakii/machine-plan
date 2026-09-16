import { MachineDetailPage } from '@/features/machines/components/machine-detail-page';

type Props = { params: Promise<{ id: string }> };

export default async function MachineDetailRoute({ params }: Props) {
  const { id } = await params;
  return <MachineDetailPage id={id} />;
}
