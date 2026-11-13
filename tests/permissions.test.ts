import { describe, it, expect } from 'vitest'
import { can, isValidChurchRole, rolesWith, CHURCH_ROLES, type ChurchRole } from '@/lib/permissions'

/**
 * Role-based access control — the permission matrix is enforced on the
 * server; these tests pin the matrix so regressions are caught immediately.
 */

const all: ChurchRole[] = [...CHURCH_ROLES]

describe('can() permission matrix', () => {
  it('gives owners every permission', () => {
    const perms = [
      'church:manage_settings',
      'church:manage_users',
      'church:manage_profile',
      'website:publish',
      'appearance:manage',
      'pages:manage',
      'pages:draft',
      'content:manage',
      'content:draft',
      'media:manage',
      'forms:manage',
      'enquiries:view',
      'enquiries:view_sensitive',
      'giving:manage',
      'activity:view',
    ] as const
    for (const p of perms) expect(can('OWNER', p)).toBe(true)
  })

  it('keeps owner-only permissions from admins and below', () => {
    for (const role of ['ADMIN', 'EDITOR', 'AUTHOR'] as ChurchRole[]) {
      expect(can(role, 'church:manage_settings')).toBe(false)
      expect(can(role, 'church:manage_users')).toBe(false)
      expect(can(role, 'website:publish')).toBe(false)
      expect(can(role, 'forms:manage')).toBe(false)
      expect(can(role, 'giving:manage')).toBe(false)
      expect(can(role, 'enquiries:view_sensitive')).toBe(false)
    }
  })

  it('lets admins manage appearance, profile and view activity', () => {
    expect(can('ADMIN', 'appearance:manage')).toBe(true)
    expect(can('ADMIN', 'church:manage_profile')).toBe(true)
    expect(can('ADMIN', 'activity:view')).toBe(true)
    expect(can('EDITOR', 'activity:view')).toBe(false)
  })

  it('lets editors manage pages/content/media/enquiries but not appearance', () => {
    expect(can('EDITOR', 'pages:manage')).toBe(true)
    expect(can('EDITOR', 'content:manage')).toBe(true)
    expect(can('EDITOR', 'media:manage')).toBe(true)
    expect(can('EDITOR', 'enquiries:view')).toBe(true)
    expect(can('EDITOR', 'appearance:manage')).toBe(false)
  })

  it('restricts authors to drafts, media and nothing sensitive', () => {
    expect(can('AUTHOR', 'pages:draft')).toBe(true)
    expect(can('AUTHOR', 'content:draft')).toBe(true)
    expect(can('AUTHOR', 'media:manage')).toBe(true)
    expect(can('AUTHOR', 'pages:manage')).toBe(false)
    expect(can('AUTHOR', 'content:manage')).toBe(false)
    expect(can('AUTHOR', 'enquiries:view')).toBe(false)
  })

  it('derives coherent role sets for each permission', () => {
    expect(rolesWith('church:manage_users')).toEqual(['OWNER'])
    expect(rolesWith('pages:draft')).toEqual(all)
    expect(rolesWith('media:manage')).toEqual(all)
    expect(rolesWith('enquiries:view')).toEqual(['OWNER', 'ADMIN', 'EDITOR'])
  })

  it('validates role strings', () => {
    expect(isValidChurchRole('OWNER')).toBe(true)
    expect(isValidChurchRole('author')).toBe(false) // case-sensitive
    expect(isValidChurchRole('SUPERUSER')).toBe(false)
    expect(isValidChurchRole('')).toBe(false)
  })
})
