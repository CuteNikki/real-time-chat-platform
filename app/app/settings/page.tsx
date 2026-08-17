import { redirect } from "next/navigation"
import { getMyProfile } from "@/app/actions/profile"
import { ProfileSettings } from "@/components/profile-settings"
import { AccountSettings } from "@/components/account-settings"

export default async function SettingsPage() {
  const profile = await getMyProfile()
  if (!profile) redirect("/sign-in")

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Account &amp; profile</h1>
        <ProfileSettings profile={profile} />
        <AccountSettings />
      </div>
    </div>
  )
}
