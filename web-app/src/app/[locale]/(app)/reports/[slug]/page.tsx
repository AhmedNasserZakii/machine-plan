import { ReportViewerPage } from '@/features/reports/components';

export default async function ReportSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ReportViewerPage slug={slug} />;
}
