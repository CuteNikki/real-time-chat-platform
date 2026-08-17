import { redirect } from "next/navigation"
import { getMyProfile } from "@/app/actions/profile"
import { SettingsTabs } from "@/components/settings-tabs"

export default async function SettingsPage() {
  const profile = await getMyProfile()
  if (!profile) redirect("/sign-in")

  return (
    <div className="h-full w-full overflow-y-auto [scrollbar-gutter:stable]">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
        <SettingsTabs profile={profile} />
      </div>
    </div>
  )
}
