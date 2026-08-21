'use client';

import { useCallback, useRef, useState } from 'react';

// Tracks whether a scroll container overflows and where it's currently parked,
// so callers can show a top/bottom edge fade only when there's hidden content
// in that direction. Attach `ref` to the scrollable element and `check` to its
// onScroll handler; call `check()` again after the content changes (e.g. new
// items) so the flags stay in sync when the scroll position hasn't moved.
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [scrollable, setScrollable] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setScrollable(el.scrollHeight > el.clientHeight);
    setAtTop(el.scrollTop <= 10);
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight <= 10);
  }, []);

  return { ref, scrollable, atTop, atBottom, check };
}
