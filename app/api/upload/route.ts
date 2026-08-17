import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrNull } from '@/lib/session';
import { newId } from '@/lib/id';

export async function POST(request: NextRequest) {
  const user = await getCurrentUserOrNull();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only images are allowed' },
        { status: 400 },
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'png';
    const blob = await put(
      `chat-images/${user.id}/${newId('img')}.${ext}`,
      file,
      {
        access: 'private',
        addRandomSuffix: true,
      },
    );

    // Private blobs are not publicly accessible; the client references them
    // through /api/file which streams them to authorized viewers.
    return NextResponse.json({
      url: `/api/file?pathname=${encodeURIComponent(blob.pathname)}`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
