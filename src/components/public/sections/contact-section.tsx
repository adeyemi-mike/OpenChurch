import { MapPin, Phone, Mail, MessageCircle } from 'lucide-react'
import { SectionShell } from '@/components/public/sections/content-sections'
import { PublicContactForm } from '@/components/public/sections/public-contact-form'
import type { SiteRenderContext } from '@/components/site/context'
import type { z } from 'zod'
import type { contactConfigSchema } from '@/lib/sections/types'

export type ContactSection = z.infer<typeof contactConfigSchema>

export function ContactRenderer({ section, ctx }: { section: ContactSection; ctx: SiteRenderContext }) {
  const c = ctx.data.contact
  const formConfig = ctx.data.enabledForms[section.formType]

  return (
    <SectionShell section={section} ctx={ctx}>
      {section.intro ? <p className="max-w-2xl text-lg opacity-70 -mt-4 mb-8">{section.intro}</p> : null}
      <div className="grid lg:grid-cols-5 gap-10 items-start">
        {/* Contact details */}
        <div className="lg:col-span-2 space-y-5">
          {[
            { icon: MapPin, label: 'Address', value: [c.address, c.city, c.country].filter(Boolean).join(', ') },
            { icon: Phone, label: 'Phone', value: c.phone, href: c.phone ? `tel:${c.phone.replace(/\s+/g, '')}` : null },
            { icon: Mail, label: 'Email', value: c.email, href: c.email ? `mailto:${c.email}` : null },
          ]
            .filter((row) => row.value)
            .map((row) => (
              <div key={row.label} className="flex items-start gap-3.5">
                <span
                  className="grid place-items-center size-10 rounded-[var(--oc-radius)] shrink-0"
                  style={{ background: 'var(--oc-bg-soft)' }}
                  aria-hidden
                >
                  <row.icon className="size-4.5" style={{ color: 'var(--oc-primary)' }} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-50">{row.label}</p>
                  {row.href ? (
                    <a href={row.href} className="font-medium hover:underline underline-offset-4">
                      {row.value}
                    </a>
                  ) : (
                    <p className="font-medium">{row.value}</p>
                  )}
                </div>
              </div>
            ))}

          {/* WhatsApp */}
          {c.whatsappNumber ? (
            <a
              href={`https://wa.me/${c.whatsappNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--oc-btn-radius)] px-4 py-2.5 text-sm font-semibold"
              style={{ background: '#25D366', color: '#fff' }}
            >
              <MessageCircle className="size-4" aria-hidden /> Chat on WhatsApp
            </a>
          ) : null}

          {/* Service times summary */}
          {ctx.data.services.length > 0 ? (
            <div className="ocs-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-50 mb-3">Service times</p>
              <ul className="space-y-1.5 text-sm">
                {ctx.data.services.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex justify-between gap-4">
                    <span className="opacity-75">{s.name}</span>
                    <span className="font-medium whitespace-nowrap">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek]} {s.startTime}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Form */}
        <div className="lg:col-span-3">
          {section.showForm && formConfig ? (
            <div className="ocs-card p-6 sm:p-8">
              <h3 className="ocs-heading text-xl font-semibold">{formConfig.title}</h3>
              {formConfig.description ? (
                <p className="mt-1.5 text-sm opacity-70 leading-relaxed">{formConfig.description}</p>
              ) : null}
              <div className="mt-6">
                <PublicContactForm
                  slug={ctx.church.slug}
                  formType={section.formType}
                  successMessage={formConfig.successMessage}
                />
              </div>
            </div>
          ) : (
            <div className="ocs-card p-6 sm:p-8 text-sm opacity-70">
              The enquiry form is currently unavailable. Please reach out by phone or email.
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      {section.showMap && c.mapEmbedUrl ? (
        <div className="mt-10 overflow-hidden rounded-[var(--oc-radius)]" style={{ boxShadow: 'var(--oc-card)' }}>
          <iframe
            src={c.mapEmbedUrl}
            title={`Map showing ${ctx.church.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-80 border-0"
          />
        </div>
      ) : null}
    </SectionShell>
  )
}
