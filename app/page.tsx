import Link from "next/link"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { buttonVariants } from "@/components/ui/button"
import { Orbit, Shuffle, Users, Lock, ArrowRight } from "lucide-react"

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Orbit className="size-6 text-primary" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Orbit</span>
        </div>
        <nav className="flex items-center gap-2">
          {session?.user ? (
            <Link href="/app" className={buttonVariants()}>
              Open app
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
                Sign in
              </Link>
              <Link href="/sign-up" className={buttonVariants()}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        {/* Hero */}
        <section className="flex flex-col items-center py-20 text-center lg:py-28">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Live conversations, right now
          </span>
          <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight lg:text-7xl">
            Talk to someone new in seconds
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Orbit matches you with strangers, spins up group rooms, and lets you invite friends to private chats — all
            in real time.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href={session?.user ? "/app" : "/sign-up"}
              className={buttonVariants({ size: "lg", className: "h-12 gap-2 px-7 text-base" })}
            >
              Start chatting
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-7 text-base" })}
            >
              I have an account
            </Link>
          </div>
        </section>

        {/* Feature grid */}
        <section className="grid gap-4 pb-24 md:grid-cols-3">
          <FeatureCard
            icon={<Shuffle className="size-5" aria-hidden />}
            title="Random match"
            body="Hit a button and get paired one-on-one with another person who's looking to talk. Skip anytime for a new match."
          />
          <FeatureCard
            icon={<Users className="size-5" aria-hidden />}
            title="Group rooms"
            body="Create or join open rooms and chat with everyone at once. See exactly how many people are live in each room."
          />
          <FeatureCard
            icon={<Lock className="size-5" aria-hidden />}
            title="Private chats"
            body="Invite a friend by email, share images, and keep the conversation just between the two of you."
          />
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-muted-foreground">
        <p>Built for real-time conversation.</p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
