import { redirect } from "next/navigation"
import { getMyProfile } from "@/app/actions/profile"
import { ProfileSettings } from "@/components/profile-settings"

export default async function SettingsPage() {
  const profile = await getMyProfile()
  if (!profile) redirect("/sign-in")

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit profile</h1>
      <ProfileSettings profile={profile} />
    </div>
  )
}
