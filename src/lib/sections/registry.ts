import type { FieldDef } from '@/lib/sections/fields'
import { sectionSchema, type SectionInstance, type SectionType, type SectionsList } from '@/lib/sections/types'

/**
 * Universally available UUID v4 (Web Crypto in browsers, with a fallback for
 * older runtimes). Never import Node's 'crypto' module here — this registry
 * is bundled into the client builder.
 */
function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * Section registry — the contract between the page builder UI, the Zod
 * schemas and the renderers. Adding a section type: add its schema to
 * types.ts, a renderer component, and an entry here. The builder form is
 * generated from `fields`, so no bespoke editor code is needed.
 */

export type SectionMeta = {
  type: SectionType
  name: string
  description: string
  icon: string // lucide icon name, resolved in the builder
  category: 'structure' | 'content' | 'dynamic' | 'action'
  /** Dynamic sections pull live church data (events, sermons, …). */
  dynamic: boolean
  defaults: () => Record<string, unknown>
  fields: () => FieldDef[]
}

const bgField: FieldDef = {
  kind: 'select',
  key: 'background',
  label: 'Background',
  options: [
    { value: 'plain', label: 'Plain' },
    { value: 'soft', label: 'Soft tint' },
    { value: 'dark', label: 'Dark' },
    { value: 'accent', label: 'Brand accent' },
  ],
}

function baseFields(withTitle = true): FieldDef[] {
  const fields: FieldDef[] = []
  if (withTitle) {
    fields.push({ kind: 'text', key: 'title', label: 'Section heading', placeholder: 'Leave empty to hide the heading' })
  }
  fields.push(bgField)
  return fields
}

export const SECTION_REGISTRY: Record<SectionType, SectionMeta> = {
  hero: {
    type: 'hero',
    name: 'Hero banner',
    description: 'Full-width opening banner with heading, image and buttons.',
    icon: 'Image',
    category: 'structure',
    dynamic: false,
    defaults: () => ({
      heading: 'Welcome to our church',
      subheading: 'Join us this Sunday — everyone is welcome.',
      overlay: 'medium',
      align: 'left',
      primaryCta: { label: 'Plan your visit', href: '/about' },
      secondaryCta: { label: 'Watch online', href: '' },
    }),
    fields: () => [
      { kind: 'text', key: 'heading', label: 'Heading', required: true },
      { kind: 'textarea', key: 'subheading', label: 'Sub-heading', rows: 2 },
      { kind: 'image', key: 'imageUrl', label: 'Background image' },
      {
        kind: 'select',
        key: 'overlay',
        label: 'Text overlay',
        options: [
          { value: 'light', label: 'Light overlay' },
          { value: 'medium', label: 'Medium overlay' },
          { value: 'dark', label: 'Dark overlay' },
        ],
      },
      {
        kind: 'select',
        key: 'align',
        label: 'Alignment',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Centered' },
        ],
      },
      { kind: 'link', key: 'primaryCta', label: 'Primary button' },
      { kind: 'link', key: 'secondaryCta', label: 'Secondary button' },
    ],
  },
  'text-image': {
    type: 'text-image',
    name: 'Text & image',
    description: 'A paragraph of rich text beside an image.',
    icon: 'Columns2',
    category: 'content',
    dynamic: false,
    defaults: () => ({
      body: 'Tell people who you are, what you value and what to expect.',
      imageSide: 'right',
    }),
    fields: () => [
      ...baseFields(),
      { kind: 'textarea', key: 'body', label: 'Body text', markdown: true, rows: 8 },
      { kind: 'image', key: 'imageUrl', label: 'Image' },
      {
        kind: 'select',
        key: 'imageSide',
        label: 'Image position',
        options: [
          { value: 'right', label: 'Right' },
          { value: 'left', label: 'Left' },
        ],
      },
    ],
  },
  gallery: {
    type: 'gallery',
    name: 'Image gallery',
    description: 'A grid of photos from your media library.',
    icon: 'Images',
    category: 'content',
    dynamic: false,
    defaults: () => ({ images: [] }),
    fields: () => [
      ...baseFields(),
      {
        kind: 'list',
        key: 'images',
        label: 'Images',
        itemLabel: 'Image',
        max: 12,
        itemFields: [
          { kind: 'image', key: 'url', label: 'Image' },
          { kind: 'text', key: 'alt', label: 'Alt text', placeholder: 'Describe the image for screen readers' },
          { kind: 'text', key: 'caption', label: 'Caption' },
        ],
      },
    ],
  },
  services: {
    type: 'services',
    name: 'Service schedule',
    description: 'Weekly service days & times, pulled from your church profile.',
    icon: 'Clock',
    category: 'dynamic',
    dynamic: true,
    defaults: () => ({ intro: '' }),
    fields: () => [
      ...baseFields(),
      { kind: 'textarea', key: 'intro', label: 'Intro text', rows: 2 },
      { kind: 'toggle', key: 'showLocation', label: 'Show location for each service' },
    ],
  },
  events: {
    type: 'events',
    name: 'Event listing',
    description: 'Upcoming events, always in sync with the events manager.',
    icon: 'CalendarDays',
    category: 'dynamic',
    dynamic: true,
    defaults: () => ({ maxItems: 3, showPast: false }),
    fields: () => [
      ...baseFields(),
      { kind: 'number', key: 'maxItems', label: 'How many events', min: 1, max: 9 },
      { kind: 'toggle', key: 'showPast', label: 'Include past events' },
      { kind: 'link', key: 'cta', label: 'Button (e.g. “All events”)' },
    ],
  },
  sermons: {
    type: 'sermons',
    name: 'Sermon listing',
    description: 'Latest published sermons with video embeds.',
    icon: 'BookOpen',
    category: 'dynamic',
    dynamic: true,
    defaults: () => ({ maxItems: 3 }),
    fields: () => [
      ...baseFields(),
      { kind: 'number', key: 'maxItems', label: 'How many sermons', min: 1, max: 9 },
      { kind: 'link', key: 'cta', label: 'Button (e.g. “Sermon archive”)' },
    ],
  },
  ministries: {
    type: 'ministries',
    name: 'Ministry cards',
    description: 'Cards for your ministries, synced with the ministries manager.',
    icon: 'HeartHandshake',
    category: 'dynamic',
    dynamic: true,
    defaults: () => ({ maxItems: 6 }),
    fields: () => [...baseFields(), { kind: 'number', key: 'maxItems', label: 'How many ministries', min: 1, max: 12 }],
  },
  leadership: {
    type: 'leadership',
    name: 'Leadership profiles',
    description: 'Photos, names and roles of your leaders.',
    icon: 'Users',
    category: 'dynamic',
    dynamic: true,
    defaults: () => ({ intro: '' }),
    fields: () => [
      ...baseFields(),
      { kind: 'textarea', key: 'intro', label: 'Intro text', rows: 2 },
    ],
  },
  video: {
    type: 'video',
    name: 'Video embed',
    description: 'A YouTube video — latest sermon, welcome message, and so on.',
    icon: 'PlayCircle',
    category: 'content',
    dynamic: false,
    defaults: () => ({ videoUrl: '', caption: '' }),
    fields: () => [
      ...baseFields(),
      { kind: 'text', key: 'videoUrl', label: 'YouTube URL', placeholder: 'https://www.youtube.com/watch?v=…' },
      { kind: 'text', key: 'caption', label: 'Caption' },
    ],
  },
  testimonials: {
    type: 'testimonials',
    name: 'Testimonials',
    description: 'Quotes and stories from your congregation.',
    icon: 'Quote',
    category: 'content',
    dynamic: false,
    defaults: () => ({ items: [] }),
    fields: () => [
      ...baseFields(),
      {
        kind: 'list',
        key: 'items',
        label: 'Testimonials',
        itemLabel: 'Testimonial',
        max: 9,
        itemFields: [
          { kind: 'textarea', key: 'quote', label: 'Quote', rows: 4 },
          { kind: 'text', key: 'name', label: 'Name' },
          { kind: 'text', key: 'role', label: 'Role / context' },
        ],
      },
    ],
  },
  cta: {
    type: 'cta',
    name: 'Call to action',
    description: 'A focused banner with one button.',
    icon: 'MousePointerClick',
    category: 'action',
    dynamic: false,
    defaults: () => ({
      body: '',
      button: { label: 'Get in touch', href: '/contact' },
      style: 'solid',
    }),
    fields: () => [
      ...baseFields(),
      { kind: 'textarea', key: 'body', label: 'Supporting text', rows: 2 },
      { kind: 'link', key: 'button', label: 'Button' },
      {
        kind: 'select',
        key: 'style',
        label: 'Style',
        options: [
          { value: 'solid', label: 'Solid brand colour' },
          { value: 'outline', label: 'Outlined' },
        ],
      },
    ],
  },
  contact: {
    type: 'contact',
    name: 'Contact information',
    description: 'Address, phone, map and an enquiry form.',
    icon: 'Mail',
    category: 'dynamic',
    dynamic: true,
    defaults: () => ({ intro: '', showForm: true, showMap: true, formType: 'CONTACT' }),
    fields: () => [
      ...baseFields(),
      { kind: 'textarea', key: 'intro', label: 'Intro text', rows: 2 },
      { kind: 'toggle', key: 'showForm', label: 'Show enquiry form' },
      {
        kind: 'select',
        key: 'formType',
        label: 'Form type',
        options: [
          { value: 'CONTACT', label: 'General contact' },
          { value: 'PRAYER', label: 'Prayer request' },
          { value: 'COUNSELLING', label: 'Counselling request' },
          { value: 'TESTIMONY', label: 'Testimony' },
          { value: 'FOLLOWUP', label: 'New visitor follow-up' },
        ],
      },
      { kind: 'toggle', key: 'showMap', label: 'Show map' },
    ],
  },
  giving: {
    type: 'giving',
    name: 'Giving information',
    description: 'Giving categories and instructions from your giving settings.',
    icon: 'HandCoins',
    category: 'dynamic',
    dynamic: true,
    defaults: () => ({ intro: '', showCategories: true }),
    fields: () => [
      ...baseFields(),
      { kind: 'textarea', key: 'intro', label: 'Intro text', rows: 3 },
      { kind: 'toggle', key: 'showCategories', label: 'Show giving categories' },
    ],
  },
  faq: {
    type: 'faq',
    name: 'FAQ',
    description: 'Frequently asked questions in an accordion.',
    icon: 'CircleHelp',
    category: 'content',
    dynamic: false,
    defaults: () => ({ items: [] }),
    fields: () => [
      ...baseFields(),
      {
        kind: 'list',
        key: 'items',
        label: 'Questions',
        itemLabel: 'Question',
        max: 12,
        itemFields: [
          { kind: 'text', key: 'question', label: 'Question' },
          { kind: 'textarea', key: 'answer', label: 'Answer', rows: 4, markdown: true },
        ],
      },
    ],
  },
  richtext: {
    type: 'richtext',
    name: 'Rich text',
    description: 'A free-form rich text block for any content.',
    icon: 'Text',
    category: 'content',
    dynamic: false,
    defaults: () => ({ body: '' }),
    fields: () => [...baseFields(false), { kind: 'textarea', key: 'body', label: 'Body text', markdown: true, rows: 12 }],
  },
}

export function createSection(type: SectionType): SectionInstance {
  const meta = SECTION_REGISTRY[type]
  const raw = {
    id: randomUUID(),
    type,
    enabled: true,
    title: '',
    subtitle: '',
    background: 'plain',
    ...meta.defaults(),
  }
  // Run through the Zod schema so every field default (e.g. section CTAs)
  // is applied exactly as it would be when parsed from storage.
  const result = sectionSchema.safeParse(raw)
  if (result.success) return result.data
  throw new Error(`Invalid section defaults for type "${type}": ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`)
}

// ---------------------------------------------------------------------------
// Starter templates
// ---------------------------------------------------------------------------

/**
 * Editor-instruction strings used in starter/onboarding page sections.
 * They are guidance FOR THE CHURCH ADMINISTRATOR ("write your intro here"),
 * never visitor-facing content. Publishing-readiness validation treats them
 * as blocking issues, and the public renderer suppresses sections that still
 * contain them (defence in depth for pages published before validation
 * existed). Keep in sync with the defaults below.
 */
export const TEMPLATE_PLACEHOLDERS: readonly string[] = [
  'Share a short, warm introduction to your church here',
  'Write the story of your church',
]

export function defaultHomepageSections(churchName: string): SectionsList {
  return [
    { ...createSection('hero'), heading: `Welcome to ${churchName}`, subheading: 'Join us this Sunday — there is a seat for you.' } as SectionInstance,
    { ...createSection('services'), title: 'When we gather' } as SectionInstance,
    { ...createSection('text-image'), title: 'A church for everyone', body: 'Share a short, warm introduction to your church here — who you are, what you value, and what someone can expect on a Sunday.', imageSide: 'right' } as SectionInstance,
    { ...createSection('events'), title: 'Upcoming events' } as SectionInstance,
    { ...createSection('sermons'), title: 'Recent sermons' } as SectionInstance,
    { ...createSection('ministries'), title: 'Find your place' } as SectionInstance,
    { ...createSection('cta'), title: 'Planning your first visit?', body: 'We would love to meet you. Let us know you are coming and we will look out for you.', button: { label: 'Contact us', href: '/contact' } } as SectionInstance,
  ]
}

export function defaultAboutSections(): SectionsList {
  return [
    { ...createSection('richtext'), title: 'Our story', body: 'Write the story of your church — how it began, what God has done, and where He is leading you.' } as SectionInstance,
    { ...createSection('leadership'), title: 'Our team' } as SectionInstance,
    { ...createSection('cta'), title: 'Get to know us', button: { label: 'Contact us', href: '/contact' } } as SectionInstance,
  ]
}

export function defaultContactSections(): SectionsList {
  return [{ ...createSection('contact'), title: 'Get in touch' } as SectionInstance]
}

export function defaultGivingSections(): SectionsList {
  return [
    { ...createSection('giving'), title: 'Give' } as SectionInstance,
    { ...createSection('faq'), title: 'Giving FAQ', items: [] } as SectionInstance,
  ]
}

/** Starter pages created during onboarding. */
export function starterPages(churchName: string) {
  return [
    { title: 'Home', slug: '', isHomePage: true, sections: defaultHomepageSections(churchName) },
    { title: 'About', slug: 'about', isHomePage: false, sections: defaultAboutSections() },
    { title: 'Contact', slug: 'contact', isHomePage: false, sections: defaultContactSections() },
  ]
}
