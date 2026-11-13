import Link from 'next/link'
import { Church as ChurchIcon } from 'lucide-react'

/**
 * Branded 404 for /church/* — rendered (with a proper HTTP 404 status) when
 * a church slug doesn't exist, the church is suspended, or a page path
 * doesn't exist on an existing church's website.
 */
export default function ChurchNotFound() {
  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 px-4">
      <div className="text-center max-w-md">
        <span className="mx-auto grid place-items-center size-16 rounded-2xl bg-primary/10 text-primary">
          <ChurchIcon className="size-8" aria-hidden />
        </span>
        <p className="mt-6 text-6xl font-semibold tracking-tight text-primary/30">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          This page doesn&rsquo;t exist or isn&rsquo;t available. The address may be mistyped,
          the page may have been moved or unpublished, or the church website may no
          longer exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          Go to OpenChurch
        </Link>
      </div>
    </div>
  )
}
