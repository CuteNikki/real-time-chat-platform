'use client';

import { createPost } from '@/app/actions/posts';
import { Button } from '@/components/ui/button';
import { MentionTextarea } from '@/components/user/mention-textarea';
import { ImagePlus, Loader2, Loader2Icon, SendIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

export function PostComposer({
  userName,
  userImage,
}: {
  userName: string;
  userImage: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setUploadedUrl(data.url);
    } catch {
      toast.error('Could not upload image');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setPreview(null);
    setUploadedUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit() {
    // A post needs an image or some text.
    if (!uploadedUrl && !caption.trim()) {
      toast.error('Add a photo or write something');
      return;
    }
    setPosting(true);
    try {
      await createPost({
        imageUrl: uploadedUrl ?? undefined,
        caption: caption.trim() || undefined,
      });
      setCaption('');
      clearImage();
      toast.success('Posted!');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className='border-border bg-card rounded-2xl border p-4'>
      <div className='flex gap-3'>
        <div className='min-w-0 flex-1 space-y-3'>
          <MentionTextarea
            value={caption}
            onValueChange={setCaption}
            placeholder='Write a caption...'
            className='block min-h-15 w-full resize-none rounded-none border-none bg-transparent! p-0 text-base leading-relaxed wrap-break-word whitespace-pre-wrap shadow-none focus-visible:ring-0 md:text-base'
            maxLength={500}
          />

          {preview ? (
            <div className='border-border relative w-full overflow-hidden rounded-lg border'>
              <img
                src={preview || '/placeholder.svg'}
                alt='Selected preview'
                className='max-h-96 w-full object-cover'
              />
              {uploading ? (
                <div className='bg-background/60 absolute inset-0 flex items-center justify-center'>
                  <Loader2Icon
                    className='text-primary size-6 shrink-0 animate-spin'
                    aria-hidden
                  />
                </div>
              ) : null}
              <Button
                variant='secondary'
                onClick={clearImage}
                size='icon-xs'
                className='absolute top-2 right-2'
                aria-label='Remove image'
              >
                <X className='size-4' aria-hidden />
              </Button>
            </div>
          ) : null}

          <div className='flex items-center justify-between'>
            <input
              ref={fileRef}
              type='file'
              accept='image/*'
              onChange={onFile}
              className='sr-only'
              id='post-image'
            />
            <Button
              type='button'
              variant='ghost'
              className='text-primary'
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className='shrink-0' aria-hidden />
              Photo
            </Button>
            <Button
              type='button'
              onClick={submit}
              disabled={
                posting || uploading || (!uploadedUrl && !caption.trim())
              }
            >
              {posting ? (
                <>
                  <Loader2 className='shrink-0 animate-spin' aria-hidden />
                  Posting...
                </>
              ) : (
                <>
                  <SendIcon className='shrink-0' aria-hidden />
                  Post
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
