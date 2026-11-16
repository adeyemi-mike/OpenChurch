import { describe, it, expect } from 'vitest'
import { VercelDomainProvider, ManualDomainProvider, getDomainProvider } from '@/lib/domains/provider'

/**
 * Hosting-provider adapter — Vercel REST client with an injected fetch.
 * TRUTHFULNESS RULE: provider API errors must surface as errors, never
 * degrade into a success state.
 */

function makeFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const res = handler(url.toString(), init)
    return new Response(JSON.stringify(res.body), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

const okCfg = { token: 't', projectId: 'p1' }

describe('VercelDomainProvider.addDomain', () => {
  it('returns ok on HTTP 200 and captures the provider uid', async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch(() => ({ status: 200, body: { name: 'd.example', uid: 'dom_uid_123' } })),
    })
    expect(await p.addDomain('d.example')).toEqual({ ok: true, providerRef: 'dom_uid_123' })
  })

  it('returns ok with a null providerRef when the API omits the uid', async () => {
    const p = new VercelDomainProvider({ ...okCfg, fetchImpl: makeFetch(() => ({ status: 200, body: { name: 'd' } })) })
    const res = await p.addDomain('d.example')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.providerRef).toBeNull()
  })

  it('surfaces a conflict (409) as an error naming the other project', async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch(() => ({ status: 409, body: { error: { message: 'Domain already in use by project X' } } })),
    })
    const res = await p.addDomain('d.example')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('already')
  })

  it('surfaces auth failure (401) — never a fake success', async () => {
    const p = new VercelDomainProvider({ ...okCfg, fetchImpl: makeFetch(() => ({ status: 401, body: {} })) })
    const res = await p.addDomain('d.example')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('token')
  })

  it('rejects on network failure', async () => {
    const failing = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const p = new VercelDomainProvider({ ...okCfg, fetchImpl: failing })
    await expect(p.addDomain('d.example')).rejects.toThrow()
  })
})

describe('VercelDomainProvider.inspectDomain', () => {
  it('parses a fully verified, configured subdomain (CNAME from /v4 config)', async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch((url) =>
        url.includes('/v4/domains/')
          ? {
              status: 200,
              body: { misconfigured: false, recommendedCNAME: [{ rank: 1, value: 'cname.vercel-dns.com' }] },
            }
          : { status: 200, body: { verified: true, apexName: 'd.example' } }
      ),
    })
    const s = await p.inspectDomain('www.d.example')
    expect(s.assigned).toBe(true)
    expect(s.dnsConfigured).toBe(true)
    expect(s.requiredRecords).toEqual([
      { type: 'CNAME', name: 'www.d.example', value: 'cname.vercel-dns.com', note: 'Recommended by the Vercel API for this domain.' },
    ])
  })

  it('parses an apex domain A record from the /v4 config endpoint', async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch((url) =>
        url.includes('/v4/domains/')
          ? { status: 200, body: { misconfigured: false, recommendedIPv4: [{ rank: 1, value: '76.76.21.21' }] } }
          : { status: 200, body: { verified: true, apexName: 'd.example' } }
      ),
    })
    const s = await p.inspectDomain('d.example')
    expect(s.assigned).toBe(true)
    expect(s.requiredRecords[0].type).toBe('A')
    expect(s.requiredRecords[0].name).toBe('@')
    expect(s.requiredRecords[0].value).toBe('76.76.21.21')
  })

  it("falls back to Vercel's published default records (clearly labelled) when the API returns none", async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch((url) =>
        url.includes('/v4/domains/')
          ? { status: 200, body: { misconfigured: false } }
          : { status: 200, body: { verified: true, apexName: 'd.example' } }
      ),
    })
    const apex = await p.inspectDomain('d.example')
    expect(apex.requiredRecords[0]).toMatchObject({ type: 'A', name: '@', value: '76.76.21.21' })
    expect(apex.requiredRecords[0].note).toContain('published default')

    const p2 = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch((url) =>
        url.includes('/v4/domains/')
          ? { status: 200, body: { misconfigured: false } }
          : { status: 200, body: { verified: true, apexName: 'd.example' } }
      ),
    })
    const sub = await p2.inspectDomain('www.d.example')
    expect(sub.requiredRecords[0]).toMatchObject({ type: 'CNAME', name: 'www.d.example', value: 'cname.vercel-dns.com' })
    expect(sub.requiredRecords[0].note).toContain('published default')
  })

  it('reports unassigned AND missing for HTTP 404', async () => {
    const p = new VercelDomainProvider({ ...okCfg, fetchImpl: makeFetch(() => ({ status: 404, body: {} })) })
    const s = await p.inspectDomain('d.example')
    expect(s.assigned).toBe(false)
    expect(s.missing).toBe(true)
    expect(s.error).toContain('not attached')
  })

  it('parses config.suggestedValues (the real Vercel API field) into required records', async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch(() => ({
        status: 200,
        body: {
          verified: true,
          uid: 'dom_uid_456',
          config: {
            misconfigured: false,
            suggestedValues: [
              { type: 'A', name: '@', value: '76.76.21.21' },
              { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' },
            ],
          },
        },
      })),
    })
    const s = await p.inspectDomain('gracecommunity.org')
    expect(s.assigned).toBe(true)
    expect(s.dnsConfigured).toBe(true)
    expect(s.providerRef).toBe('dom_uid_456')
    expect(s.missing).toBe(false)
    expect(s.requiredRecords).toEqual([
      { type: 'A', name: '@', value: '76.76.21.21', note: 'Set on the apex/root domain at your DNS provider.' },
      { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com', note: 'Set at your DNS provider.' },
    ])
  })

  it('prefers suggestedValues over legacy field names when both exist', async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch(() => ({
        status: 200,
        body: {
          verified: false,
          verification: [{ type: 'TXT', domain: '_vercel', value: 'vc-domain-verify=abc' }],
          config: { misconfigured: false, suggestedValues: [{ type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' }] },
        },
      })),
    })
    const s = await p.inspectDomain('www.gracecommunity.org')
    expect(s.assigned).toBe(false)
    expect(s.missing).toBe(false)
    const types = s.requiredRecords.map((r) => r.type)
    expect(types).toContain('CNAME')
    expect(types).toContain('TXT') // Vercel's own verification record is surfaced
  })

  it('degrades honestly when the supplementary /v4 config call fails', async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch((url) =>
        url.includes('/v4/domains/')
          ? { status: 500, body: {} }
          : { status: 200, body: { verified: true, apexName: 'd.example' } }
      ),
    })
    const s = await p.inspectDomain('d.example')
    expect(s.assigned).toBe(true)
    // No config data → the published default record, labelled as such.
    expect(s.requiredRecords[0].note).toContain('published default')
  })

  it('reports misconfiguration honestly (no green state)', async () => {
    const p = new VercelDomainProvider({
      ...okCfg,
      fetchImpl: makeFetch(() => ({
        status: 200,
        body: { verified: true, config: { misconfigured: true }, verificationError: 'No DNS record found' },
      })),
    })
    const s = await p.inspectDomain('d.example')
    expect(s.assigned).toBe(true)
    expect(s.dnsConfigured).toBe(false)
    expect(s.error).toBe('No DNS record found')
  })
})

describe('VercelDomainProvider.removeDomain', () => {
  it('treats 404 as success (idempotent)', async () => {
    const p = new VercelDomainProvider({ ...okCfg, fetchImpl: makeFetch(() => ({ status: 404, body: {} })) })
    expect(await p.removeDomain('d.example')).toEqual({ ok: true })
  })
  it('surfaces other failures', async () => {
    const p = new VercelDomainProvider({ ...okCfg, fetchImpl: makeFetch(() => ({ status: 500, body: {} })) })
    const res = await p.removeDomain('d.example')
    expect(res.ok).toBe(false)
  })
})

describe('ManualDomainProvider', () => {
  it('provides manual instructions and never claims automated truth', async () => {
    const p = new ManualDomainProvider()
    expect(p.kind).toBe('manual')
    expect(p.automated).toBe(false)
    const s = await p.inspectDomain('d.example')
    expect(s.assigned).toBe(false)
    expect(s.requiredRecords[0].note).toContain('no hosting-provider API')
  })
})

describe('getDomainProvider (configuration)', () => {
  it('uses the Vercel adapter when fully configured', () => {
    const prevToken = process.env.VERCEL_TOKEN
    const prevProject = process.env.VERCEL_PROJECT_ID
    process.env.VERCEL_TOKEN = 't'
    process.env.VERCEL_PROJECT_ID = 'p'
    try {
      expect(getDomainProvider()?.kind).toBe('vercel')
    } finally {
      if (prevToken === undefined) delete process.env.VERCEL_TOKEN
      else process.env.VERCEL_TOKEN = prevToken
      if (prevProject === undefined) delete process.env.VERCEL_PROJECT_ID
      else process.env.VERCEL_PROJECT_ID = prevProject
    }
  })

  it('falls back to manual when no provider is configured', () => {
    const prevToken = process.env.VERCEL_TOKEN
    const prevProject = process.env.VERCEL_PROJECT_ID
    delete process.env.VERCEL_TOKEN
    delete process.env.VERCEL_PROJECT_ID
    try {
      const p = getDomainProvider()
      expect(p?.kind).toBe('manual')
      expect(p?.configured).toBe(false)
    } finally {
      if (prevToken !== undefined) process.env.VERCEL_TOKEN = prevToken
      if (prevProject !== undefined) process.env.VERCEL_PROJECT_ID = prevProject
    }
  })
})
