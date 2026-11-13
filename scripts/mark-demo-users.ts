/**
 * mark-demo-users.ts — idempotent backfill for databases that were seeded
 * before the `User.isDemo` flag existed.
 *
 * Marks the known demonstration-seed accounts (see src/lib/demo-mode.ts and
 * prisma/seed.ts) as isDemo=true so the server-side demo gate applies to
 * them. Never touches any other account. Safe to run repeatedly.
 *
 * Run with: bun scripts/mark-demo-users.ts
 */
import { PrismaClient } from '@prisma/client'

const DEMO_EMAILS = [
  'admin@openchurch.dev',
  'owner@grace.demo',
  'editor@grace.demo',
  'author@grace.demo',
  'owner@emmanuel.demo',
]

async function main() {
  const db = new PrismaClient()
  try {
    const result = await db.user.updateMany({
      where: { email: { in: DEMO_EMAILS } },
      data: { isDemo: true },
    })
    console.log(`[mark-demo-users] flagged ${result.count} demonstration account(s)`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error('[mark-demo-users] failed:', err)
  process.exit(1)
})
