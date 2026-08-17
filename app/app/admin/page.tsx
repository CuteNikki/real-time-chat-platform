import { redirect } from "next/navigation"
import { getMyRole } from "@/lib/roles-server"
import { atLeast } from "@/lib/roles"
import { listUsersForAdmin } from "@/app/actions/admin"
import { AdminView } from "@/components/admin-view"

export default async function AdminPage() {
  const role = await getMyRole()
  // Moderators and admins can moderate; members can't reach this page.
  if (!atLeast(role, "MODERATOR")) redirect("/app")

  const users = await listUsersForAdmin()

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === "ADMIN"
              ? "Manage roles, ban or delete accounts, and review moderation history."
              : "Ban members and review moderation history."}
          </p>
        </header>
        <AdminView initialUsers={users} viewerRole={role} />
      </div>
    </div>
  )
}
