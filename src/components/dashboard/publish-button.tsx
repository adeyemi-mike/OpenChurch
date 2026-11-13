'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe2, Loader2, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch, ApiClientError } from '@/lib/client/api'

export function WebsitePublishButton({
  slug,
  isPublished,
  size = 'default',
}: {
  slug: string
  isPublished: boolean
  size?: 'default' | 'sm'
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function toggle() {
    setPending(true)
    try {
      await apiFetch(`/api/dashboard/${slug}/publish`, {
        method: 'POST',
        body: JSON.stringify({ publish: !isPublished }),
      })
      toast.success(!isPublished ? 'Your website is live.' : 'Website unpublished — visitors now see a “not yet published” page.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update the website status.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Button onClick={toggle} disabled={pending} variant={isPublished ? 'outline' : 'default'} size={size}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : isPublished ? <Power className="size-4" aria-hidden /> : <Globe2 className="size-4" aria-hidden />}
      {isPublished ? 'Unpublish website' : 'Publish website'}
    </Button>
  )
}
