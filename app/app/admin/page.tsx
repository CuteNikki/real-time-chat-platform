import { redirect } from "next/navigation"
import { getMyRole } from "@/lib/roles-server"
import { listUsersForAdmin } from "@/app/actions/admin"
import { AdminView } from "@/components/admin-view"

export default async function AdminPage() {
  const role = await getMyRole()
  if (role !== "ADMIN") redirect("/app")

  const users = await listUsersForAdmin()

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage member roles. Moderators and admins can create group channels.
        </p>
      </header>
      <AdminView initialUsers={users} />
    </div>
  )
}
