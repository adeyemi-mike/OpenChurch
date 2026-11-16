import type { Metadata } from 'next'
import { requireChurchContext } from '@/lib/auth/guards'
import { can } from '@/lib/permissions'
import { DomainsManager } from '@/components/dashboard/domains-manager'
import { churchPlatformAddresses } from '@/lib/tenancy/resolver'

export const metadata: Metadata = {
  title: 'Custom Domains',
  robots: { index: false },
}

export default async function DomainsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)
  // Only owners and administrators manage domains (server-enforced in the
  // API too); editors/authors never see this page.
  if (!can(ctx.role, 'domains:manage')) {
    return (
      <div className="rounded-xl border bg-background p-8 text-center">
        <h1 className="text-lg font-semibold">Custom domains</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only church owners and administrators can manage custom domains.
        </p>
      </div>
    )
  }

  const addresses = churchPlatformAddresses(ctx.church.slug)

  return (
    <DomainsManager
      slug={ctx.church.slug}
      role={ctx.role}
      platformUrl={addresses.pathUrl}
      subdomainUrl={addresses.subdomainUrl}
      churchName={ctx.church.name}
    />
  )
}
