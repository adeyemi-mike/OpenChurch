/**
 * OpenChurch role-based access control.
 *
 * Permissions are ALWAYS enforced on the server (API route handlers and
 * server components) — hiding buttons in the UI is never the check itself.
 *
 * Adding a permission: add it to `PERMISSIONS`, set the minimum church role
 * (and optionally allowSensitive for prayer/counselling data), and call
 * `can()` / `requirePermission()` from server code.
 */

export const CHURCH_ROLES = ['OWNER', 'ADMIN', 'EDITOR', 'AUTHOR'] as const
export type ChurchRole = (typeof CHURCH_ROLES)[number]

const ROLE_RANK: Record<ChurchRole, number> = {
  OWNER: 40,
  ADMIN: 30,
  EDITOR: 20,
  AUTHOR: 10,
}

export type Permission =
  // Church management
  | 'church:manage_settings'
  | 'church:manage_users'
  | 'church:manage_profile'
  // Website lifecycle
  | 'website:publish'
  | 'appearance:manage'
  // Pages & page builder
  | 'pages:manage'
  | 'pages:draft'
  // Structured content (ministries, leaders, events, sermons, services, locations, navigation)
  | 'content:manage'
  | 'content:draft'
  // Media library
  | 'media:manage'
  // Forms & enquiries
  | 'forms:manage'
  | 'enquiries:view'
  // Prayer & counselling submissions contain highly personal data.
  | 'enquiries:view_sensitive'
  // Giving configuration
  | 'giving:manage'
  // Custom domains (routing/ownership is church-level infrastructure:
  // owners and admins manage; editors/authors must not)
  | 'domains:manage'
  // Audit trail
  | 'activity:view'

/**
 * Minimum role required for each permission. The role hierarchy is
 * OWNER > ADMIN > EDITOR > AUTHOR; a higher role inherits every permission
 * of lower roles.
 */
const MIN_ROLE: Record<Permission, ChurchRole> = {
  'church:manage_settings': 'OWNER',
  'church:manage_users': 'OWNER',
  'church:manage_profile': 'ADMIN',
  'website:publish': 'OWNER',
  'appearance:manage': 'ADMIN',
  'pages:manage': 'EDITOR',
  'pages:draft': 'AUTHOR',
  'content:manage': 'EDITOR',
  'content:draft': 'AUTHOR',
  'media:manage': 'AUTHOR',
  'forms:manage': 'OWNER',
  'enquiries:view': 'EDITOR',
  'enquiries:view_sensitive': 'OWNER',
  'giving:manage': 'OWNER',
  'domains:manage': 'ADMIN',
  'activity:view': 'ADMIN',
}

export function isValidChurchRole(role: string): role is ChurchRole {
  return (CHURCH_ROLES as readonly string[]).includes(role)
}

/** Server-side permission check. Never rely on the UI for this. */
export function can(role: ChurchRole, permission: Permission): boolean {
  const min = MIN_ROLE[permission]
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

/** Roles allowed for a permission (used to render honest UI affordances). */
export function rolesWith(permission: Permission): ChurchRole[] {
  return CHURCH_ROLES.filter((r) => can(r, permission))
}

export const ROLE_LABELS: Record<ChurchRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  EDITOR: 'Editor',
  AUTHOR: 'Author',
}

export const ROLE_DESCRIPTIONS: Record<ChurchRole, string> = {
  OWNER: 'Full access: settings, users, appearance, content and publishing.',
  ADMIN: 'Manage content, appearance, enquiries and giving configuration.',
  EDITOR: 'Create, edit and publish content. No settings, users or sensitive enquiries.',
  AUTHOR: 'Create and submit draft content for review. Cannot publish.',
}
