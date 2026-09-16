import { UserDetailPage } from '@/features/users/components';

type Props = { params: Promise<{ id: string }> };

export default async function UserDetailRoute({ params }: Props) {
  const { id } = await params;
  return <UserDetailPage id={id} />;
}
