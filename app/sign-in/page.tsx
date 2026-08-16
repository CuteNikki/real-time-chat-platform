import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AuthShell } from "@/components/auth-shell"
import { AuthForm } from "@/components/auth-form"

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect("/app")

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to jump back into the conversation.">
      <AuthForm mode="sign-in" />
    </AuthShell>
  )
}
