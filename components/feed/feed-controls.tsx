'use client';

import { useEffect, useRef, useState } from 'react';

import { Hash, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { searchHashtags } from '@/app/actions/hashtags';

import { normalizeHashtag } from '@/lib/mentions';
import type { HashtagSuggestion } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const FEED_PATH = '/app/feed';

export type FeedTab = 'for-you' | 'friends';

// Serialize the feed's URL. Browse and search are mutually exclusive: a browse
// URL carries only ?tab, a search URL only ?query/?tags — never both, since
// search is always global (tab-independent).
function buildFeedHref({
  tab,
  query,
  tags,
}: {
  tab?: string;
  query?: string;
  tags?: string[];
}): string {
  const p = new URLSearchParams();
  if (tab === 'friends') p.set('tab', 'friends');
  const q = query?.trim();
  if (q) p.set('query', q);
  if (tags && tags.length > 0) p.set('tags', tags.join(','));
  const s = p.toString();
  return s ? `${FEED_PATH}?${s}` : FEED_PATH;
}

// The in-progress "#partial" tag anchored to the end of the input, if any. Empty
// capture (just "#") is still a match, so the dropdown can open on "#".
const TRAILING_TAG = /(?:^|\s)#([a-zA-Z0-9_]*)$/;

type Props = {
  tab: FeedTab;
  query: string;
  tags: string[];
};

// The feed's tab bar + smart search box. Tabs (For You / Friends) use the app's
// shared Tabs component and navigate by URL. The search box is one "smart" field:
// plain words become ?query=… (debounced), and a typed #tag — committed with
// Space/Enter or picked from the hashtag autocomplete — becomes a removable chip
// driving ?tags=…. Clicking a tab exits search back to browse.
export function FeedControls({ tab, query, tags }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [text, setText] = useState(query);
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [suggests, setSuggests] = useState<HashtagSuggestion[]>([]);
  const [active, setActive] = useState(0);
  // Set right before a tab switch so the debounced search-sync below skips one
  // run and can't fight the browse navigation we're about to push.
  const suppress = useRef(false);

  const tagsKey = tags.join(',');

  // Re-seed local state whenever the URL (server props) changes — e.g. arriving
  // via a #hashtag link, or the browser back button.
  useEffect(() => setText(query), [query]);
  useEffect(() => setLocalTags(tags), [tagsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push local search state into the URL, debounced so typing doesn't fire a
  // navigation per keystroke. Skips when the URL already matches (prevents a
  // loop once the server sends the new props back).
  useEffect(() => {
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    const searching = text.trim().length > 0 || localTags.length > 0;
    const target = searching
      ? buildFeedHref({ query: text, tags: localTags })
      : buildFeedHref({ tab });
    const current =
      query.trim().length > 0 || tags.length > 0
        ? buildFeedHref({ query, tags })
        : buildFeedHref({ tab });
    if (target === current) return;
    const id = setTimeout(() => router.replace(target), 220);
    return () => clearTimeout(id);
  }, [text, localTags, tab, query, tagsKey, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // The trailing #partial and whether the autocomplete should be showing.
  const partial = text.match(TRAILING_TAG)?.[1] ?? null;
  const open = partial !== null && suggests.length > 0;

  // Suggest existing tags for the trailing #partial (debounced, stale-dropped).
  useEffect(() => {
    if (partial === null || partial.length < 1) {
      setSuggests([]);
      return;
    }
    let live = true;
    const id = setTimeout(async () => {
      try {
        const r = await searchHashtags(partial);
        if (live) {
          setSuggests(r);
          setActive(0);
        }
      } catch {
        if (live) setSuggests([]);
      }
    }, 150);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [partial]);

  function selectTab(v: string) {
    if (v !== 'for-you' && v !== 'friends') return;
    // Clicking a tab means "browse" — drop any active search.
    suppress.current = true;
    setText('');
    setLocalTags([]);
    setSuggests([]);
    router.push(buildFeedHref({ tab: v }));
  }

  // Commit a #tag as a chip: add it, strip the trailing token from the text.
  // The debounced effect above then syncs ?tags into the URL.
  function commitTag(raw: string) {
    const tag = normalizeHashtag(raw);
    if (!tag) return;
    setLocalTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setText((prev) => prev.replace(TRAILING_TAG, '').replace(/\s+$/, ''));
    setSuggests([]);
  }

  function removeTag(tag: string) {
    setLocalTags((prev) => prev.filter((t) => t !== tag));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (open && e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % suggests.length);
      return;
    }
    if (open && e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + suggests.length) % suggests.length);
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setSuggests([]);
      return;
    }
    // Space commits the tag the user typed; Enter commits the highlighted
    // suggestion (or the typed one when there's no dropdown).
    if (e.key === ' ') {
      const raw = text.match(TRAILING_TAG)?.[1];
      if (raw && normalizeHashtag(raw)) {
        e.preventDefault();
        commitTag(raw);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = open ? suggests[active]?.tag : text.match(TRAILING_TAG)?.[1];
      if (raw && normalizeHashtag(raw)) commitTag(raw);
      return;
    }
    // Backspace on an empty field peels off the last chip.
    if (e.key === 'Backspace' && text === '' && localTags.length > 0) {
      e.preventDefault();
      removeTag(localTags[localTags.length - 1]);
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList className='w-full max-w-xs'>
          <TabsTrigger value='for-you'>
            {t('app.feed.controls.forYou')}
          </TabsTrigger>
          <TabsTrigger value='friends'>
            {t('app.feed.controls.friends')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className='relative'>
        <div className='border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2.5 py-1 transition-colors focus-within:ring-3'>
          <Search
            className='text-muted-foreground size-4 shrink-0'
            aria-hidden
          />
          {localTags.map((tag) => (
            <Badge key={tag} variant='secondary' className='gap-1 pr-1'>
              #{tag}
              <button
                type='button'
                onClick={() => removeTag(tag)}
                aria-label={t('app.feed.controls.removeTag', { tag })}
                className='hover:bg-foreground/10 -mr-0.5 flex size-4 items-center justify-center rounded-full transition-colors'
              >
                <X className='size-3' aria-hidden />
              </button>
            </Badge>
          ))}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setSuggests([])}
            placeholder={
              localTags.length > 0
                ? t('app.feed.controls.placeholderWithTags')
                : t('app.feed.controls.placeholder')
            }
            aria-label={t('app.feed.controls.searchAria')}
            aria-autocomplete='list'
            aria-expanded={open}
            className='placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent text-sm outline-none'
          />
        </div>

        {open ? (
          <ul
            role='listbox'
            // Keep focus in the input so the click lands before onBlur closes us.
            onMouseDown={(e) => e.preventDefault()}
            className='border-border bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 max-h-56 w-full max-w-xs overflow-auto rounded-lg border p-1 shadow-md'
          >
            {suggests.map((s, i) => (
              <li key={s.tag}>
                <button
                  type='button'
                  role='option'
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commitTag(s.tag)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                    i === active
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50',
                  )}
                >
                  <span className='bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full'>
                    <Hash className='size-4' aria-hidden />
                  </span>
                  <span className='flex min-w-0 flex-col leading-tight'>
                    <span className='truncate text-sm font-medium'>
                      #{s.tag}
                    </span>
                    <span className='text-muted-foreground truncate text-xs tabular-nums'>
                      {t('common.postCount', { count: s.count })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
