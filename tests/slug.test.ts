import { describe, it, expect } from 'vitest'
import { slugify, slugifyOr, isValidPageSlug, uniqueSlug } from '@/lib/slug'

describe('slugify', () => {
  it('handles plain names', () => {
    expect(slugify('Grace Community Church')).toBe('grace-community-church')
  })
  it('strips accents and punctuation', () => {
    expect(slugify('St. Patrick’s Church — Lagos!')).toBe('st-patricks-church-lagos')
    expect(slugify('Café Église')).toBe('cafe-eglise')
  })
  it('collapses repeats and trims dashes', () => {
    expect(slugify('  hello   world  ')).toBe('hello-world')
    expect(slugify('--a--b--')).toBe('a-b')
  })
  it('caps length at 60', () => {
    expect(slugify('a'.repeat(100)).length).toBe(60)
  })
  it('falls back with slugifyOr', () => {
    expect(slugifyOr('!!!', 'church')).toMatch(/^church-[a-z0-9]+$/)
    expect(slugifyOr('Valid Name', 'x')).toBe('valid-name')
  })
})

describe('isValidPageSlug', () => {
  it('accepts homepage and simple paths', () => {
    expect(isValidPageSlug('')).toBe(true)
    expect(isValidPageSlug('about')).toBe(true)
    expect(isValidPageSlug('get-involved/youth')).toBe(true)
  })
  it('rejects invalid paths', () => {
    expect(isValidPageSlug('About')).toBe(false)
    expect(isValidPageSlug('about us')).toBe(false)
    expect(isValidPageSlug('/about')).toBe(false)
    expect(isValidPageSlug('about/')).toBe(false)
    expect(isValidPageSlug('a--b')).toBe(false)
    expect(isValidPageSlug('x'.repeat(101))).toBe(false)
  })
})

describe('uniqueSlug', () => {
  it('returns the slug when free', () => {
    expect(uniqueSlug('home', () => false)).toBe('home')
  })
  it('appends -2, -3… when taken', () => {
    expect(uniqueSlug('home', (s) => s === 'home')).toBe('home-2')
    expect(uniqueSlug('home', (s) => s === 'home' || s === 'home-2')).toBe('home-3')
  })
  it('falls back to a random suffix when exhausted', () => {
    const slug = uniqueSlug('home', () => true)
    expect(slug).toMatch(/^home-[a-z0-9]{4}$/)
  })
})
