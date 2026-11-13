import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Liveness + database readiness probe (used by the Docker healthcheck). */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, service: 'openchurch', db: 'up' })
  } catch {
    return NextResponse.json({ ok: false, service: 'openchurch', db: 'down' }, { status: 503 })
  }
}
