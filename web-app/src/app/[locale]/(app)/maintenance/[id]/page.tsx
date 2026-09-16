import { MaintenanceDetailPage } from '@/features/maintenance/components/maintenance-detail-page';

type Props = { params: Promise<{ id: string }> };

export default async function MaintenanceDetailRoute({ params }: Props) {
  const { id } = await params;
  return <MaintenanceDetailPage id={id} />;
}
