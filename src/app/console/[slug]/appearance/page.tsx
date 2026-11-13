import { db } from '@/lib/db'
import { requireChurchContext } from '@/lib/auth/guards'
import { AppearanceManager } from '@/components/dashboard/appearance-manager'

export const metadata = { title: 'Appearance' }

export default async function AppearancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requireChurchContext(slug)

  const settings =
    (await db.churchSettings.findUnique({ where: { churchId: ctx.church.id } })) ??
    (await db.churchSettings.create({ data: { churchId: ctx.church.id } }))

  return (
    <AppearanceManager
      slug={slug}
      initial={{
        id: settings.id,
        themeKey: settings.themeKey,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        fontKey: settings.fontKey,
        logoUrl: settings.logoUrl,
        heroImageUrl: settings.heroImageUrl,
        footerText: settings.footerText,
        copyrightLine: settings.copyrightLine,
        socialFacebook: settings.socialFacebook,
        socialInstagram: settings.socialInstagram,
        socialYoutube: settings.socialYoutube,
        socialX: settings.socialX,
        socialTiktok: settings.socialTiktok,
        whatsappNumber: settings.whatsappNumber,
        defaultSeoTitle: settings.defaultSeoTitle,
        defaultSeoDescription: settings.defaultSeoDescription,
        mapEmbedUrl: settings.mapEmbedUrl,
        announcementText: settings.announcementText,
        announcementEnabled: settings.announcementEnabled,
      }}
    />
  )
}
