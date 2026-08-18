'use client';

import {
  isUsernameAvailable,
  updateInterests,
  updateProfile,
} from '@/app/actions/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import { Camera, Check, Loader2, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

type Profile = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio: string | null;
  interests: string[];
};

const MAX_INTERESTS = 10;

function normalizeTag(raw: string) {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 30);
}

export function ProfileSettings({ profile }: { profile: Profile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [image, setImage] = useState<string | null>(profile.image);
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  function addTag(raw: string) {
    const t = normalizeTag(raw);
    if (!t) return;
    if (interests.includes(t)) {
      setTagDraft('');
      return;
    }
    if (interests.length >= MAX_INTERESTS) {
      toast.error(`You can add up to ${MAX_INTERESTS} interests`);
      return;
    }
    setInterests((prev) => [...prev, t]);
    setTagDraft('');
  }

  function removeTag(tag: string) {
    setInterests((prev) => prev.filter((t) => t !== tag));
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === 'Backspace' && !tagDraft && interests.length) {
      removeTag(interests[interests.length - 1]);
    }
  }

  const usernameChanged =
    username.toLowerCase() !== profile.username.toLowerCase();

  async function checkUsername(value: string) {
    setUsername(value);
    setAvailable(null);
    const clean = value.trim().toLowerCase();
    if (!clean || clean === profile.username.toLowerCase()) return;
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setAvailable(false);
      return;
    }
    setChecking(true);
    try {
      const res = await isUsernameAvailable(clean);
      setAvailable(res.available);
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImage(data.url);
    } catch {
      toast.error('Could not upload image');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    // Username is required and always present — never let it be cleared.
    if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())) {
      toast.error(
        'Username must be 3–20 characters: letters, numbers, underscores',
      );
      return;
    }
    if (usernameChanged && available === false) {
      toast.error("That username isn't available");
      return;
    }
    setSaving(true);
    try {
      // Fold any half-typed tag into the set before saving.
      const finalInterests = tagDraft.trim()
        ? [...interests, normalizeTag(tagDraft)]
        : interests;
      await updateProfile({
        name: name.trim(),
        username: username.trim(),
        bio: bio.trim(),
        image,
      });
      await updateInterests(finalInterests);
      setTagDraft('');
      toast.success('Profile updated');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='space-y-6'>
      {/* Avatar */}
      <div className='flex items-center gap-4'>
        <div className='relative'>
          <UserAvatar name={name} image={image} className='size-20 text-2xl' />
          {uploading ? (
            <div className='bg-background/60 absolute inset-0 flex items-center justify-center rounded-full'>
              <Loader2
                className='text-primary size-5 animate-spin'
                aria-hidden
              />
            </div>
          ) : null}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            ref={fileRef}
            type='file'
            accept='image/*'
            onChange={onFile}
            className='sr-only'
            id='avatar'
          />
          <Button
            type='button'
            variant='secondary'
            onClick={() => fileRef.current?.click()}
          >
            <Camera className='size-4' aria-hidden />
            {image ? 'Change' : 'Upload'}
          </Button>
          {image ? (
            <Button
              type='button'
              variant='destructive'
              onClick={() => {
                setImage(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              <Trash2 className='size-4' aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {/* Display name */}
      <div className='space-y-2'>
        <Label htmlFor='name'>Display Name</Label>
        <Input
          id='name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
        />
      </div>

      {/* Username */}
      <div className='space-y-2'>
        <Label htmlFor='username'>Username</Label>
        <div className='relative'>
          <span className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2'>
            @
          </span>
          <Input
            id='username'
            value={username}
            onChange={(e) => checkUsername(e.target.value)}
            className='pl-7'
            maxLength={20}
            autoCapitalize='none'
            spellCheck={false}
          />
          {usernameChanged ? (
            <span className='absolute top-1/2 right-3 -translate-y-1/2'>
              {checking ? (
                <Loader2
                  className='text-muted-foreground size-4 animate-spin'
                  aria-hidden
                />
              ) : available === true ? (
                <Check className='text-primary size-4' aria-hidden />
              ) : available === false ? (
                <X className='text-destructive size-4' aria-hidden />
              ) : null}
            </span>
          ) : null}
        </div>
        <p className='text-muted-foreground text-xs'>
          3&ndash;20 characters. Letters, numbers, and underscores only.
        </p>
      </div>

      {/* Bio */}
      <div className='space-y-2'>
        <Label htmlFor='bio'>Bio</Label>
        <Textarea
          id='bio'
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder='Tell people a bit about yourself'
          className='min-h-22.5 resize-none'
          maxLength={300}
        />
        <p className='text-muted-foreground text-right text-xs'>
          {bio.length}/300
        </p>
      </div>

      {/* Interests */}
      <div className='space-y-2'>
        <Label htmlFor='interests'>Interests</Label>
        <div className='border-input focus-within:border-ring focus-within:ring-ring/50 flex flex-wrap items-center gap-1.5 rounded-lg border bg-transparent p-2 focus-within:ring-3'>
          {interests.map((tag) => (
            <span
              key={tag}
              className='bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium'
            >
              {tag}
              <button
                type='button'
                onClick={() => removeTag(tag)}
                className='text-muted-foreground hover:bg-background hover:text-foreground rounded-full p-0.5'
                aria-label={`Remove ${tag}`}
              >
                <X className='size-3' aria-hidden />
              </button>
            </span>
          ))}
          <input
            id='interests'
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={onTagKeyDown}
            onBlur={() => tagDraft.trim() && addTag(tagDraft)}
            placeholder={
              interests.length ? 'Add another…' : 'e.g. music, hiking, gaming'
            }
            className='placeholder:text-muted-foreground min-w-32 flex-1 bg-transparent px-1.5 py-0.5 text-sm outline-none'
            maxLength={30}
            autoCapitalize='none'
            spellCheck={false}
          />
        </div>
        <p className='text-muted-foreground text-xs'>
          Press Enter or comma to add. Up to {MAX_INTERESTS}. Shared interests
          help us match you.
        </p>
      </div>

      <div className='flex justify-end'>
        <Button onClick={save} disabled={saving || uploading} className='gap-2'>
          {saving ? (
            <Loader2 className='size-4 animate-spin' aria-hidden />
          ) : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}
