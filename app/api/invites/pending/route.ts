import { NextResponse } from 'next/server';
import { getPendingInvites } from '@/app/actions/invites';
import { getCurrentUserOrNull } from '@/lib/session';

export async function GET() {
  const user = await getCurrentUserOrNull();
  if (!user) return NextResponse.json([], { status: 200 });
  return NextResponse.json(await getPendingInvites());
}
