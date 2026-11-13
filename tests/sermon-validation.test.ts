import { describe, it, expect } from 'vitest'
import { sermonSchema, givingSettingsSchema, publicSubmissionSchema } from '@/lib/validation/entities'

/**
 * Media URL validation — the public site renders players/links directly
 * from these fields, so only safe, genuine sources may be stored.
 */

const base = {
  title: 'A sermon title',
  speakerName: 'The Preacher',
  preachedAt: '2026-11-01',
}

describe('sermon media URL validation', () => {
  it('accepts empty media (no fake players are rendered then)', () => {
    const r = sermonSchema.safeParse({ ...base, videoUrl: '', audioUrl: '', notesUrl: '' })
    expect(r.success).toBe(true)
  })

  it('accepts genuine YouTube / Vimeo video URLs', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://vimeo.com/123456789',
    ]) {
      const r = sermonSchema.safeParse({ ...base, videoUrl: url })
      expect(r.success, url).toBe(true)
    }
  })

  it('rejects non-embeddable or unsafe video URLs', () => {
    for (const url of [
      'not-a-url',
      'http://youtube.com/watch?v=x', // insecure
      'https://attacker.example/player',
      'javascript:alert(1)',
    ]) {
      const r = sermonSchema.safeParse({ ...base, videoUrl: url })
      expect(r.success, url).toBe(false)
    }
  })

  it('requires http(s) for audio, notes and image URLs', () => {
    expect(sermonSchema.safeParse({ ...base, audioUrl: 'https://cdn.example/a.mp3' }).success).toBe(true)
    expect(sermonSchema.safeParse({ ...base, audioUrl: 'ftp://cdn.example/a.mp3' }).success).toBe(false)
    expect(sermonSchema.safeParse({ ...base, notesUrl: 'https://example.com/notes.pdf' }).success).toBe(true)
    expect(sermonSchema.safeParse({ ...base, notesUrl: 'javascript:void(0)' }).success).toBe(false)
    expect(sermonSchema.safeParse({ ...base, imageUrl: 'https://example.com/i.jpg' }).success).toBe(true)
    expect(sermonSchema.safeParse({ ...base, imageUrl: 'not-a-url' }).success).toBe(false)
  })
})

describe('giving settings validation', () => {
  it('requires a real URL for external payment destinations', () => {
    const ok = givingSettingsSchema.safeParse({ externalUrl: 'https://paystack.shop/pay/church' })
    expect(ok.success).toBe(true)
    const bad = givingSettingsSchema.safeParse({ externalUrl: 'not-a-url' })
    expect(bad.success).toBe(false)
    expect(givingSettingsSchema.safeParse({ isDemo: true }).success).toBe(true)
  })
})

describe('public submission schema (honeypot)', () => {
  it('accepts but never stores the honeypot value — bots get a normal response', () => {
    const r = publicSubmissionSchema.safeParse({
      type: 'CONTACT',
      name: 'Bot',
      message: 'spam',
      company: 'bot-signature',
    })
    expect(r.success).toBe(true)
    expect(r.success && r.data.company).toBe('bot-signature')
  })
})
