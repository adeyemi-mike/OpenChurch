import { describe, it, expect } from 'vitest'
import { registerSchema, loginSchema, createChurchSchema, onboardingInfoSchema } from '@/lib/validation/onboarding'
import { publicSubmissionSchema, pageCreateSchema } from '@/lib/validation/entities'

describe('auth validation', () => {
  it('accepts a valid registration', () => {
    expect(
      registerSchema.safeParse({ name: 'Daniel Adeyemi', email: 'Dan@Example.com ', password: 'Passw0rd' }).success
    ).toBe(true)
  })
  it('normalises email case and whitespace', () => {
    const r = registerSchema.parse({ name: 'A B', email: '  X@EXAMPLE.com ', password: 'Passw0rd' })
    expect(r.email).toBe('x@example.com')
  })
  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ name: 'A B', email: 'a@b.co', password: 'short' }).success).toBe(false)
    expect(registerSchema.safeParse({ name: 'A B', email: 'a@b.co', password: 'onlyletters' }).success).toBe(false)
    expect(registerSchema.safeParse({ name: 'A B', email: 'a@b.co', password: '12345678' }).success).toBe(false)
  })
  it('rejects bad emails', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false)
  })
})

describe('onboarding schemas', () => {
  const validInfo = {
    name: 'Grace Community Church',
    denomination: '',
    country: 'NG',
    region: 'Lagos',
    city: 'Lagos',
    address: '12 Admiralty Way',
    phone: '+2348012345678',
    email: 'hello@grace.demo',
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }
  const validIdentity = {
    primaryColor: '#0F5C4E',
    secondaryColor: '#B45309',
    fontKey: 'sans',
  }

  it('accepts a complete onboarding payload', () => {
    const result = createChurchSchema.safeParse({
      slug: 'grace-community',
      info: validInfo,
      identity: validIdentity,
      structure: {
        leaders: [{ name: 'Daniel', title: 'Senior Pastor', bio: '' }],
        ministries: [{ name: 'Youth', description: '', leaderName: '', meetingTime: '' }],
        services: [{ name: 'Sunday Worship', dayOfWeek: 0, startTime: '10:00', endTime: '', notes: '' }],
        locations: [{ name: 'Main', address: '', city: 'Lagos', country: 'NG' }],
      },
      design: { themeKey: 'vibrant' },
      publish: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid colours, slugs and service times', () => {
    const base = { slug: 'ok-slug', structure: { leaders: [], ministries: [], services: [], locations: [] }, design: { themeKey: 'modern' } }
    expect(createChurchSchema.safeParse({ ...base, info: validInfo, identity: { ...validIdentity, primaryColor: 'green' } }).success).toBe(false)
    expect(createChurchSchema.safeParse({ ...base, slug: 'Not A Slug', info: validInfo, identity: validIdentity }).success).toBe(false)
    expect(
      createChurchSchema.safeParse({
        ...base,
        info: validInfo,
        identity: validIdentity,
        structure: { leaders: [], ministries: [], services: [{ name: 'X', dayOfWeek: 9, startTime: '10:00', endTime: '', notes: '' }], locations: [] },
      }).success
    ).toBe(false)
  })

  it('requires a two-letter country', () => {
    expect(onboardingInfoSchema.safeParse({ ...validInfo, country: 'NGA' }).success).toBe(false)
  })
})

describe('public submission schema (spam & safety)', () => {
  const valid = {
    type: 'CONTACT',
    name: 'Ifeoma Nwabueze',
    email: 'ifeoma@example.com',
    phone: '',
    subject: 'Hello',
    message: 'A message',
    company: '',
  }
  it('accepts a genuine submission', () => {
    expect(publicSubmissionSchema.safeParse(valid).success).toBe(true)
  })
  it('allows anonymous prayer requests (empty email ok)', () => {
    expect(publicSubmissionSchema.safeParse({ ...valid, type: 'PRAYER', email: '' }).success).toBe(true)
  })
  it('accepts a filled honeypot — bots get a silent, no-storage success', () => {
    // Updated behaviour: the honeypot value passes the schema, and the API
    // route silently discards the submission WITHOUT storing it while still
    // returning a normal success response. (Previously the schema rejected
    // non-empty values, which exposed a 400 to bots instead of the intended
    // silent-accept behaviour and made the honeypot check unreachable.)
    const parsed = publicSubmissionSchema.safeParse({ ...valid, company: 'spammy-bot' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.company).toBe('spammy-bot')
    }
  })
  it('rejects missing names and oversized messages', () => {
    expect(publicSubmissionSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
    expect(publicSubmissionSchema.safeParse({ ...valid, message: 'x'.repeat(4001) }).success).toBe(false)
  })
  it('rejects unknown form types', () => {
    expect(publicSubmissionSchema.safeParse({ ...valid, type: 'SPAM' }).success).toBe(false)
  })
})

describe('page create schema', () => {
  it('accepts title with optional slug', () => {
    expect(pageCreateSchema.safeParse({ title: 'Children’s Church' }).success).toBe(true)
    expect(pageCreateSchema.safeParse({ title: 'Youth', slug: 'youth' }).success).toBe(true)
  })
  it('rejects empty titles and bad paths', () => {
    expect(pageCreateSchema.safeParse({ title: '' }).success).toBe(false)
    expect(pageCreateSchema.safeParse({ title: 'Youth', slug: 'Youth Group!' }).success).toBe(false)
  })
})
