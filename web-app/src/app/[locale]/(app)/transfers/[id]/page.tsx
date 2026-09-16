import { TransferDetailPage } from '@/features/transfers/components/transfer-detail-page';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TransferPage({ params }: PageProps) {
  const { id } = await params;
  return <TransferDetailPage id={id} />;
}
