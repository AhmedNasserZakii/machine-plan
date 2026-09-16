import { UserFormPage } from '@/features/users/components';

type Props = { params: Promise<{ id: string }> };

export default async function EditUserRoute({ params }: Props) {
  const { id } = await params;
  return <UserFormPage mode="edit" id={id} />;
}
