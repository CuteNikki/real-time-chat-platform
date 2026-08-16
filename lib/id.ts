// Generates a unique id, optionally namespaced with a short prefix
// (e.g. newId("chat") -> "chat_ab12...") for readability in the DB.
// Uses the Web Crypto API, which is available in both the browser and
// modern Node runtimes, so this helper is safe to call on either side.
export function newId(prefix?: string) {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : // Fallback for environments without crypto.randomUUID.
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${uuid}` : uuid
}
