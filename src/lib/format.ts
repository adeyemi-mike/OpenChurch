/**
 * Locale-aware formatting driven by each church's settings
 * (timezone / currency / country) — no country is hardcoded anywhere.
 */

export type ChurchLocaleConfig = {
  timezone: string
  currency: string
  country: string
  dateFormat: 'short' | 'medium' | 'long'
}

const COUNTRY_LANGUAGE: Record<string, string> = {
  NG: 'en-NG',
  GB: 'en-GB',
  US: 'en-US',
  GH: 'en-GH',
  KE: 'en-KE',
  CA: 'en-CA',
  AU: 'en-AU',
  DE: 'de-DE',
  FR: 'fr-FR',
  BR: 'pt-BR',
}

/** Locale for a country code ('en' fallback). Exported for public-site
 *  date rendering so church sites format dates in their own locale. */
export function localeFor(country: string): string {
  return COUNTRY_LANGUAGE[country] ?? 'en'
}

const DATE_STYLE: Record<ChurchLocaleConfig['dateFormat'], Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  medium: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
}

/** Format an absolute date in the church's timezone. */
export function formatDate(date: Date | string, config: ChurchLocaleConfig): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(localeFor(config.country), {
    ...DATE_STYLE[config.dateFormat],
    timeZone: config.timezone || 'UTC',
  }).format(d)
}

/** Format date + time in the church's timezone. */
export function formatDateTime(date: Date | string, config: ChurchLocaleConfig): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(localeFor(config.country), {
    ...DATE_STYLE[config.dateFormat],
    hour: 'numeric',
    minute: '2-digit',
    timeZone: config.timezone || 'UTC',
  }).format(d)
}

/** Format a time-only value in the church's timezone. */
export function formatTime(date: Date | string, config: ChurchLocaleConfig): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(localeFor(config.country), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: config.timezone || 'UTC',
  }).format(d)
}

export function formatCurrency(
  amount: number,
  config: Pick<ChurchLocaleConfig, 'currency' | 'country'>
): string {
  try {
    return new Intl.NumberFormat(localeFor(config.country), {
      style: 'currency',
      currency: config.currency || 'USD',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${config.currency} ${amount.toLocaleString()}`
  }
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AU', name: 'Australia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BR', name: 'Brazil' },
  { code: 'PH', name: 'Philippines' },
  { code: 'IN', name: 'India' },
]

export const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR', 'CAD', 'AUD', 'BRL', 'PHP', 'INR'] as const

export const TIMEZONES = [
  'UTC',
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Asia/Singapore',
  'Asia/Manila',
  'Asia/Kolkata',
  'Australia/Sydney',
] as const
