import { randomUUID } from "crypto"

// Generates a unique id, optionally namespaced with a short prefix
// (e.g. newId("chat") -> "chat_ab12...") for readability in the DB.
export function newId(prefix?: string) {
  const uuid = randomUUID()
  return prefix ? `${prefix}_${uuid}` : uuid
}
