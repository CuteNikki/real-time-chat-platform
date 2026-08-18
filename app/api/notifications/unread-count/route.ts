import { NextResponse } from 'next/server';
import { getCurrentUserOrNull } from '@/lib/session';
import { getUnreadCounts } from '@/app/actions/notifications';

export async function GET() {
  const user = await getCurrentUserOrNull();
  if (!user)
    return NextResponse.json({ requests: 0, messages: 0, likes: 0, total: 0 });
  const counts = await getUnreadCounts();
  return NextResponse.json(counts);
}
