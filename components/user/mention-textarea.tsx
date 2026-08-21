'use client';

import { useEffect, useRef, useState } from 'react';

import { Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { searchHashtags } from '@/app/actions/hashtags';
import { searchMentionUsers } from '@/app/actions/profile';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user/user-avatar';
import type { HashtagSuggestion, MentionSuggestion } from '@/lib/types';
import { cn } from '@/lib/utils';

// The text immediately before the caret that counts as an in-progress token: a
// sigil ("@" or "#") that begins a word (start of string or preceded by a char
// that's neither a word char nor a sigil — matching lib/mentions.ts) followed
// by the partial handle/tag, anchored to the caret. The capture group is the
// partial being typed.
const MENTION_RE = /(?:^|[^\w@#])@([a-z0-9_]{0,20})$/i;
const HASHTAG_RE = /(?:^|[^\w@#])#([a-z0-9_]{0,50})$/i;

type Kind = 'mention' | 'hashtag';

type ActiveToken = {
  kind: Kind;
  // Partial handle/tag typed after the sigil (may be empty right after typing
  // the sigil).
  query: string;
  // Index of the sigil in the full value.
  start: number;
  // Caret index (end of the partial).
  end: number;
};

// A suggestion row: either a user (for @) or a hashtag with its post count (#).
type Suggestion =
  | { kind: 'mention'; user: MentionSuggestion }
  | { kind: 'hashtag'; tag: HashtagSuggestion };

function suggestionKey(s: Suggestion): string {
  return s.kind === 'mention' ? `@${s.user.id}` : `#${s.tag.tag}`;
}

// Find the mention/hashtag token the caret currently sits inside, if any.
function detectActiveToken(el: HTMLTextAreaElement): ActiveToken | null {
  // Only when it's a plain caret, not a selection range.
  if (el.selectionStart !== el.selectionEnd) return null;
  const end = el.selectionStart;
  const before = el.value.slice(0, end);

  const mention = before.match(MENTION_RE);
  if (mention) {
    const query = mention[1];
    return { kind: 'mention', query, start: end - query.length - 1, end };
  }
  const hashtag = before.match(HASHTAG_RE);
  if (hashtag) {
    const query = hashtag[1];
    return { kind: 'hashtag', query, start: end - query.length - 1, end };
  }
  return null;
}

type Props = Omit<
  React.ComponentProps<typeof Textarea>,
  'value' | 'onChange'
> & {
  value: string;
  onValueChange: (value: string) => void;
};

// A Textarea with @mention and #hashtag autocomplete. Typing "@" + part of a
// username suggests matching users; typing "#" + part of a tag suggests tags
// already used, with how many posts used each. Picking one (click/tap, or
// Enter/Tab on the keyboard-highlighted row) inserts "@username " / "#tag " at
// the caret. Everything else behaves like a normal controlled Textarea.
export function MentionTextarea({ value, onValueChange, ...props }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [token, setToken] = useState<ActiveToken | null>(null);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);

  const open = token !== null && results.length > 0;

  // Recompute the active token from the live DOM caret. Called after any edit
  // or caret move.
  function syncToken() {
    const el = ref.current;
    if (el) setToken(detectActiveToken(el));
  }

  // Query for suggestions whenever the partial changes (debounced), and drop
  // stale responses so fast typing can't flash an old result set.
  useEffect(() => {
    if (!token || token.query.length < 1) {
      // Wait for at least one character after the sigil before listing anything.
      setResults([]);
      return;
    }
    const { kind, query } = token;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const next: Suggestion[] =
          kind === 'mention'
            ? (await searchMentionUsers(query)).map((user) => ({
                kind: 'mention' as const,
                user,
              }))
            : (await searchHashtags(query)).map((tag) => ({
                kind: 'hashtag' as const,
                tag,
              }));
        if (live) {
          setResults(next);
          setActive(0);
        }
      } catch {
        if (live) setResults([]);
      }
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [token?.kind, token?.query, token?.start]);

  function close() {
    setToken(null);
    setResults([]);
    setActive(0);
  }

  function insert(s: Suggestion) {
    const el = ref.current;
    if (!el || !token) return;
    const before = value.slice(0, token.start);
    const after = value.slice(token.end);
    // Avoid doubling the space if the caret already sits before whitespace.
    const trailing = /^\s/.test(after) ? '' : ' ';
    const body = s.kind === 'mention' ? `@${s.user.username}` : `#${s.tag.tag}`;
    const injected = `${body}${trailing}`;
    const next = before + injected + after;
    onValueChange(next);
    close();
    // Restore focus and drop the caret just past the inserted token, after
    // React has committed the new value.
    const caret = before.length + injected.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Let IME composition run without hijacking keys.
    if (e.nativeEvent.isComposing) return;
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insert(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  return (
    <div className='relative'>
      <Textarea
        {...props}
        ref={ref}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          syncToken();
        }}
        onKeyUp={syncToken}
        onClick={syncToken}
        onBlur={close}
        onKeyDown={onKeyDown}
        aria-autocomplete='list'
        aria-expanded={open}
      />

      {open ? (
        <ul
          role='listbox'
          // Keep focus in the textarea so the click doesn't blur-close the list
          // before it fires (and so caret restoration works).
          onMouseDown={(e) => e.preventDefault()}
          className='border-border bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 max-h-56 w-full max-w-xs overflow-auto rounded-lg border p-1 shadow-md'
        >
          {results.map((s, i) => (
            <li key={suggestionKey(s)}>
              <button
                type='button'
                role='option'
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => insert(s)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  i === active
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50',
                )}
              >
                {s.kind === 'mention' ? (
                  <>
                    <UserAvatar
                      name={s.user.name}
                      image={s.user.image}
                      className='size-7 shrink-0'
                    />
                    <span className='flex min-w-0 flex-col leading-tight'>
                      <span className='truncate text-sm font-medium'>
                        {s.user.name}
                      </span>
                      <span className='text-muted-foreground truncate text-xs'>
                        @{s.user.username}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className='bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full'>
                      <Hash className='size-4' aria-hidden />
                    </span>
                    <span className='flex min-w-0 flex-col leading-tight'>
                      <span className='truncate text-sm font-medium'>
                        #{s.tag.tag}
                      </span>
                      <span className='text-muted-foreground truncate text-xs tabular-nums'>
                        {t('common.postCount', { count: s.tag.count })}
                      </span>
                    </span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
