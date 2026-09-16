import { RoleDetailPage } from '@/features/roles/components';

type Props = { params: Promise<{ id: string }> };

export default async function RoleDetailRoute({ params }: Props) {
  const { id } = await params;
  return <RoleDetailPage id={id} />;
}
