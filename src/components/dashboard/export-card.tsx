'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Church data export (owner-only): downloads the complete JSON export from
 * /api/dashboard/<slug>/export. The browser navigation carries the session
 * cookie; the endpoint answers with a Content-Disposition attachment.
 */
export function ExportCard({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false)

  function handleDownload() {
    setBusy(true)
    toast.info('Preparing your export…')
    // Simple navigation GET: the response is a file attachment, so the
    // current page stays put.
    window.location.href = `/api/dashboard/${slug}/export`
    // The download itself cannot fail visibly here — the endpoint returns a
    // JSON error document instead; give the toast a moment then reset.
    setTimeout(() => setBusy(false), 1500)
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="size-4" aria-hidden /> Your data
        </CardTitle>
        <CardDescription>
          Download a complete JSON export of this church&apos;s content — pages,
          sermons, events, ministries, leaders, giving settings, forms and
          enquiry submissions. No vendor lock-in: the file is yours to keep.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleDownload} disabled={busy} variant="outline">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          Export church data (JSON)
        </Button>
      </CardContent>
    </Card>
  )
}
