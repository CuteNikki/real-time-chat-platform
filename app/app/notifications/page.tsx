import { redirect } from "next/navigation"
import { getCurrentUserOrNull } from "@/lib/session"
import { getNotifications } from "@/app/actions/notifications"
import { NotificationsView } from "@/components/notifications-view"

export default async function NotificationsPage() {
  const me = await getCurrentUserOrNull()
  if (!me) redirect("/sign-in")

  const notifications = await getNotifications()

  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-y-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Notifications</h1>
      <NotificationsView initial={notifications} />
    </div>
  )
}
