import { NextResponse } from 'next/server';
import { getPrivateConversations } from '@/app/actions/invites';

export async function GET() {
  try {
    const data = await getPrivateConversations();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
