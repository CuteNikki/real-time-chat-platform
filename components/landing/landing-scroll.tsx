'use client';

import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

// The landing page scrolls inside this container (not the window) so its
// scrollbar renders *under* the fixed header — matching the app shell — instead
// of the browser painting the window scrollbar on top of the opaque navbar.
// The Hero's scroll-driven exit reads this same container via useScroll, so the
// ref is shared through context rather than threaded prop-by-prop.
const LandingScrollContext = createContext<RefObject<HTMLElement | null> | null>(
  null,
);

export function useLandingScrollContainer() {
  return useContext(LandingScrollContext);
}

export function LandingScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  return (
    <LandingScrollContext.Provider value={ref}>
      <main ref={ref} className={className}>
        {children}
      </main>
    </LandingScrollContext.Provider>
  );
}
