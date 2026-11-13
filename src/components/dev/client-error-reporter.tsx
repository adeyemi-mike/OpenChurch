'use client'

/**
 * Dev-only client error reporter.
 *
 * Installs window-level handlers for uncaught errors and unhandled promise
 * rejections, logs them to the console with full stack, and POSTs them to
 * the dev-only collector endpoint (/api/dev/client-errors) so recurring
 * browser errors can be diagnosed from the server log with exact stacks.
 *
 * Dead-code eliminated from production builds: the component returns null
 * and never installs handlers unless NODE_ENV is "development".
 */

import { useEffect } from 'react'

export function ClientErrorReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    const seen = new Set<string>()
    let inFlight = 0
    const MAX_CONCURRENT = 3

    const report = (kind: string, message: string, stack: string, extra?: Record<string, unknown>) => {
      // Deduplicate identical errors within the page session — an unguarded
      // parse inside a poller can otherwise spam the log.
      const key = `${kind}:${message}`
      if (seen.has(key) || inFlight >= MAX_CONCURRENT) return
      seen.add(key)
      inFlight++

      console.error(`[OpenChurch client ${kind}]`, message, stack || '')

      // Echo the CSRF cookie (double-submit) so the collector accepts the
      // report even behind Host-rewriting gateways where Origin != Host.
      const csrf = document.cookie
        .split('; ')
        .find((c) => c.startsWith('openchurch_csrf='))
        ?.split('=')[1]

      void fetch('/api/dev/client-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({
          kind,
          message: message.slice(0, 600),
          stack: stack.slice(0, 4000),
          url: window.location.href,
          userAgent: navigator.userAgent,
          extra,
        }),
        // keepalive lets the report survive an immediate reload/navigation
        keepalive: true,
      })
        .catch(() => {})
        .finally(() => {
          inFlight--
        })
    }

    const onError = (event: ErrorEvent) => {
      report('error', event.message, event.error?.stack ?? '', {
        line: event.lineno,
        col: event.colno,
        source: event.filename,
      })
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : String(reason)
      const stack = reason instanceof Error ? reason.stack ?? '' : ''
      report('unhandledrejection', message, stack)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
