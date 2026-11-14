/**
 * OpenChurch development seed.
 *
 * Creates two complete demo churches (clearly labelled as demo content):
 *   1. Grace Community Church — Lagos, Nigeria (Contemporary Vibrant theme)
 *   2. Emmanuel Parish Church — Manchester, UK (Traditional Elegant theme)
 *
 * Demo accounts (password for all: Demo1234!):
 *   admin@openchurch.dev      Platform Super Administrator
 *   owner@grace.demo          Grace Community Church — Owner
 *   editor@grace.demo         Grace Community Church — Editor
 *   author@grace.demo         Grace Community Church — Author
 *   owner@emmanuel.demo       Emmanuel Parish Church — Owner
 *
 * Run with: bun prisma/seed.ts   (or: bun run db:seed)
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const db = new PrismaClient()

const DEMO_PASSWORD = 'Demo1234!'
const STORAGE_ROOT = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.join(process.cwd(), 'storage', 'uploads')

// Photography for demo content (OSS-rehosted, embeddable; sourced via the
// platform's image search service for demo purposes only).
const IMG = {
  worshipHero: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/1c1e3c1cd78d.jpg',
  worshipWide: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/74d2cd3068a2.webp',
  worshipNight: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/640b77884328.jpg',
  stageBand: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/52a8b5bb2844.jpg',
  children: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/eca4144464d4.jpg',
  youth: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/de272b9120fe.jpg',
  outreach: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f8a1dc224251.jpg',
  community: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/64703b030fa6.jpg',
  bibleStudy: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ca9f61f5724a.png',
  bibleStill: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/07b411ab6d01.jpg',
  traditionalHero: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/58d4ee4f3b25.jpg',
  traditionalPews: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0291c9c5acc0.jpg',
  traditionalLight: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/13ed51313ee4.jpeg',
  churchExt: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8cdbb2d71f87.jpg',
  modernChurch: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/039ca9968d99.jpg',
}

function makeLogoSvg(name: string, primary: string, variant: 'cross' | 'arch'): string {
  const initials = name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  const mark =
    variant === 'cross'
      ? `<rect x="46" y="18" width="8" height="64" rx="2" fill="${primary}"/><rect x="28" y="38" width="44" height="8" rx="2" fill="${primary}"/>`
      : `<path d="M50 14 C30 14 18 28 18 46 L18 86 L82 86 L82 46 C82 28 70 14 50 14 Z" fill="none" stroke="${primary}" stroke-width="7"/><rect x="44" y="8" width="12" height="22" rx="3" fill="${primary}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${name} logo">
  <rect width="100" height="100" rx="20" fill="none"/>
  ${mark}
  <text x="50" y="72" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="${primary}">${initials}</text>
</svg>`
}

async function putAsset(opts: {
  churchId: string
  fileName: string
  buffer: Buffer
  mimeType: string
  kind: 'IMAGE' | 'DOCUMENT'
  altText: string
  uploadedById: string
  folder?: string
}) {
  const storedName = `${randomUUID().replace(/-/g, '').slice(0, 16)}-${opts.fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .slice(-40)}`
  const key = `${opts.churchId}/${storedName}`
  const full = path.join(STORAGE_ROOT, key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, opts.buffer)
  return db.mediaAsset.create({
    data: {
      churchId: opts.churchId,
      fileName: opts.fileName,
      storedName,
      mimeType: opts.mimeType,
      kind: opts.kind,
      sizeBytes: opts.buffer.byteLength,
      altText: opts.altText,
      folder: opts.folder ?? 'Demo content',
      visibility: 'PUBLIC',
      uploadedById: opts.uploadedById,
    },
  })
}

async function download(url: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
  const ext = mimeType.includes('webp') ? 'webp' : mimeType.includes('png') ? 'png' : 'jpg'
  const fileName = url.split('/').pop()?.split('.')[0] + '.' + ext
  return { buffer, mimeType: mimeType.split(';')[0], fileName }
}

const mediaUrl = (id: string) => `/api/media/${id}/file`

/** The next upcoming Remembrance Sunday (2nd Sunday of November), 10:00 UTC. */
function nextRemembranceSunday(): Date {
  const forYear = (year: number) => {
    const d = new Date(Date.UTC(year, 10, 1))
    // First Sunday of November: advance (7 - weekday) % 7 days — 0 when
    // 1 November is already a Sunday (the old `|| 7` skipped a week and
    // produced the 4th Sunday instead of the 2nd).
    d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7))
    const secondSunday = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000)
    secondSunday.setUTCHours(10, 0, 0, 0) // service starts 10:00 UTC
    return secondSunday
  }
  const now = new Date()
  const thisYear = forYear(now.getFullYear())
  // Service runs 10:00–12:00 UTC; once it has ended, roll to next year's.
  if (new Date(thisYear.getTime() + 2 * 60 * 60 * 1000) <= now) return forYear(now.getFullYear() + 1)
  return thisYear
}

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function main() {
  // Demo seeding is opt-in AND requires server-side demonstration mode.
  // The canonical rule lives in src/lib/demo-mode.ts (cannot be imported
  // here — this script runs outside Next; keep both in sync):
  //   DEMO_MODE unset  → ON in development, OFF in production (fail safe).
  //   DEMO_MODE=true   → explicit opt-in for hosted demo deployments.
  // SEED_DEMO_DATA=true additionally opts in content creation. A real
  // production instance therefore never seeds demonstration accounts.
  const demoMode = (
    process.env.DEMO_MODE ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')
  )
    .trim()
    .toLowerCase() === 'true'
  const seedDemoDefault = demoMode ? 'true' : 'false'
  const seedDemo = (process.env.SEED_DEMO_DATA ?? seedDemoDefault).toLowerCase() === 'true'
  if (!seedDemo) {
    console.log('🌱 Demo seed skipped (demonstration mode disabled / SEED_DEMO_DATA not "true").')
    console.log('   (Production instances start clean; users register via /register.)')
    return
  }

  console.log('🌱 Seeding OpenChurch…')

  // --- Clean slate (FK-safe order) -----------------------------------------
  await db.auditLog.deleteMany()
  await db.formSubmission.deleteMany()
  await db.form.deleteMany()
  await db.givingCategory.deleteMany()
  await db.givingSettings.deleteMany()
  await db.sermon.deleteMany()
  await db.sermonSeries.deleteMany()
  await db.event.deleteMany()
  await db.service.deleteMany()
  await db.location.deleteMany()
  await db.leader.deleteMany()
  await db.ministry.deleteMany()
  await db.navigationMenu.deleteMany()
  await db.websitePage.deleteMany()
  await db.churchSettings.deleteMany()
  await db.churchDomain.deleteMany()
  await db.churchMembership.deleteMany()
  await db.church.deleteMany()
  await db.session.deleteMany()
  await db.user.deleteMany()
  await db.mediaAsset.deleteMany()

  // --- Users -----------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 11)
  // Every account created here is flagged isDemo — the authoritative marker
  // used by the auth system to reject demonstration accounts when demo mode
  // is disabled. The platform-administrator account is created with a RANDOM
  // password (printed once to the server console) and the isDemo flag, so in
  // a production configuration (DEMO_MODE=false) it cannot authenticate at
  // all and no demonstration account can wield platform-admin privileges.
  const adminPassword = crypto.randomBytes(18).toString('base64url')
  const users = {
    admin: await db.user.create({
      data: { email: 'admin@openchurch.dev', name: 'Platform Administrator', passwordHash: await bcrypt.hash(adminPassword, 11), isPlatformAdmin: true, isDemo: true },
    }),
    graceOwner: await db.user.create({
      data: { email: 'owner@grace.demo', name: 'Rev. Daniel Adeyemi', passwordHash, isDemo: true },
    }),
    graceEditor: await db.user.create({
      data: { email: 'editor@grace.demo', name: 'Sarah Okonkwo', passwordHash, isDemo: true },
    }),
    graceAuthor: await db.user.create({
      data: { email: 'author@grace.demo', name: 'Tunde Balogun', passwordHash, isDemo: true },
    }),
    emmanuelOwner: await db.user.create({
      data: { email: 'owner@emmanuel.demo', name: 'Revd. Elizabeth Grant', passwordHash, isDemo: true },
    }),
  }

  // === CHURCH 1: Grace Community Church (Lagos, NG — vibrant) ================
  const grace = await db.church.create({
    data: {
      slug: 'grace-community',
      isDemo: true,
      name: 'Grace Community Church',
      denomination: 'Non-denominational',
      country: 'NG',
      region: 'Lagos State',
      city: 'Lagos',
      address: '12 Admiralty Way, Lekki Phase 1',
      phone: '+234 801 234 5678',
      email: 'hello@gracecommunity.demo',
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      dateFormat: 'medium',
      description:
        'A growing family in Lagos learning to love God, love people and make a difference.',
      foundedYear: 2009,
      isPublished: true,
      publishedAt: new Date(),
      onboardingCompleted: true,
      onboardingStep: 5,
      status: 'ACTIVE',
    },
  })

  await db.churchMembership.createMany({
    data: [
      { churchId: grace.id, userId: users.graceOwner.id, role: 'OWNER' },
      { churchId: grace.id, userId: users.graceEditor.id, role: 'EDITOR' },
      { churchId: grace.id, userId: users.graceAuthor.id, role: 'AUTHOR' },
    ],
  })

  // Media (downloads)
  const fetchImg = async (url: string, fileName: string, alt: string, folder = 'Demo content') => {
    const { buffer, mimeType } = await download(url)
    const asset = await putAsset({
      churchId: grace.id,
      fileName,
      buffer,
      mimeType,
      kind: 'IMAGE',
      altText: alt,
      uploadedById: users.graceOwner.id,
      folder,
    })
    return mediaUrl(asset.id)
  }

  console.log('   ↓ downloading Grace media…')
  const graceMedia = {
    hero: await fetchImg(IMG.worshipHero, 'worship-hero.jpg', 'Congregation worshipping during a Sunday service', 'Hero & banners'),
    worship: await fetchImg(IMG.worshipWide, 'worship-wide.jpg', 'Church members singing together', 'Ministries'),
    children: await fetchImg(IMG.children, 'children.jpg', 'Children learning in Sunday school', 'Ministries'),
    youth: await fetchImg(IMG.youth, 'youth.jpg', 'Youth group members together', 'Ministries'),
    outreach: await fetchImg(IMG.outreach, 'outreach.jpg', 'Volunteers serving the community', 'Ministries'),
    band: await fetchImg(IMG.stageBand, 'band.jpg', 'Worship team on stage', 'Ministries'),
    night: await fetchImg(IMG.worshipNight, 'worship-night.jpg', 'Worship night with raised hands', 'Events'),
    community: await fetchImg(IMG.community, 'community.jpg', 'Community outreach day', 'Events'),
    bible: await fetchImg(IMG.bibleStudy, 'bible-study.jpg', 'Small group Bible study', 'Ministries'),
    modern: await fetchImg(IMG.modernChurch, 'church-building.jpg', 'Church building exterior', 'About'),
  }

  const graceLogo = await putAsset({
    churchId: grace.id,
    fileName: 'grace-logo.svg',
    buffer: Buffer.from(makeLogoSvg('Grace Community', '#0B6E4F', 'cross')),
    mimeType: 'image/svg+xml',
    kind: 'IMAGE',
    altText: 'Grace Community Church logo',
    uploadedById: users.graceOwner.id,
    folder: 'Branding',
  })

  await db.churchSettings.create({
    data: {
      churchId: grace.id,
      themeKey: 'vibrant',
      primaryColor: '#0B6E4F',
      secondaryColor: '#D97706',
      fontKey: 'display',
      logoUrl: mediaUrl(graceLogo.id),
      heroImageUrl: graceMedia.hero,
      footerText:
        'Grace Community Church is a family in Lagos learning to love God, love people and make a difference. Everyone is welcome.',
      copyrightLine: '© Grace Community Church. Demo content for illustration.',
      socialInstagram: null,
      socialYoutube: null,
      whatsappNumber: '+2348012345678',
      mapEmbedUrl:
        'https://www.google.com/maps?q=Admiralty+Way+Lekki+Lagos&output=embed',
      defaultSeoTitle: 'Grace Community Church — Lagos',
      defaultSeoDescription:
        'Join us in Lekki, Lagos for worship, community and the preaching of God’s word. Sundays 8:00 & 10:30.',
      announcementText: 'Youth Weekend Away — registrations close Sunday! 🎉',
      announcementEnabled: true,
    },
  })

  await db.givingSettings.create({
    data: {
      churchId: grace.id,
      isEnabled: true,
      isDemo: true,
      mode: 'EXTERNAL',
      provider: 'PAYSTACK',
      externalUrl: 'https://paystack.shop/demo-giving-link',
      customText:
        'Give securely online via Paystack, or during any service. Every gift is prayerfully stewarded.',
    },
  })
  await db.givingCategory.createMany({
    data: [
      { churchId: grace.id, name: 'Tithes', slug: 'tithes', description: 'The first tenth, honouring the Lord.', sortOrder: 1 },
      { churchId: grace.id, name: 'Offerings', slug: 'offerings', description: 'Freewill offerings given in worship.', sortOrder: 2 },
      { churchId: grace.id, name: 'Missions', slug: 'missions', description: 'Supporting church planters across West Africa.', sortOrder: 3 },
      { churchId: grace.id, name: 'Building Fund', slug: 'building-fund', description: 'Our permanent home project in Ibeju-Lekki.', sortOrder: 4 },
      { churchId: grace.id, name: 'Special Projects', slug: 'special-projects', description: 'Seasonal needs: outreach, welfare and more.', sortOrder: 5 },
    ],
  })

  // System forms
  const formDefs = [
    { type: 'CONTACT', title: 'Contact us', description: 'Questions, prayer or anything else — we would love to hear from you.', success: 'Thank you! Your message has been received; we will reply soon.' },
    { type: 'PRAYER', title: 'Prayer request', description: 'Share a prayer need — kept confidential, seen only by pastoral staff.', success: 'Your request has been received and will be held in confidence.' },
    { type: 'COUNSELLING', title: 'Counselling request', description: 'Request a confidential conversation with a pastoral counsellor.', success: 'Thank you. Someone from the pastoral team will reach out privately.' },
    { type: 'TESTIMONY', title: 'Share a testimony', description: 'Tell us what God is doing in your life.', success: 'Thank you for sharing your story with us!' },
    { type: 'FOLLOWUP', title: 'New visitor follow-up', description: 'First time with us? Let us know so we can welcome you properly.', success: 'Welcome home! We will be in touch during the week.' },
    { type: 'REGISTRATION', title: 'Event registration', description: 'Register for an upcoming event.', success: 'You are registered. See you there!' },
  ]
  for (const f of formDefs) {
    await db.form.create({
      data: {
        churchId: grace.id,
        type: f.type,
        title: f.title,
        description: f.description,
        successMessage: f.success,
        isActive: f.type !== 'REGISTRATION',
      },
    })
  }

  // Ministries
  const graceMinistries = [
    { name: 'Worship & Music', description: 'Leading the church into God’s presence through song and skillful playing.', leaderName: 'Tunde Balogun', meetingTime: 'Thursdays 6:30pm', image: graceMedia.worship, sortOrder: 1 },
    { name: 'Children’s Church', description: 'Safe, joyful Bible teaching for ages 2–11 every Sunday.', leaderName: 'Sarah Okonkwo', meetingTime: 'Sundays 10:30am', image: graceMedia.children, sortOrder: 2 },
    { name: 'Youth Ministry', description: 'Raising a generation of passionate disciples — ages 12–18.', leaderName: 'Samuel Okoro', meetingTime: 'Saturdays 4:00pm', image: graceMedia.youth, sortOrder: 3 },
    { name: 'Outreach & Missions', description: 'Serving our city and planting churches across West Africa.', leaderName: 'Deacon Faith Nwosu', meetingTime: '2nd Saturday monthly', image: graceMedia.outreach, sortOrder: 4 },
    { name: 'Media & Sound', description: 'Excellent sound, visuals and livestream for every gathering.', leaderName: 'Michael Eze', meetingTime: 'Sundays 7:00am', image: graceMedia.band, sortOrder: 5 },
    { name: 'Bible Study Groups', description: 'Midweek small groups across Lagos for fellowship and the word.', leaderName: 'Rev. Daniel Adeyemi', meetingTime: 'Wednesdays 6:30pm', image: graceMedia.bible, sortOrder: 6 },
  ]
  for (const m of graceMinistries) {
    await db.ministry.create({
      data: {
        churchId: grace.id,
        name: m.name,
        slug: m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: m.description,
        leaderName: m.leaderName,
        meetingTime: m.meetingTime,
        imageUrl: m.image,
        status: 'PUBLISHED',
        sortOrder: m.sortOrder,
      },
    })
  }

  // Leaders
  const graceLeaders = [
    { name: 'Rev. Daniel Adeyemi', title: 'Senior Pastor', bio: 'Daniel trained in Lagos and Edinburgh and has led Grace Community since 2009. He loves good jollof, long books and seeing lives transformed by the gospel.', sortOrder: 1 },
    { name: 'Pastor Grace Adeyemi', title: 'Co-Pastor, Women & Family', bio: 'Grace oversees the women’s ministry and counselling team, and hosts the monthly Sisters’ Fellowship.', sortOrder: 2 },
    { name: 'Samuel Okoro', title: 'Youth Pastor', bio: 'Samuel leads the youth ministry and schools outreach across Lekki.', sortOrder: 3 },
    { name: 'Sarah Okonkwo', title: 'Children’s Ministry Lead', bio: 'Sarah and her team make Sundays the best hour of every child’s week.', sortOrder: 4 },
    { name: 'Michael Eze', title: 'Head of Media', bio: 'Michael makes the gospel look and sound excellent — livestream, podcast and social.', sortOrder: 5 },
    { name: 'Deacon Faith Nwosu', title: 'Prayer Coordinator', bio: 'Faith leads the prayer band and the dawn prayer line.', sortOrder: 6 },
  ]
  for (const l of graceLeaders) {
    await db.leader.create({
      data: { churchId: grace.id, name: l.name, title: l.title, bio: l.bio, status: 'PUBLISHED', sortOrder: l.sortOrder },
    })
  }

  // Locations & services
  const graceMain = await db.location.create({
    data: { churchId: grace.id, name: 'Main Auditorium, Lekki', address: '12 Admiralty Way, Lekki Phase 1', city: 'Lagos', country: 'NG', isPrimary: true },
  })
  const graceAnnex = await db.location.create({
    data: { churchId: grace.id, name: 'Ibeju-Lekki Annex', address: '4 Market Road, Ibeju-Lekki', city: 'Lagos', country: 'NG', isPrimary: false },
  })
  const graceServices = [
    { name: 'Sunday Early Service', dayOfWeek: 0, startTime: '08:00', endTime: '09:45', notes: 'Worship, word & communion (first Sundays)', locationId: graceMain.id },
    { name: 'Sunday Celebration Service', dayOfWeek: 0, startTime: '10:30', endTime: '12:30', notes: 'Kids church available for ages 2–11', locationId: graceMain.id },
    { name: 'Wednesday Prayer Gathering', dayOfWeek: 3, startTime: '18:00', endTime: '19:15', notes: '', locationId: graceMain.id },
    { name: 'Friday Bible Study', dayOfWeek: 5, startTime: '18:30', endTime: '20:00', notes: 'Also streamed online', locationId: graceAnnex.id },
  ]
  for (const s of graceServices) {
    await db.service.create({ data: { churchId: grace.id, ...s } })
  }

  // Events (relative dates so the demo always shows upcoming events)
  const graceEvents = [
    { title: 'Community Health Outreach', description: 'Free blood pressure checks, health talks and food parcels for our Ibeju-Lekki neighbours. Volunteers welcome from 7:00am.', startsAt: daysFromNow(7, 9), endsAt: daysFromNow(7, 14), locationText: 'Ibeju-Lekki Town Square', imageUrl: graceMedia.outreach, status: 'PUBLISHED' },
    { title: 'New Members Class', description: 'Lunch with the pastors — what we believe, how the church runs and where you fit in.', startsAt: daysFromNow(5, 12), endsAt: daysFromNow(5, 14), locationText: 'Main Auditorium, Lekki', imageUrl: null, status: 'PUBLISHED' },
    { title: 'Youth Weekend Away', description: 'Two days of games, teaching and bonfire worship at the Epe camp. Open to ages 12–18.', startsAt: daysFromNow(14, 8), endsAt: daysFromNow(15, 17), locationText: 'Epe Camp & Conference Centre', imageUrl: graceMedia.youth, registrationEnabled: false, status: 'PUBLISHED' },
    { title: 'Night of Wonders — Worship Night', description: 'An uninterrupted night of worship and the word. Come expecting God to move.', startsAt: daysFromNow(21, 18), endsAt: daysFromNow(21, 22), locationText: 'Main Auditorium, Lekki', imageUrl: graceMedia.night, status: 'PUBLISHED' },
    { title: 'Marriage Enrichment Seminar', description: 'For married and engaged couples — communication, finance and intimacy God’s way.', startsAt: daysFromNow(30, 10), endsAt: daysFromNow(30, 14), locationText: 'Main Auditorium, Lekki', imageUrl: null, registrationEnabled: false, status: 'PUBLISHED' },
    { title: 'Community Clean-Up Day', description: 'Loving our city — cleaning the Lekki waterfront together.', startsAt: daysFromNow(-12, 8), endsAt: daysFromNow(-12, 12), locationText: 'Lekki Waterfront', imageUrl: graceMedia.community, status: 'PUBLISHED' },
  ]
  for (const e of graceEvents) {
    await db.event.create({ data: { churchId: grace.id, ...e } })
  }

  // Sermons
  const graceSeries = [
    { title: 'Faith That Moves', description: 'A journey through Hebrews 11.' },
    { title: 'The Kingdom Life', description: 'What life looks like when Jesus is King.' },
  ]
  const seriesIds: Record<string, string> = {}
  for (const s of graceSeries) {
    const row = await db.sermonSeries.create({ data: { churchId: grace.id, ...s } })
    seriesIds[s.title] = row.id
  }
  const graceSermons = [
    { title: 'Faith That Welcomes the Stranger', speakerName: 'Rev. Daniel Adeyemi', preachedAt: daysFromNow(-6, 10), description: 'Abraham welcomed angels without knowing it — hospitality as the doorway of faith.', scriptureRef: 'Hebrews 11:2; Genesis 18', seriesId: seriesIds['Faith That Moves'], videoUrl: null, imageUrl: graceMedia.night, status: 'PUBLISHED' },
    { title: 'Faith That Builds an Ark', speakerName: 'Pastor Grace Adeyemi', preachedAt: daysFromNow(-13, 10), description: 'Noah obeyed a warning nobody could see. What does long obedience look like in Lagos?', scriptureRef: 'Hebrews 11:7', seriesId: seriesIds['Faith That Moves'], videoUrl: null, imageUrl: graceMedia.bible, status: 'PUBLISHED' },
    { title: 'Seek First the Kingdom', speakerName: 'Rev. Daniel Adeyemi', preachedAt: daysFromNow(-20, 10), description: 'Anxiety, provision and the unshakeable priority of God’s rule.', scriptureRef: 'Matthew 6:25–34', seriesId: seriesIds['The Kingdom Life'], videoUrl: null, imageUrl: graceMedia.bible, status: 'PUBLISHED' },
    { title: 'The Poor in Spirit', speakerName: 'Samuel Okoro', preachedAt: daysFromNow(-27, 10), description: 'The surprising doorway into the Kingdom.', scriptureRef: 'Matthew 5:1–12', seriesId: seriesIds['The Kingdom Life'], videoUrl: null, imageUrl: null, status: 'PUBLISHED' },
    { title: 'Faith That Laughs at Impossibility', speakerName: 'Rev. Daniel Adeyemi', preachedAt: daysFromNow(-3, 10), description: 'Sarah laughed, then believed. God’s promises outlive our doubts.', scriptureRef: 'Hebrews 11:11–12', seriesId: seriesIds['Faith That Moves'], videoUrl: null, imageUrl: null, status: 'DRAFT' },
  ]
  for (const s of graceSermons) {
    await db.sermon.create({ data: { churchId: grace.id, ...s } })
  }

  // Pages (sections)
  const hero = (heading: string, sub: string, image: string, alt: string) => ({
    id: randomUUID(), type: 'hero' as const, enabled: true, title: '', subtitle: '',
    background: 'plain' as const, heading, subheading: sub, imageUrl: image, imageAlt: alt,
    overlay: 'dark' as const, align: 'left' as const,
    primaryCta: { label: 'Plan your visit', href: '/what-to-expect' },
    secondaryCta: { label: 'Watch online', href: '/sermons' },
  })

  const graceHome = {
    title: 'Home', slug: '', isHomePage: true, seoTitle: null, seoDescription: null,
    sections: [
      hero('Welcome home.', 'Whoever you are and wherever you are from — there is a seat for you at Grace Community Church this Sunday.', graceMedia.hero, 'Congregation worshipping during a Sunday service'),
      { id: randomUUID(), type: 'services' as const, enabled: true, title: 'When we gather', subtitle: '', background: 'soft' as const, intro: 'Two services every Sunday, and midweek gatherings for prayer and the word.', showLocation: true },
      { id: randomUUID(), type: 'text-image' as const, enabled: true, title: 'A church for the whole family', subtitle: '', background: 'plain' as const, body: 'We are one family learning to **love God, love people and make a difference**.\n\nFrom children’s church to youth ministry to small groups across the city, there is a place for you to belong, grow and serve. Come as you are — we mean it.', imageUrl: graceMedia.worship, imageAlt: 'Church members singing together', imageSide: 'right' as const },
      { id: randomUUID(), type: 'events' as const, enabled: true, title: 'What’s happening', subtitle: '', background: 'plain' as const, maxItems: 3, showPast: false, cta: { label: 'All events', href: '/events' } },
      { id: randomUUID(), type: 'sermons' as const, enabled: true, title: 'Recent sermons', subtitle: '', background: 'soft' as const, maxItems: 3, cta: { label: 'Sermon archive', href: '/sermons' } },
      { id: randomUUID(), type: 'ministries' as const, enabled: true, title: 'Find your place', subtitle: '', background: 'plain' as const, maxItems: 6 },
      { id: randomUUID(), type: 'testimonials' as const, enabled: true, title: 'Stories from our family', subtitle: '', background: 'dark' as const, items: [
        { quote: 'I walked in a stranger and found a family. Grace Community is home now.', name: 'Chidinma O.', role: 'Member since 2019' },
        { quote: 'The youth ministry kept my teenagers grounded through secondary school. I am forever grateful.', name: 'Mr. & Mrs. Adeleke', role: 'Parents' },
        { quote: 'Serving on the outreach team is the most fulfilling thing I do all month.', name: 'Emeka N.', role: 'Outreach volunteer' },
      ] },
      { id: randomUUID(), type: 'cta' as const, enabled: true, title: 'Planning your first visit?', subtitle: '', background: 'accent' as const, body: 'We would love to meet you. Tell us you are coming and we will look out for you — and save you a seat.', button: { label: 'Say hello', href: '/contact' }, style: 'solid' as const },
    ],
  }

  const graceAbout = {
    title: 'About', slug: 'about', isHomePage: false, seoTitle: 'About us', seoDescription: 'Our story, our beliefs and the team God has gathered at Grace Community Church.',
    sections: [
      { id: randomUUID(), type: 'richtext' as const, enabled: true, title: 'Our story', subtitle: '', background: 'plain' as const, body: 'Grace Community Church began in 2009 with twelve friends, one living room in Lekki and a simple conviction: that the gospel is good news for the whole of life.\n\n## What we believe\n\nWe are a Bible-believing, Jesus-centred family. We hold the historic Christian faith — God the Father, Son and Holy Spirit; salvation by grace through faith; the church as Christ’s body; and the certain hope of his return.\n\n## Our mission\n\n> Love God. Love people. Make a difference.\n\nWe pursue that through passionate worship, practical Bible teaching, genuine community and concrete service to our city.' },
      { id: randomUUID(), type: 'gallery' as const, enabled: true, title: 'Life at Grace', subtitle: '', background: 'soft' as const, images: [
        { url: graceMedia.worship, alt: 'Sunday worship', caption: 'Sundays together' },
        { url: graceMedia.children, alt: 'Children’s church', caption: 'Kids church' },
        { url: graceMedia.outreach, alt: 'Community outreach', caption: 'Serving our city' },
        { url: graceMedia.youth, alt: 'Youth ministry', caption: 'Youth gatherings' },
      ] },
      { id: randomUUID(), type: 'leadership' as const, enabled: true, title: 'Meet the team', subtitle: '', background: 'plain' as const, intro: 'A team of pastors, deacons and volunteers who love this church.' },
      { id: randomUUID(), type: 'cta' as const, enabled: true, title: 'Get to know us', subtitle: '', background: 'accent' as const, body: '', button: { label: 'Contact us', href: '/contact' }, style: 'outline' as const },
    ],
  }

  const graceContact = {
    title: 'Contact', slug: 'contact', isHomePage: false, seoTitle: 'Contact us', seoDescription: 'Get in touch with Grace Community Church.',
    sections: [
      { id: randomUUID(), type: 'contact' as const, enabled: true, title: 'Get in touch', subtitle: '', background: 'plain' as const, intro: 'Whether you have a question, a prayer need or just want to say hello — we would love to hear from you.', showForm: true, showMap: true, formType: 'CONTACT' as const },
    ],
  }

  const graceEventsPage = {
    title: 'Events', slug: 'events', isHomePage: false, seoTitle: 'Events', seoDescription: 'Upcoming events at Grace Community Church.',
    sections: [
      { id: randomUUID(), type: 'events' as const, enabled: true, title: 'Upcoming events', subtitle: '', background: 'plain' as const, maxItems: 9, showPast: false, cta: { label: '', href: '' } },
      { id: randomUUID(), type: 'events' as const, enabled: true, title: 'Past events', subtitle: '', background: 'soft' as const, maxItems: 4, showPast: true, cta: { label: '', href: '' } },
    ],
  }

  const graceSermonsPage = {
    title: 'Sermons', slug: 'sermons', isHomePage: false, seoTitle: 'Sermons', seoDescription: 'Watch and listen to sermons from Grace Community Church.',
    sections: [
      { id: randomUUID(), type: 'sermons' as const, enabled: true, title: 'Sermon archive', subtitle: '', background: 'plain' as const, maxItems: 9, cta: { label: '', href: '' } },
    ],
  }

  const graceMinistriesPage = {
    title: 'Ministries', slug: 'ministries', isHomePage: false, seoTitle: 'Ministries', seoDescription: 'Find your place in a ministry at Grace Community Church.',
    sections: [
      { id: randomUUID(), type: 'ministries' as const, enabled: true, title: 'Ministries', subtitle: '', background: 'plain' as const, maxItems: 12 },
      { id: randomUUID(), type: 'cta' as const, enabled: true, title: 'Not sure where to start?', subtitle: '', background: 'soft' as const, body: 'Tell us a little about yourself and we will help you find your people.', button: { label: 'Contact us', href: '/contact' }, style: 'solid' as const },
    ],
  }

  const graceExpect = {
    title: 'What to expect', slug: 'what-to-expect', isHomePage: false, seoTitle: 'What to expect', seoDescription: 'Your first Sunday at Grace Community Church.',
    sections: [
      { id: randomUUID(), type: 'text-image' as const, enabled: true, title: 'Your first Sunday', subtitle: '', background: 'plain' as const, body: 'Walking into a new church can feel like the first day at a new school. Here is exactly what will happen:\n\n1. **A welcome, not a spotlight.** A host will greet you — no public stand-up-and-introduce-yourself moment, promise.\n2. **Worship.** About 25 minutes of singing. Sing along or just take it in.\n3. **Teaching.** A 35–40 minute Bible-based sermon.\n4. **Coffee.** Stay afterwards — the first cup is on us.', imageUrl: graceMedia.modern, imageAlt: 'Church building exterior', imageSide: 'left' as const },
      { id: randomUUID(), type: 'faq' as const, enabled: true, title: 'Common questions', subtitle: '', background: 'soft' as const, items: [
        { question: 'What should I wear?', answer: 'Come as you are — most people are smart casual, and there is no dress code.' },
        { question: 'Is there parking?', answer: 'Yes, free parking is available on-site with marshals to direct you.' },
        { question: 'What about my children?', answer: 'Children’s church runs during the 10:30 service for ages 2–11, with secure check-in.' },
        { question: 'Will I be asked for money?', answer: 'No. Guests are never expected to give.' },
      ] },
      { id: randomUUID(), type: 'services' as const, enabled: true, title: 'Service times', subtitle: '', background: 'plain' as const, intro: '', showLocation: true },
    ],
  }

  const graceGive = {
    title: 'Give', slug: 'give', isHomePage: false, seoTitle: 'Give', seoDescription: 'Support the mission of Grace Community Church.',
    sections: [
      { id: randomUUID(), type: 'giving' as const, enabled: true, title: 'Give cheerfully', subtitle: '', background: 'soft' as const, intro: '“Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.” — 2 Corinthians 9:7', showCategories: true },
      { id: randomUUID(), type: 'faq' as const, enabled: true, title: 'Giving FAQ', subtitle: '', background: 'plain' as const, items: [
        { question: 'Is my giving secure?', answer: 'Yes — online giving is processed by Paystack, a PCI-DSS compliant provider. Card details are never stored by the church.' },
        { question: 'Do I get a record of my giving?', answer: 'Paystack emails a receipt for every transaction, and annual giving statements are available on request.' },
      ] },
    ],
  }

  for (const page of [graceHome, graceAbout, graceContact, graceEventsPage, graceSermonsPage, graceMinistriesPage, graceExpect, graceGive]) {
    const sections = JSON.stringify(page.sections)
    await db.websitePage.create({
      data: {
        churchId: grace.id,
        title: page.title,
        slug: page.slug,
        isHomePage: page.isHomePage,
        status: 'PUBLISHED',
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        draftSections: sections,
        publishedSections: sections,
        publishedAt: new Date(),
        createdById: users.graceOwner.id,
        updatedById: users.graceOwner.id,
      },
    })
  }

  // Navigation
  const graceNav = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Ministries', href: '/ministries' },
    { label: 'Events', href: '/events' },
    { label: 'Sermons', href: '/sermons' },
    { label: 'Give', href: '/give' },
    { label: 'Contact', href: '/contact' },
  ]
  await db.navigationMenu.create({ data: { churchId: grace.id, location: 'HEADER', items: JSON.stringify(graceNav) } })
  await db.navigationMenu.create({ data: { churchId: grace.id, location: 'FOOTER', items: JSON.stringify([...graceNav, { label: 'What to expect', href: '/what-to-expect' }]) } })

  // Demo enquiries
  const graceSubmissions = [
    { type: 'CONTACT', name: 'Ifeoma Nwabueze', email: 'ifeoma@example.com', subject: 'Wedding enquiry', message: 'Hello Pastor, I would like to ask about wedding preparations at Grace Community. My fiancé and I attend the 10:30 service.', status: 'NEW', sensitive: false },
    { type: 'PRAYER', name: 'Anonymous', email: '', subject: 'Please pray for my father', message: 'My father was admitted to LUTH on Monday. Please pray for his healing and for peace for our family.', status: 'NEW', sensitive: true },
    { type: 'FOLLOWUP', name: 'Kelechi Obi', email: 'kelechi.obi@example.com', phone: '+234 802 555 0134', subject: 'First visit last Sunday', message: 'I visited for the first time last Sunday and really enjoyed the service. I would like to join a small group.', status: 'IN_PROGRESS', sensitive: false },
    { type: 'TESTIMONY', name: 'Blessing A.', email: 'blessing@example.com', subject: 'God provided!', message: 'After the prayer chain prayed with me about my job search in March, I received an offer this week. Praise God!', status: 'RESOLVED', sensitive: false },
  ]
  for (const s of graceSubmissions) {
    const form = await db.form.findFirst({ where: { churchId: grace.id, type: s.type } })
    await db.formSubmission.create({
      data: { churchId: grace.id, formId: form?.id, type: s.type, name: s.name, email: s.email || null, phone: s.phone ?? null, subject: s.subject, message: s.message, status: s.status, isSensitive: s.sensitive },
    })
  }

  await db.auditLog.create({
    data: { churchId: grace.id, actorUserId: users.graceOwner.id, actorEmail: users.graceOwner.email, action: 'church.created', entityType: 'church', entityId: grace.id, metadata: JSON.stringify({ seeded: true }) },
  })

  // === CHURCH 2: Emmanuel Parish Church (Manchester, UK — traditional) ======
  const emmanuel = await db.church.create({
    data: {
      slug: 'emmanuel-parish',
      isDemo: true,
      name: 'Emmanuel Parish Church',
      denomination: 'Church of England',
      country: 'GB',
      region: 'Greater Manchester',
      city: 'Manchester',
      address: '84 Beech Road, Didsbury',
      postalCode: 'M20 6RB',
      phone: '+44 161 234 5678',
      email: 'office@emmanuelparish.demo',
      timezone: 'Europe/London',
      currency: 'GBP',
      dateFormat: 'long',
      description: 'A warm, historic parish church serving Didsbury since 1859.',
      foundedYear: 1859,
      isPublished: true,
      publishedAt: new Date(),
      onboardingCompleted: true,
      onboardingStep: 5,
      status: 'ACTIVE',
    },
  })

  await db.churchMembership.create({
    data: { churchId: emmanuel.id, userId: users.emmanuelOwner.id, role: 'OWNER' },
  })

  console.log('   ↓ downloading Emmanuel media…')
  const emmanuelFetch = async (url: string, fileName: string, alt: string, folder = 'Demo content') => {
    const { buffer, mimeType } = await download(url)
    const asset = await putAsset({ churchId: emmanuel.id, fileName, buffer, mimeType, kind: 'IMAGE', altText: alt, uploadedById: users.emmanuelOwner.id, folder })
    return mediaUrl(asset.id)
  }
  const emmMedia = {
    hero: await emmanuelFetch(IMG.traditionalHero, 'sanctuary.jpg', 'The sanctuary with wooden pews and stained glass', 'Hero & banners'),
    pews: await emmanuelFetch(IMG.traditionalPews, 'pews.jpg', 'Traditional church pews', 'Gallery'),
    light: await emmanuelFetch(IMG.traditionalLight, 'stained-glass.jpg', 'Stained glass window light', 'Gallery'),
    bible: await emmanuelFetch(IMG.bibleStill, 'open-bible.jpg', 'An open Bible on a wooden table', 'Ministries'),
    study: await emmanuelFetch(IMG.bibleStudy, 'bible-study.jpg', 'Home group Bible study', 'Ministries'),
    exterior: await emmanuelFetch(IMG.churchExt, 'exterior.jpg', 'Parish church exterior', 'About'),
  }
  const emmLogo = await putAsset({
    churchId: emmanuel.id,
    fileName: 'emmanuel-logo.svg',
    buffer: Buffer.from(makeLogoSvg('Emmanuel Parish', '#7A1F2B', 'arch')),
    mimeType: 'image/svg+xml',
    kind: 'IMAGE',
    altText: 'Emmanuel Parish Church logo',
    uploadedById: users.emmanuelOwner.id,
    folder: 'Branding',
  })

  await db.churchSettings.create({
    data: {
      churchId: emmanuel.id,
      themeKey: 'traditional',
      primaryColor: '#7A1F2B',
      secondaryColor: '#B08D57',
      fontKey: 'serif',
      logoUrl: mediaUrl(emmLogo.id),
      heroImageUrl: emmMedia.hero,
      footerText: 'Emmanuel Parish Church has served the people of Didsbury since 1859. All are welcome at every service.',
      copyrightLine: '© Emmanuel Parish Church. Demo content for illustration.',
      // No social profile URLs are seeded: inventing handles (or linking a
      // bare platform homepage like https://x.com) would mislead visitors.
      // Churches add their real profiles in Website Settings; unconfigured
      // networks are hidden on the public site.
      socialX: null,
      mapEmbedUrl: 'https://www.google.com/maps?q=Didsbury+Manchester&output=embed',
      defaultSeoTitle: 'Emmanuel Parish Church, Didsbury',
      defaultSeoDescription: 'A warm, historic parish church in the heart of Didsbury, Manchester. Holy Communion every Sunday at 8:00 and 10:00.',
    },
  })

  await db.givingSettings.create({
    data: {
      churchId: emmanuel.id,
      isEnabled: true,
      isDemo: true,
      mode: 'BANK',
      provider: 'NONE',
      bankDetails: 'Parish Bank Account (demo)\nSort code: 00-00-00\nAccount: 12345678\nReference: GIVING + your name\n\nOr give contactlessly at the back of church.',
      customText: 'Your giving keeps this ancient building open and our ministry to Didsbury alive.',
    },
  })
  await db.givingCategory.createMany({
    data: [
      { churchId: emmanuel.id, name: 'Parish Giving', slug: 'parish-giving', description: 'Regular giving to the life and ministry of the parish.', sortOrder: 1 },
      { churchId: emmanuel.id, name: 'Building Restoration Fund', slug: 'building-restoration', description: 'Restoring our tower and stained glass for the next 150 years.', sortOrder: 2 },
      { churchId: emmanuel.id, name: 'Flowers & Fabric', slug: 'flowers-fabric', description: 'Beautifying the sanctuary through the seasons.', sortOrder: 3 },
      { churchId: emmanuel.id, name: 'Missional Partnerships', slug: 'missional-partnerships', description: 'Supporting partners in Manchester and beyond.', sortOrder: 4 },
    ],
  })

  for (const f of formDefs) {
    await db.form.create({
      data: { churchId: emmanuel.id, type: f.type, title: f.title, description: f.description, successMessage: f.success, isActive: f.type !== 'REGISTRATION' },
    })
  }

  const emmMinistries = [
    { name: 'Choir & Music', description: 'Leading worship at the Parish Communion and special services; new voices always welcome.', leaderName: 'Mr. Alan Price', meetingTime: 'Thursdays 7:30pm', image: emmMedia.light, sortOrder: 1 },
    { name: 'Sunday School', description: 'Bible stories, crafts and prayer for children during the 10:00 service.', leaderName: 'Mrs. Priya Sharma', meetingTime: 'Sundays 10:00am', image: emmMedia.study, sortOrder: 2 },
    { name: 'Home Groups', description: 'Midweek fellowship and Bible study in homes across Didsbury and West Didsbury.', leaderName: 'Revd. Michael Henshaw', meetingTime: 'Various weekdays', image: emmMedia.bible, sortOrder: 3 },
    { name: 'Pastoral Care Team', description: 'Visiting the housebound and supporting those in need.', leaderName: 'Mrs. Anne Whitfield', meetingTime: '', image: null, sortOrder: 4 },
  ]
  for (const m of emmMinistries) {
    await db.ministry.create({
      data: { churchId: emmanuel.id, name: m.name, slug: m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), description: m.description, leaderName: m.leaderName, meetingTime: m.meetingTime, imageUrl: m.image, status: 'PUBLISHED', sortOrder: m.sortOrder },
    })
  }

  const emmLeaders = [
    { name: 'Revd. Elizabeth Grant', title: 'Vicar', bio: 'Elizabeth has served Emmanuel since 2017 and chairs the Didsbury churches together initiative.', sortOrder: 1 },
    { name: 'Revd. Michael Henshaw', title: 'Curate', bio: 'Michael is in his final curacy year, with particular care for families and home groups.', sortOrder: 2 },
    { name: 'Mrs. Anne Whitfield', title: 'Church Warden', bio: 'Anne keeps the parish running — from rotas to the boiler.', sortOrder: 3 },
    { name: 'Mr. James Carlisle', title: 'Church Warden', bio: 'James oversees the fabric of the building and the restoration fund.', sortOrder: 4 },
    { name: 'Mrs. Priya Sharma', title: 'Sunday School Coordinator', bio: 'Priya leads our work with children and young families.', sortOrder: 5 },
  ]
  for (const l of emmLeaders) {
    await db.leader.create({ data: { churchId: emmanuel.id, name: l.name, title: l.title, bio: l.bio, status: 'PUBLISHED', sortOrder: l.sortOrder } })
  }

  const emmChurchHall = await db.location.create({
    data: { churchId: emmanuel.id, name: 'Parish Church Hall', address: '84 Beech Road, Didsbury', city: 'Manchester', country: 'GB', isPrimary: false },
  })
  const emmServices = [
    { name: 'Holy Communion (Book of Common Prayer)', dayOfWeek: 0, startTime: '08:00', endTime: '08:45', notes: 'A quiet, said service', locationId: null },
    { name: 'Parish Communion', dayOfWeek: 0, startTime: '10:00', endTime: '11:00', notes: 'Common Worship, choir & Sunday school', locationId: null },
    { name: 'Choral Evensong', dayOfWeek: 0, startTime: '18:00', endTime: '18:45', notes: 'First Sunday of the month', locationId: null },
    { name: 'Wednesday Communion', dayOfWeek: 3, startTime: '10:00', endTime: '10:30', notes: '', locationId: null },
  ]
  for (const s of emmServices) {
    await db.service.create({ data: { churchId: emmanuel.id, ...s } })
  }

  const emmEvents = [
    { title: 'Remembrance Sunday', description: 'The annual service of remembrance with the Didsbury branch of the Royal British Legion, followed by the wreath-laying at the war memorial.', startsAt: nextRemembranceSunday(), endsAt: new Date(nextRemembranceSunday().getTime() + 2 * 60 * 60 * 1000), locationText: 'Church & War Memorial', imageUrl: emmMedia.pews, status: 'PUBLISHED' },
    { title: 'Parish Quiz Night', description: 'Teams of six, fish and chips, and fiendish questions in the church hall. Bring your own bottle.', startsAt: daysFromNow(6, 19), endsAt: daysFromNow(6, 22), locationText: 'Parish Church Hall', imageUrl: null, registrationEnabled: false, status: 'PUBLISHED' },
    { title: 'Harvest Festival', description: 'Giving thanks for God’s provision with traditional hymns, followed by a shared lunch. Donations support the Didsbury food bank.', startsAt: daysFromNow(12, 10), endsAt: daysFromNow(12, 13), locationText: 'Church', imageUrl: emmMedia.light, status: 'PUBLISHED' },
    { title: 'Confirmation Classes Begin', description: 'A six-week journey for anyone exploring confirmation — with the Bishop in the spring.', startsAt: daysFromNow(19, 19), endsAt: daysFromNow(19, 20), locationText: 'Vestry', imageUrl: null, status: 'PUBLISHED' },
    { title: 'Summer Fete', description: 'Stalls, brass band, and the famous Pimm’s tent on the church green.', startsAt: daysFromNow(-80, 12), endsAt: daysFromNow(-80, 17), locationText: 'Church Green', imageUrl: emmMedia.exterior, status: 'PUBLISHED' },
  ]
  for (const e of emmEvents) {
    await db.event.create({ data: { churchId: emmanuel.id, ...e } })
  }

  const emmSeries = await db.sermonSeries.create({ data: { churchId: emmanuel.id, title: 'The I AM Sayings', description: 'Encounters with Christ in John’s Gospel.' } })
  const emmSermons = [
    { title: 'I AM the Bread of Life', speakerName: 'Revd. Elizabeth Grant', preachedAt: daysFromNow(-7, 10), description: 'What does it mean to be truly fed?', scriptureRef: 'John 6:25–35', seriesId: emmSeries.id, videoUrl: null, imageUrl: emmMedia.hero, status: 'PUBLISHED' },
    { title: 'I AM the Light of the World', speakerName: 'Revd. Michael Henshaw', preachedAt: daysFromNow(-14, 10), description: 'Light, sight and the courage to follow.', scriptureRef: 'John 8:12–20', seriesId: emmSeries.id, videoUrl: null, imageUrl: null, status: 'PUBLISHED' },
    { title: 'All Saints: The Communion of Saints', speakerName: 'Revd. Elizabeth Grant', preachedAt: daysFromNow(-21, 10), description: 'Joined across the centuries by one hope.', scriptureRef: 'Hebrews 12:1–3', seriesId: null, videoUrl: null, imageUrl: null, status: 'PUBLISHED' },
  ]
  for (const s of emmSermons) {
    await db.sermon.create({ data: { churchId: emmanuel.id, ...s } })
  }

  const emmHero = {
    id: randomUUID(), type: 'hero' as const, enabled: true, title: '', subtitle: '', background: 'plain' as const,
    heading: 'Emmanuel Parish Church, Didsbury',
    subheading: 'Serving this corner of Manchester with warm, faithful worship since 1859. All are welcome.',
    imageUrl: emmMedia.hero, imageAlt: 'The sanctuary with wooden pews and stained glass',
    overlay: 'dark' as const, align: 'center' as const,
    primaryCta: { label: 'Service times', href: '/about' },
    secondaryCta: { label: 'Find us', href: '/contact' },
  }

  const emmHome = {
    title: 'Home', slug: '', isHomePage: true, seoTitle: null, seoDescription: null,
    sections: [
      emmHero,
      { id: randomUUID(), type: 'services' as const, enabled: true, title: 'Services this week', subtitle: '', background: 'plain' as const, intro: 'A rhythm of prayer and sacrament at the heart of Didsbury.', showLocation: false },
      { id: randomUUID(), type: 'text-image' as const, enabled: true, title: 'Welcome to Emmanuel', subtitle: '', background: 'soft' as const, body: 'Whether you have followed Jesus for decades or are simply curious, you will find a warm welcome here.\n\nWe are an inclusive parish church in the liberal catholic tradition of the Church of England — ancient worship, thoughtful teaching and a genuine community.', imageUrl: emmMedia.exterior, imageAlt: 'Parish church exterior', imageSide: 'left' as const },
      { id: randomUUID(), type: 'events' as const, enabled: true, title: 'Coming up', subtitle: '', background: 'plain' as const, maxItems: 3, showPast: false, cta: { label: 'All events', href: '/events' } },
      { id: randomUUID(), type: 'leadership' as const, enabled: true, title: 'Who you will meet', subtitle: '', background: 'soft' as const, intro: '' },
      { id: randomUUID(), type: 'cta' as const, enabled: true, title: 'Join us this Sunday', subtitle: '', background: 'accent' as const, body: 'Holy Communion at 8:00, Parish Communion with Sunday school at 10:00. Stay for coffee afterwards.', button: { label: 'Plan your visit', href: '/contact' }, style: 'solid' as const },
    ],
  }
  const emmAbout = {
    title: 'About', slug: 'about', isHomePage: false, seoTitle: 'About us', seoDescription: 'Our history, worship and community at Emmanuel Parish Church.',
    sections: [
      { id: randomUUID(), type: 'richtext' as const, enabled: true, title: 'Our story', subtitle: '', background: 'plain' as const, body: 'Emmanuel Parish Church was consecrated in 1859, when Didsbury was little more than a village among the fields south of Manchester.\n\n## Worship\n\nWe worship in the liberal catholic tradition of the Church of England: sacramental, prayerful and beautiful, with space for doubt and questions.\n\n## Community\n\nBeyond Sunday, the parish is at the heart of Didsbury life — toddler groups, home groups, the food bank, and the church green that hosts the summer fete.' },
      { id: randomUUID(), type: 'gallery' as const, enabled: true, title: 'The church through the year', subtitle: '', background: 'soft' as const, images: [
        { url: emmMedia.hero, alt: 'The sanctuary', caption: 'The sanctuary' },
        { url: emmMedia.light, alt: 'Stained glass', caption: 'Stained glass' },
        { url: emmMedia.pews, alt: 'The nave', caption: 'The nave' },
      ] },
      { id: randomUUID(), type: 'leadership' as const, enabled: true, title: 'Ministry team & officers', subtitle: '', background: 'plain' as const, intro: '' },
    ],
  }
  const emmContact = {
    title: 'Contact', slug: 'contact', isHomePage: false, seoTitle: 'Contact & finding us', seoDescription: 'How to reach Emmanuel Parish Church.',
    sections: [
      { id: randomUUID(), type: 'contact' as const, enabled: true, title: 'Contact us', subtitle: '', background: 'plain' as const, intro: 'The parish office is open Tuesday to Friday, 9am–1pm. For pastoral emergencies, call the Vicar directly.', showForm: true, showMap: true, formType: 'CONTACT' as const },
    ],
  }
  const emmEventsPage = {
    title: 'Events', slug: 'events', isHomePage: false, seoTitle: 'Events', seoDescription: 'What is on at Emmanuel Parish Church.',
    sections: [
      { id: randomUUID(), type: 'events' as const, enabled: true, title: 'Upcoming', subtitle: '', background: 'plain' as const, maxItems: 9, showPast: false, cta: { label: '', href: '' } },
    ],
  }
  const emmGive = {
    title: 'Give', slug: 'give', isHomePage: false, seoTitle: 'Giving', seoDescription: 'Supporting Emmanuel Parish Church.',
    sections: [
      { id: randomUUID(), type: 'giving' as const, enabled: true, title: 'Giving at Emmanuel', subtitle: '', background: 'plain' as const, intro: 'Everything we do — worship, ministry and the care of this building — is funded by the generosity of this community.', showCategories: true },
    ],
  }

  const emmSermonsPage = {
    title: 'Sermons', slug: 'sermons', isHomePage: false,
    seoTitle: 'Sermons', seoDescription: 'Sermons and homilies from Emmanuel Parish Church.',
    sections: [
      { id: randomUUID(), type: 'sermons' as const, enabled: true, title: 'Sermons & homilies', subtitle: '', background: 'plain' as const, maxItems: 9, cta: { label: '', href: '' } },
    ],
  }

  for (const page of [emmHome, emmAbout, emmContact, emmEventsPage, emmGive, emmSermonsPage]) {
    const sections = JSON.stringify(page.sections)
    await db.websitePage.create({
      data: {
        churchId: emmanuel.id,
        title: page.title,
        slug: page.slug,
        isHomePage: page.isHomePage,
        status: 'PUBLISHED',
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        draftSections: sections,
        publishedSections: sections,
        publishedAt: new Date(),
        createdById: users.emmanuelOwner.id,
        updatedById: users.emmanuelOwner.id,
      },
    })
  }

  const emmNav = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Events', href: '/events' },
    { label: 'Sermons', href: '/sermons' },
    { label: 'Give', href: '/give' },
    { label: 'Contact', href: '/contact' },
  ]
  await db.navigationMenu.create({ data: { churchId: emmanuel.id, location: 'HEADER', items: JSON.stringify(emmNav) } })
  await db.navigationMenu.create({ data: { churchId: emmanuel.id, location: 'FOOTER', items: JSON.stringify(emmNav) } })

  const emmSubmissions = [
    { type: 'CONTACT', name: 'Helen Marsh', email: 'helen.marsh@example.com', subject: 'Baptism enquiry', message: 'Hello, we would like to enquire about having our daughter baptised at Emmanuel. We live on Beech Road.', status: 'NEW', sensitive: false },
    { type: 'COUNSELLING', name: 'Withheld', email: '', subject: 'Bereavement support', message: 'I would like to speak with someone after the loss of my husband in September.', status: 'NEW', sensitive: true },
  ]
  for (const s of emmSubmissions) {
    const form = await db.form.findFirst({ where: { churchId: emmanuel.id, type: s.type } })
    await db.formSubmission.create({
      data: { churchId: emmanuel.id, formId: form?.id, type: s.type, name: s.name, email: s.email || null, subject: s.subject, message: s.message, status: s.status, isSensitive: s.sensitive },
    })
  }

  await db.auditLog.create({
    data: { churchId: emmanuel.id, actorUserId: users.emmanuelOwner.id, actorEmail: users.emmanuelOwner.email, action: 'church.created', entityType: 'church', entityId: emmanuel.id, metadata: JSON.stringify({ seeded: true }) },
  })

  // Summary
  const counts = {
    users: await db.user.count(),
    churches: await db.church.count(),
    pages: await db.websitePage.count(),
    ministries: await db.ministry.count(),
    leaders: await db.leader.count(),
    events: await db.event.count(),
    sermons: await db.sermon.count(),
    media: await db.mediaAsset.count(),
    submissions: await db.formSubmission.count(),
  }
  console.log('✅ Seed complete:', counts)
  console.log(`   Demo login: owner@grace.demo / ${DEMO_PASSWORD} (also editor@, author@grace.demo, owner@emmanuel.demo)`)
  console.log(`   Platform admin (random password — NOT a demo login): admin@openchurch.dev / ${adminPassword}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
