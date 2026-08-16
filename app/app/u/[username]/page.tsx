import { notFound } from "next/navigation"
import { getProfileByUsername } from "@/app/actions/profile"
import { getUserPosts } from "@/app/actions/posts"
import { ProfileView } from "@/components/profile-view"

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const profile = await getProfileByUsername(username)
  if (!profile) notFound()

  const posts = await getUserPosts(profile.id)

  return <ProfileView profile={profile} initialPosts={posts} />
}
