import { db } from '@/lib/db'
import { ShieldAlert } from 'lucide-react'
import { requireChurchContext } from '@/lib/auth/guards'
import { can } from '@/lib/permissions'
import { WebsiteSettings } from '@/components/dashboard/website-settings'
import { ExportCard } from '@/components/dashboard/export-card'
import { churchBaseUrl } from '@/lib/tenancy/resolver'
import { getDomainCapability } from '@/lib/domains/capability'

export const metadata = { title: 'Website Settings' }

export default async function WebsiteSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)

  if (!can(ctx.role, 'appearance:manage')) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <ShieldAlert className="size-8 mx-auto text-muted-foreground/50" aria-hidden />
        <h1 className="mt-3 font-semibold text-lg">Website settings are owner-managed</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
          Only the church owner can change publishing and search engine settings in this version.
        </p>
      </div>
    )
  }

  const settings =
    (await db.churchSettings.findUnique({ where: { churchId: ctx.church.id } })) ??
    (await db.churchSettings.create({ data: { churchId: ctx.church.id } }))

  return (
    <>
      <WebsiteSettings
        slug={slug}
        isPublished={ctx.church.isPublished}
        platformUrl={churchBaseUrl(ctx.church.slug)}
        domainMode={getDomainCapability().mode}
        initial={{
          defaultSeoTitle: settings.defaultSeoTitle ?? '',
          defaultSeoDescription: settings.defaultSeoDescription ?? '',
          mapEmbedUrl: settings.mapEmbedUrl ?? '',
        }}
      />
      {can(ctx.role, 'church:manage_settings') && <ExportCard slug={slug} />}
    </>
  )
}
