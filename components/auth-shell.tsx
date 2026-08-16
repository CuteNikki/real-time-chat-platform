import type React from "react"
import { Orbit } from "lucide-react"

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-svh flex-col lg:flex-row">
      {/* Brand panel */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-primary px-8 py-10 text-primary-foreground lg:w-[45%] lg:px-14 lg:py-14">
        <div className="flex items-center gap-2">
          <Orbit className="size-6" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Orbit</span>
        </div>

        <div className="relative z-10 hidden max-w-md lg:block">
          <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
            Someone new is always one tap away.
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-primary-foreground/80">
            Get matched with a stranger, drop into a group room, or start a private chat with a friend. Conversations
            happen in real time.
          </p>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-primary-foreground/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-[24rem] rounded-full bg-primary-foreground/10 blur-2xl"
        />

        <p className="relative z-10 hidden text-sm text-primary-foreground/60 lg:block">
          Real-time chat, powered by presence.
        </p>
      </section>

      {/* Form panel */}
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  )
}
