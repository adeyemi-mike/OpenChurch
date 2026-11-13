import type { ReactNode } from 'react'
import Link from 'next/link'
import { Church } from 'lucide-react'

/** Shared shell for the platform's auth pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
            <span className="grid place-items-center size-8 rounded-lg bg-primary text-primary-foreground">
              <Church className="size-4" aria-hidden />
            </span>
            OpenChurch
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-background border rounded-2xl shadow-sm p-6 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground mb-6">{subtitle}</p>
            {children}
          </div>
          {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}
