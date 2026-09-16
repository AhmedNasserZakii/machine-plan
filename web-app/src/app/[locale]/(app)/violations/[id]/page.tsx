import { ViolationDetailPage } from '@/features/violations/components/violation-detail-page';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ViolationPage({ params }: PageProps) {
  const { id } = await params;
  return <ViolationDetailPage id={id} />;
}
