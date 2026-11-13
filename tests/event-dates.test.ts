import { describe, it, expect } from 'vitest'
import { dateParts, formatEventDate, formatEventTime } from '@/components/site/context'

/**
 * Event date presentation: the year is ALWAYS visible, dates render in the
 * church's timezone (weekday must match the intended local calendar date,
 * not the viewer's), and the locale follows the church's country.
 *
 * Regression: the Remembrance Sunday event (2027-11-14T10:00Z) previously
 * rendered "Sun, 14 Nov" with no year.
 */

// 2027-11-14 10:00 UTC — in Europe/London (GMT in November) that is
// Sunday, 14 November 2027, 10:00.
const REMEMBRANCE = '2027-11-14T10:00:00.000Z'
const LONDON = { timezone: 'Europe/London', country: 'GB' }

describe('formatEventDate', () => {
  it('includes the weekday, day, month AND year', () => {
    const out = formatEventDate(REMEMBRANCE, LONDON)
    expect(out).toContain('2027')
    expect(out).toContain('14')
    expect(out.toLowerCase()).toContain('november')
  })

  it('renders the correct weekday for the church timezone (Sunday)', () => {
    expect(formatEventDate(REMEMBRANCE, LONDON)).toMatch(/^Sunday/)
  })

  it('shifts the calendar date when timezones differ (Lagos vs London)', () => {
    // 2027-11-14 23:30 UTC is already Monday 15 November in Lagos (UTC+1).
    const late = '2027-11-14T23:30:00.000Z'
    const lagos = formatEventDate(late, { timezone: 'Africa/Lagos', country: 'NG' })
    expect(lagos).toMatch(/^Monday/)
    expect(lagos).toContain('15 November 2027')
    const london = formatEventDate(late, LONDON)
    expect(london).toMatch(/^Sunday/)
  })

  it('uses the church locale (en-NG keeps English month names)', () => {
    const out = formatEventDate(REMEMBRANCE, { timezone: 'Africa/Lagos', country: 'NG' })
    expect(out).toContain('November')
  })

  it('still works without options (visitor locale) — never throws', () => {
    expect(() => formatEventDate(REMEMBRANCE)).not.toThrow()
    expect(formatEventDate(REMEMBRANCE)).toContain('2027')
  })

  it('falls back gracefully on an invalid timezone', () => {
    const out = formatEventDate(REMEMBRANCE, { timezone: 'Not/AZone', country: 'GB' })
    expect(out).toContain('2027')
  })
})

describe('formatEventTime', () => {
  it('renders the time in the church timezone', () => {
    // 10:00 UTC = 10:00 in London (November, GMT) and 11:00 in Lagos.
    expect(formatEventTime(REMEMBRANCE, LONDON)).toMatch(/10[:.]00/)
    expect(formatEventTime(REMEMBRANCE, { timezone: 'Africa/Lagos', country: 'NG' })).toMatch(/11[:.]00/)
  })
})

describe('dateParts', () => {
  it('returns day/month/year in the church timezone', () => {
    const p = dateParts(REMEMBRANCE, LONDON)
    expect(p).toEqual({ day: '14', month: 'Nov', year: '2027' })
  })

  it('reflects timezone-driven calendar shifts', () => {
    const p = dateParts('2027-11-14T23:30:00.000Z', { timezone: 'Africa/Lagos' })
    expect(p.day).toBe('15')
  })
})
