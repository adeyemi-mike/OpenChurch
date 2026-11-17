import {
  Briefcase,
  Church,
  ExternalLink,
  Globe2,
  LifeBuoy,
  Mail,
  PencilRuler,
  Phone,
  ServerCog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Optional professional services section — PillarsConnect Ltd.
 *
 * OpenChurch is complete, free, open-source software (MIT). This section
 * introduces PillarsConnect Ltd as an OPTIONAL professional services
 * provider for visitors who want implementation help. It must never imply
 * that OpenChurch requires paid services, a managed backend or mandatory
 * hosting to function — the software and the services are strictly separate.
 *
 * Contact details are the approved business contacts of PillarsConnect Ltd.
 * Do not substitute, invent or "fix" them: the telephone number and the
 * WhatsApp number are different numbers with different destinations.
 */
const PILLARSCONNECT = {
  name: 'PillarsConnect Ltd',
  website: 'https://pillarsconnect.online',
  primaryEmail: 'info@pillarsconnect.online',
  alternativeEmail: 'pillarsconnect7@gmail.com',
  // Telephone and WhatsApp are DIFFERENT numbers — never swap them.
  phone: '+2347064846659',
  phoneDisplay: '+234 706 484 6659',
  // Official business WhatsApp (+234 814 321 4024) with the approved
  // prefilled message: "Hello PillarsConnect, I found your services through
  // OpenChurch. I would like to enquire about professional website
  // development or technical assistance." Keep this URL byte-exact.
  whatsappUrl:
    'https://wa.me/2348143214024?text=Hello%20PillarsConnect%2C%20I%20found%20your%20services%20through%20OpenChurch.%20I%20would%20like%20to%20enquire%20about%20professional%20website%20development%20or%20technical%20assistance.',
} as const

const SERVICES = [
  {
    icon: ServerCog,
    title: 'OpenChurch Installation & Deployment',
    text: 'Get professional assistance installing, configuring and deploying OpenChurch on your chosen infrastructure.',
  },
  {
    icon: Globe2,
    title: 'Custom Domain Setup',
    text: 'Connect your own domain and configure DNS, HTTPS and the required application settings.',
  },
  {
    icon: Church,
    title: 'Custom Church Websites',
    text: 'Need a unique church website or additional functionality? We design and develop websites tailored to your church’s identity and requirements.',
  },
  {
    icon: Briefcase,
    title: 'Business Website Development',
    text: 'We create professional websites for businesses, entrepreneurs, schools and organisations.',
  },
  {
    icon: PencilRuler,
    title: 'Website Customisation',
    text: 'Improve an existing website, add new features or tailor your application to your operational requirements.',
  },
  {
    icon: LifeBuoy,
    title: 'Technical Assistance',
    text: 'Get help with configuration, troubleshooting, integrations and deployment.',
  },
] as const

/**
 * WhatsApp brand glyph (lucide-react does not ship brand logos).
 * Decorative only — always paired with visible text and aria-hidden.
 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

/**
 * Homepage section: optional professional services by PillarsConnect Ltd.
 * Placed after the open-source section, before the footer. Server component —
 * static content, no client interactivity, no new dependencies.
 */
export function ProfessionalServices() {
  return (
    <section
      id="professional-services"
      aria-labelledby="professional-services-heading"
      className="border-t bg-muted/30 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Professional services by PillarsConnect Ltd
          </p>
          <h2
            id="professional-services-heading"
            className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance"
          >
            Need Help Bringing Your Website Online?
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            OpenChurch is complete, free and open-source software. You can download it, customise
            it and deploy it on infrastructure you control.
          </p>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            However, we understand that not every church or organisation has the technical
            expertise or time to handle installation, deployment and website development.
          </p>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            PillarsConnect Ltd provides optional professional technology services to help
            churches and businesses establish, customise and improve their digital presence.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <div key={service.title} className="rounded-2xl border bg-background p-6">
              <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary">
                <service.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{service.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {service.text}
              </p>
            </div>
          ))}
        </div>

        {/* Closing statement + contact actions */}
        <div className="mt-12 rounded-2xl border bg-background p-6 sm:p-8 md:grid md:grid-cols-2 md:gap-12 md:items-center">
          <div>
            <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Your software. Your infrastructure. Your choice.
            </h3>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              OpenChurch remains free and open source. Professional services from PillarsConnect
              are entirely optional and quoted separately according to the work required.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground/80">
              Hosting, domain registration and infrastructure costs are billed by your chosen
              providers and remain separate from any professional service fees.
            </p>
          </div>

          <div className="mt-8 md:mt-0 md:border-l md:pl-12">
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full">
                <a
                  href={PILLARSCONNECT.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get Professional Assistance
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              </Button>
              {/* WhatsApp brand green (#075E54) — white text passes WCAG AA
                  (contrast 7.7:1) in both light and dark modes. */}
              <Button
                asChild
                size="lg"
                className="w-full bg-[#075E54] text-white hover:bg-[#06453E]"
              >
                <a
                  href={PILLARSCONNECT.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat with PillarsConnect on WhatsApp (opens in a new tab)"
                >
                  <WhatsAppIcon className="size-4" />
                  Chat with PillarsConnect on WhatsApp
                </a>
              </Button>
            </div>

            <ul className="mt-6 space-y-2.5 text-sm">
              <li>
                <a
                  href={`mailto:${PILLARSCONNECT.primaryEmail}`}
                  className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="size-4 shrink-0" aria-hidden />
                  {PILLARSCONNECT.primaryEmail}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${PILLARSCONNECT.phone}`}
                  className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="size-4 shrink-0" aria-hidden />
                  {PILLARSCONNECT.phoneDisplay}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${PILLARSCONNECT.alternativeEmail}`}
                  className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="size-4 shrink-0" aria-hidden />
                  {PILLARSCONNECT.alternativeEmail}
                  <span className="text-muted-foreground/70">(alternative email)</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}