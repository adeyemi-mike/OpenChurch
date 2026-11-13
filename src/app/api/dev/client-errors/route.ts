import { type NextRequest, NextResponse } from 'next/server'
import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * DEV-ONLY client error collector.
 *
 * Receives uncaught-error reports from the dev-only ClientErrorReporter and
 * appends them to logs/client-errors.log so recurring browser errors can be
 * diagnosed with exact stacks, URL and timestamp.
 *
 * In production this endpoint does not exist (404) — no new public surface,
 * no disk writes, nothing to abuse.
 */

export const runtime = 'nodejs'

const MAX_PER_MINUTE = 30
let windowStart = 0
let windowCount = 0

type Report = {
  kind?: string
  message?: string
  stack?: string
  url?: string
  userAgent?: string
  extra?: Record<string, unknown>
}

const clean = (value: unknown, max: number): string => {
  if (typeof value !== 'string') return ''
  return value.replace(/[\r\n]+/g, ' ').slice(0, max)
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: { message: 'Not found.', code: 'NOT_FOUND' } }, { status: 404 })
  }

  // Tiny fixed-window rate limit.
  const now = Date.now()
  if (now - windowStart > 60_000) {
    windowStart = now
    windowCount = 0
  }
  if (windowCount >= MAX_PER_MINUTE) {
    return NextResponse.json({ ok: true, data: { dropped: true } })
  }
  windowCount++

  let report: Report
  try {
    report = (await req.json()) as Report
  } catch {
    return NextResponse.json({ ok: false, error: { message: 'Invalid JSON body.', code: 'BAD_JSON' } }, { status: 400 })
  }

  const line = JSON.stringify({
    at: new Date().toISOString(),
    kind: clean(report.kind, 40) || 'unknown',
    message: clean(report.message, 600),
    stack: clean(report.stack, 4000),
    url: clean(report.url, 300),
    userAgent: clean(report.userAgent, 200),
    extra: report.extra && typeof report.extra === 'object' ? report.extra : undefined,
  })

  try {
    const logPath = resolve(process.cwd(), 'logs', 'client-errors.log')
    mkdirSync(resolve(process.cwd(), 'logs'), { recursive: true })
    appendFileSync(logPath, line + '\n', { encoding: 'utf8' })
  } catch {
    // Logging must never break the page — swallow write failures.
  }

  return NextResponse.json({ ok: true, data: { recorded: true } })
}
