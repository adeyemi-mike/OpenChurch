/**
 * Grant platform-administrator rights to an existing user account.
 *
 * Self-hosters: register your own account through the UI first, then run
 *
 *     bun scripts/promote-admin.ts you@example.com
 *
 * Platform admins can suspend/reactivate churches and reset user passwords
 * from the /admin console. Every use of this script should be logged.
 *
 * (The development seed also creates admin@openchurch.dev — demo data only,
 * never run the seed in production.)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Usage: bun scripts/promote-admin.ts <email>')
    console.error('Example: bun scripts/promote-admin.ts you@example.com')
    process.exit(1)
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`No account found for ${email}.`)
    console.error('Register the account through the website first, then re-run this script.')
    process.exit(1)
  }
  if (user.isPlatformAdmin) {
    console.log(`${email} is already a platform administrator.`)
    return
  }

  await db.user.update({ where: { id: user.id }, data: { isPlatformAdmin: true } })
  await db.auditLog.create({
    data: {
      churchId: null,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'platform.admin_granted',
      entityType: 'user',
      entityId: user.id,
      metadata: JSON.stringify({ via: 'scripts/promote-admin.ts' }),
    },
  })
  console.log(`✓ ${email} is now a platform administrator. Sign in and visit /admin.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
