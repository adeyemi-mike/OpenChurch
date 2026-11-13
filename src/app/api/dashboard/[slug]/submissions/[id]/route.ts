import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { route, ok, requireChurch, ApiError, parseBody } from '@/lib/api/handler'
import { submissionPatchSchema } from '@/lib/validation/entities'
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { can, type ChurchRole } from '@/lib/permissions'

/**
 * Update / delete a single enquiry. Prayer and counselling submissions
 * (isSensitive) are pastoral-care data: they require `enquiries:view_sensitive`.
 * Audit metadata records only the submission type — never the contents.
 */

type Ctx = { params: Promise<{ slug: string; id: string }> }

type SubmissionRow = {
  id: string
  type: string
  isSensitive: boolean
  status: string
}

async function loadSubmission(churchId: string, id: string): Promise<SubmissionRow & { status: string }> {
  const submission = await db.formSubmission.findFirst({
    where: { id, churchId },
    select: { id: true, type: true, isSensitive: true, status: true },
  })
  if (!submission) throw new ApiError(404, 'Submission not found.', 'NOT_FOUND')
  return submission
}

/** Sensitive submissions are restricted to roles with pastoral access. */
function assertSensitiveAccess(role: ChurchRole, submission: { isSensitive: boolean }): void {
  if (submission.isSensitive && !can(role, 'enquiries:view_sensitive')) {
    throw new ApiError(
      403,
      'Prayer and counselling requests are visible to owners and administrators only.',
      'FORBIDDEN'
    )
  }
}

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'enquiries:view')
  const patch = await parseBody(req, submissionPatchSchema)

  const submission = await loadSubmission(ctx.churchId, id)
  assertSensitiveAccess(ctx.role, submission)

  if (patch.status !== undefined) {
    await db.formSubmission.update({
      where: { id: submission.id },
      data: { status: patch.status },
    })
    await recordAudit({
      churchId: ctx.churchId,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      action: AUDIT_ACTIONS.submissionUpdated,
      entityType: 'submission',
      entityId: submission.id,
      metadata: { submissionType: submission.type },
    })
    return ok({ id: submission.id, status: patch.status })
  }

  return ok({ id: submission.id, status: submission.status })
})

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const { slug, id } = await params
  const ctx = await requireChurch(slug, 'enquiries:view')

  const submission = await loadSubmission(ctx.churchId, id)
  assertSensitiveAccess(ctx.role, submission)

  await db.formSubmission.delete({ where: { id: submission.id } })

  await recordAudit({
    churchId: ctx.churchId,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: AUDIT_ACTIONS.submissionDeleted,
    entityType: 'submission',
    entityId: submission.id,
    metadata: { submissionType: submission.type },
  })

  return ok({ deleted: true })
})
