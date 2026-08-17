"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"
import { updateNotificationPreferences } from "@/app/actions/preferences"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types"
import type { NotificationPreferences } from "@/lib/types"

type Ctx = {
  prefs: NotificationPreferences
  // Optimistically apply a change and persist it (debounced) to the server.
  update: (next: NotificationPreferences) => void
}

const NotificationPrefsContext = createContext<Ctx | null>(null)

export function NotificationPrefsProvider({
  initial,
  children,
}: {
  initial: NotificationPreferences
  children: React.ReactNode
}) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const update = useCallback((next: NotificationPreferences) => {
    setPrefs(next)
    if (timer.current) clearTimeout(timer.current)
    // Debounce writes so dragging the volume slider doesn't spam the DB.
    timer.current = setTimeout(() => {
      void updateNotificationPreferences(next).catch(() => {})
    }, 400)
  }, [])

  return (
    <NotificationPrefsContext.Provider value={{ prefs, update }}>
      {children}
    </NotificationPrefsContext.Provider>
  )
}

export function useNotificationPrefs(): Ctx {
  const ctx = useContext(NotificationPrefsContext)
  // Fall back to defaults if used outside a provider (keeps components safe).
  if (!ctx) {
    return { prefs: DEFAULT_NOTIFICATION_PREFERENCES, update: () => {} }
  }
  return ctx
}
