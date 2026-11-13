/**
 * Typed JSON (de)serialisation helpers.
 *
 * SQLite (dev) does not support Prisma's `Json` type, so structured payloads
 * are stored in TEXT columns. These helpers centralise parse/stringify so a
 * future migration to PostgreSQL `Json` columns only touches this file.
 */

export function toJson(value: unknown): string {
  return JSON.stringify(value)
}

export function fromJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

/** Parse only if the value is valid per the guard, otherwise fallback. */
export function fromJsonSafe<T>(
  raw: string | null | undefined,
  fallback: T,
  guard: (v: unknown) => v is T
): T {
  if (!raw) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    return guard(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}
