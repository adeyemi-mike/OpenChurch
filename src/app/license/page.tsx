import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'License',
  description:
    'OpenChurch is free and open-source software released under the MIT License.',
}

/** Mirrors the LICENSE file at the root of the repository. */
const LICENSE_TEXT = `MIT License

Copyright (c) 2026 OpenChurch contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

export default function LicensePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">OpenChurch platform</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">License</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          OpenChurch is free and open-source software. You may use, study, modify and
          redistribute it under the terms of the MIT License below — the same text ships as the{' '}
          <code className="rounded bg-muted px-1 text-sm">LICENSE</code> file at the root of the
          source repository. See also our{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms" className="text-primary underline underline-offset-2">
            Terms of Service
          </Link>
          .
        </p>
        <pre className="mt-8 overflow-x-auto whitespace-pre-wrap rounded-2xl border bg-muted/40 p-6 text-sm leading-relaxed">
          {LICENSE_TEXT}
        </pre>
      </div>
    </div>
  )
}
