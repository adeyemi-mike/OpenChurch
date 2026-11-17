import {
  ArrowUpRight,
  Building2,
  Church,
  Code2,
  Globe2,
  Mail,
  MessageCircle,
  Phone,
  Rocket,
  Wrench,
} from 'lucide-react'

const WHATSAPP_URL =
  'https://wa.me/2348143214024?text=Hello%20PillarsConnect%2C%20I%20found%20your%20services%20through%20OpenChurch.%20I%20would%20like%20to%20enquire%20about%20professional%20website%20development%20or%20technical%20assistance.'

const SERVICES = [
  {
    icon: Rocket,
    title: 'OpenChurch Installation & Deployment',
    description:
      'Get help installing, configuring and deploying OpenChurch on hosting infrastructure you own or control.',
  },
  {
    icon: Globe2,
    title: 'Custom Domain Setup',
    description:
      'Connect your domain, configure DNS and HTTPS with your hosting provider, and verify that everything resolves.',
  },
  {
    icon: Church,
    title: 'Custom Church Websites',
    description:
      'Plan a church website around your identity, with ministry pages, events, sermons, media and visitor enquiries.',
  },
  {
    icon: Building2,
    title: 'Business Website Development',
    description:
      'Professional websites for businesses, entrepreneurs, schools, non-profits and service providers.',
  },
  {
    icon: Code2,
    title: 'Website Customisation',
    description:
      'Improve an existing website or OpenChurch installation with tailored design, features and integrations.',
  },
  {
    icon: Wrench,
    title: 'Technical Assistance',
    description:
      'Get practical help with configuration, troubleshooting, performance and deployment.',
  },
]

export function PillarsConnectServices() {
  return (
    <section id="professional-services" className="border-t bg-muted/30 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Professional services by PillarsConnect Ltd
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Need Help Bringing Your Website Online?
          </h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            OpenChurch is complete, free and open-source software. Its frontend and backend source
            code are released under the MIT licence, so you can download it, customise it and deploy
            it on infrastructure you control.
          </p>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            If you need technical expertise or time to handle setup or website development,
            PillarsConnect Ltd offers optional professional services to churches, businesses and
            organisations. Hiring PillarsConnect is never required to use OpenChurch.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <article
              key={service.title}
              className="rounded-2xl border bg-background p-6 transition-shadow hover:shadow-md"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <service.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">{service.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {service.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border bg-background p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Your software. Your infrastructure. Your choice.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              OpenChurch remains free and open source. You manage your hosting, database, email
              delivery and other infrastructure. PillarsConnect&apos;s professional services are
              optional, independently provided and quoted separately; hosting, domains and
              recurring infrastructure costs are not included by default.
            </p>
          </div>
          <div className="mt-6 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col xl:flex-row">
            <a
              href="https://pillarsconnect.online"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Get Professional Assistance
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with PillarsConnect on WhatsApp"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#16845b] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#126f4c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Chat with Us on WhatsApp
            </a>
          </div>
        </div>

        <address className="mt-6 flex flex-col items-center justify-center gap-x-7 gap-y-3 text-sm not-italic text-muted-foreground sm:flex-row sm:flex-wrap">
          <a className="inline-flex items-center gap-2 hover:text-foreground" href="mailto:info@pillarsconnect.online">
            <Mail className="size-4" aria-hidden="true" />
            info@pillarsconnect.online
          </a>
          <a className="inline-flex items-center gap-2 hover:text-foreground" href="tel:+2347064846659">
            <Phone className="size-4" aria-hidden="true" />
            +2347064846659
          </a>
          <a className="inline-flex items-center gap-2 hover:text-foreground" href="mailto:pillarsconnect7@gmail.com">
            <Mail className="size-4" aria-hidden="true" />
            pillarsconnect7@gmail.com
          </a>
        </address>
      </div>
    </section>
  )
}

