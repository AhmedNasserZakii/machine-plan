import { MerchantFormPage } from '@/features/merchants/components/merchant-form-page';

type Props = { params: Promise<{ id: string }> };

export default async function EditMerchantPage({ params }: Props) {
  const { id } = await params;
  return <MerchantFormPage mode="edit" id={id} />;
}
