import { MerchantDetailPage } from '@/features/merchants/components/merchant-detail-page';

type Props = { params: Promise<{ id: string }> };

export default async function MerchantDetailRoute({ params }: Props) {
  const { id } = await params;
  return <MerchantDetailPage id={id} />;
}
