import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requireChurchContext } from '@/lib/auth/guards'
import { PageBuilder } from '@/components/builder/page-builder'
import { validateSections } from '@/lib/sections/types'
import type { SectionsList } from '@/lib/sections/types'
import { fromJson } from '@/lib/serialization'

export const metadata = { title: 'Page builder' }

export default async function PageBuilderPage({
  params,
}: {
  params: Promise<{ slug: string; pageId: string }>
}) {
  const { slug, pageId } = await params
  const ctx = await requireChurchContext(slug)

  const page = await db.websitePage.findFirst({
    where: { id: pageId, churchId: ctx.church.id },
  })
  if (!page) notFound()

  // Draft sections, validated through the same Zod schema the API uses.
  const raw = fromJson<unknown>(page.draftSections, [])
  const result = validateSections(raw)
  const sections: SectionsList = result.ok ? result.sections : []

  return (
    <PageBuilder
      slug={slug}
      role={ctx.role}
      initialSections={sections}
      page={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        isHomePage: page.isHomePage,
        status: page.status,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
      }}
    />
  )
}
