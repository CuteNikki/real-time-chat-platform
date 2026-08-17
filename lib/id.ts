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

// Generates a random, URL-safe default username like "user_a1b2c3d4".
// Always matches the app's username rule: ^[a-z0-9_]{3,20}$.
export function generateUsername() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  let suffix = ""
  const bytes =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? crypto.getRandomValues(new Uint8Array(8))
      : Array.from({ length: 8 }, () => Math.floor(Math.random() * 256))
  for (const b of bytes) suffix += alphabet[b % alphabet.length]
  return `user_${suffix}`
}
