import { redirect } from '@/i18n/navigation';

type Props = { params: Promise<{ id: string; locale: string }> };

export default async function MachineTimelineRedirect({ params }: Props) {
  const { id, locale } = await params;
  redirect({ href: `/machines/${id}?tab=timeline`, locale });
}
