import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { getChurchContext } from '@/lib/auth/guards'
import { ChurchSite, parseSections } from '@/components/site/site-renderer'
import { loadSectionData } from '@/lib/sections/data'
import { fromJson } from '@/lib/serialization'

export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false, follow: false },
}

/**
 * Authenticated draft preview for the page builder — renders the exact same
 * renderer as the live website, with the DRAFT section snapshot.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ pageId?: string }>
}) {
  const { slug } = await params
  const { pageId } = await searchParams

  const user = await getSessionUser()
  if (!user) redirect('/login')
  const ctx = await getChurchContext(slug, user)
  if (!ctx) redirect('/console')

  const church = await db.church.findFirst({
    where: { slug, id: ctx.church.id },
    include: { settings: true },
  })
  if (!church || !church.settings) redirect('/console')

  const page = pageId
    ? await db.websitePage.findFirst({ where: { id: pageId, churchId: church.id } })
    : await db.websitePage.findFirst({ where: { churchId: church.id, isHomePage: true } })

  if (!page) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/40">
        <p className="text-muted-foreground">No page to preview — create one first.</p>
      </div>
    )
  }

  const [data, headerNav, footerNav] = await Promise.all([
    loadSectionData(church.id),
    db.navigationMenu.findUnique({ where: { churchId_location: { churchId: church.id, location: 'HEADER' } } }),
    db.navigationMenu.findUnique({ where: { churchId_location: { churchId: church.id, location: 'FOOTER' } } }),
  ])

  return (
    <ChurchSite
      church={{
        slug: church.slug,
        name: church.name,
        city: church.city,
        country: church.country,
        address: church.address,
        phone: church.phone,
        email: church.email,
        timezone: church.timezone,
        isPublished: church.isPublished,
      }}
      settings={church.settings}
      nav={{
        header: fromJson<{ label: string; href: string }[]>(headerNav?.items, []),
        footer: fromJson<{ label: string; href: string }[]>(footerNav?.items, []),
      }}
      data={data}
      preview
      sections={parseSections(page.draftSections)}
    />
  )
}
