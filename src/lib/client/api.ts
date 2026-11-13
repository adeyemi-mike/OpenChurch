'use client'

/** Typed client fetch helper for the OpenChurch API. */

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
  }
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string; code?: string } }

export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  // FormData bodies must NOT get a JSON content type — the browser sets the
  // multipart boundary itself.
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const method = (init?.method ?? 'GET').toUpperCase()
  const unsafe = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)

  // CSRF double-submit: echo the non-httpOnly csrf cookie in a header so
  // state-changing requests can be verified even behind proxies that rewrite
  // the Host header (see src/lib/auth/csrf.ts).
  let csrfToken: string | undefined
  if (unsafe && typeof document !== 'undefined') {
    csrfToken = document.cookie
      .split('; ')
      .find((c) => c.startsWith('openchurch_csrf='))
      ?.split('=')[1]
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...init?.headers,
    },
  })
  let payload: ApiResponse<T> | null = null
  try {
    payload = (await res.json()) as ApiResponse<T>
  } catch {
    throw new ApiClientError(res.status, 'Unexpected server response.')
  }
  if (!res.ok || !payload.ok) {
    const message = payload && !payload.ok ? payload.error.message : 'Request failed.'
    const code = payload && !payload.ok ? payload.error.code : undefined
    throw new ApiClientError(res.status, message, code)
  }
  return payload.data
}
