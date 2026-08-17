import { redirect } from "next/navigation"

// The app landing route now defaults to the home feed. Random matching lives
// at /app/match.
export default function AppIndexPage() {
  redirect("/app/feed")
}
