import 'server-only'
import { db } from '@/lib/db'
import { toJson } from '@/lib/serialization'

/**
 * Audit trail for administrative actions. Metadata must stay minimal —
 * never log form submission contents, credentials or personal data.
 */

export type AuditEntry = {
  churchId?: string | null
  actorUserId?: string | null
  actorEmail?: string | null
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        churchId: entry.churchId ?? null,
        actorUserId: entry.actorUserId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ? toJson(entry.metadata) : null,
      },
    })
  } catch (err) {
    // Auditing must never break the user action itself, but failures are
    // surfaced in server logs for operators.
    console.error('[audit] failed to record', entry.action, err)
  }
}

export const AUDIT_ACTIONS = {
  churchCreated: 'church.created',
  churchUpdated: 'church.updated',
  websitePublished: 'website.published',
  websiteUnpublished: 'website.unpublished',
  pageCreated: 'page.created',
  pageUpdated: 'page.updated',
  pagePublished: 'page.published',
  pageDeleted: 'page.deleted',
  settingsUpdated: 'settings.updated',
  appearanceUpdated: 'appearance.updated',
  navigationUpdated: 'navigation.updated',
  ministryCreated: 'ministry.created',
  ministryUpdated: 'ministry.updated',
  ministryDeleted: 'ministry.deleted',
  leaderCreated: 'leader.created',
  leaderUpdated: 'leader.updated',
  leaderDeleted: 'leader.deleted',
  eventCreated: 'event.created',
  eventUpdated: 'event.updated',
  eventDeleted: 'event.deleted',
  sermonCreated: 'sermon.created',
  sermonUpdated: 'sermon.updated',
  sermonDeleted: 'sermon.deleted',
  serviceUpdated: 'service.updated',
  locationUpdated: 'location.updated',
  mediaUploaded: 'media.uploaded',
  mediaUpdated: 'media.updated',
  mediaDeleted: 'media.deleted',
  submissionUpdated: 'submission.updated',
  domainAdded: 'domain.added',
  domainVerified: 'domain.verified',
  domainTokenRegenerated: 'domain.tokenRegenerated',
  domainConnected: 'domain.connected',
  domainManualConfirmed: 'domain.manualConfirmed',
  domainPrimaryChanged: 'domain.primaryChanged',
  domainRemoved: 'domain.removed',
  submissionDeleted: 'submission.deleted',
  formsUpdated: 'forms.updated',
  givingUpdated: 'giving.updated',
  memberRoleChanged: 'member.role_changed',
  memberRemoved: 'member.removed',
  memberAdded: 'member.added',
  userRegistered: 'user.registered',
  userLogin: 'user.login',
  userPasswordChanged: 'user.password_changed',
  userExported: 'user.exported',
  userDeleted: 'user.deleted',
  churchExported: 'church.exported',
  churchDeleted: 'church.deleted',
  passwordResetRequested: 'password.reset_requested',
  passwordResetViaEmail: 'password.reset_via_email',
  platformChurchSuspended: 'platform.church_suspended',
  platformChurchActivated: 'platform.church_activated',
  platformPasswordReset: 'platform.password_reset',
  platformAdminGranted: 'platform.admin_granted',
} as const
