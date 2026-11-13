/**
 * Internationalisation foundation.
 *
 * The admin interface ships with English (`en`). Additional locales are added
 * by creating a sibling dictionary and registering it in `LOCALES` — every
 * UI string in the dashboard passes through `t()`, so translations are purely
 * additive. Church *content* (pages, sermons, events…) is authored by each
 * church in whatever language it uses, so public websites are naturally
 * multilingual. Locale-sensitive formatting (dates, currency, addresses) uses
 * each church's configured timezone / currency / country via `lib/format.ts`.
 */

import { en } from '@/lib/i18n/en'

export type Dictionary = typeof en
export type LocaleKey = keyof Dictionary

export const LOCALES: Record<string, Dictionary> = {
  en,
}

export const DEFAULT_LOCALE = 'en'

/** Translate a key with optional {{variable}} interpolation. */
export function t(
  key: LocaleKey,
  vars?: Record<string, string | number>,
  locale: string = DEFAULT_LOCALE
): string {
  const dict = LOCALES[locale] ?? en
  let value: string = dict[key] ?? en[key] ?? String(key)
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), String(replacement))
    }
  }
  return value
}
