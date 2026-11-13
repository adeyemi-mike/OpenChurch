/**
 * Slug utilities — used for church subpaths, page paths, ministries, etc.
 * ASCII-safe with a unicode fallback so international names still produce
 * valid, readable slugs.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u0027\u2018\u2019\u02bc`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Ensure a slug is non-empty; falls back to a base + random suffix. */
export function slugifyOr(input: string, fallback: string): string {
  const slug = slugify(input)
  return slug || `${fallback}-${Math.random().toString(36).slice(2, 6)}`
}

/** Validate a page path like "about", "get-involved/youth". */
export function isValidPageSlug(slug: string): boolean {
  if (slug === '') return true // homepage
  return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(slug) && slug.length <= 100
}

export function uniqueSlug(
  desired: string,
  taken: (s: string) => boolean,
  maxAttempts = 25
): string {
  let candidate = desired
  let i = 2
  while (taken(candidate) && i < maxAttempts) {
    candidate = `${desired}-${i}`
    i += 1
  }
  return taken(candidate) ? `${desired}-${Math.random().toString(36).slice(2, 6)}` : candidate
}
