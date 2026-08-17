import Link from "next/link"
import { redirect } from "next/navigation"
import { getMyProfile } from "@/app/actions/profile"
import { getFeed } from "@/app/actions/posts"
import { PostComposer } from "@/components/post-composer"
import { PostCard } from "@/components/post-card"

export default async function FeedPage() {
  const me = await getMyProfile()
  if (!me) redirect("/sign-in")

  const posts = await getFeed()

  return (
    <div className="h-full w-full overflow-y-auto [scrollbar-gutter:stable]">
      <div className="mx-auto w-full max-w-xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Feed</h1>
        <div className="mb-6">
          <PostComposer userName={me.name} userImage={me.image} />
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground text-balance">
              Your feed is quiet. Add friends to see their posts here, or share your first post above.
            </p>
            <Link href="/app/friends" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Find friends
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
