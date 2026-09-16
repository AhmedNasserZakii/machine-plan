import { MachineFormPage } from '@/features/machines/components/machine-form-page';

type Props = { params: Promise<{ id: string }> };

export default async function MachineEditRoute({ params }: Props) {
  const { id } = await params;
  return <MachineFormPage mode="edit" id={id} />;
}
