       href={siteHref(ctx, section.button.href)}
            className={cn('ocs-btn mt-8', solid ? 'ocs-btn-secondary' : 'ocs-btn-primary')}
          >
            {section.button.label}
          </Link>
        ) : null}
      </div>
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export function FaqRenderer({ section, ctx }: { section: FaqSection; ctx: SiteRenderContext }) {
  if (!section.items.length) return null
  return (
    <SectionShell section={section} ctx={ctx}>
      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {section.items.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b" style={{ borderColor: 'var(--oc-border)' }}>
              <AccordionTrigger className="text-left text-base sm:text-lg ocs-heading [&>svg]:size-5">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed opacity-80">
                <Markdown>{item.answer}</Markdown>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SectionShell>
  )
}

// ---------------------------------------------------------------------------
// Rich text
// ---------------------------------------------------------------------------

export function RichTextRenderer({ section, ctx }: { section: RichTextSection; ctx: SiteRenderContext }) {
  return (
    <SectionShell section={section} ctx={ctx}>
      <div className="max-w-3xl mx-auto">
        <Markdown>{section.body}</Markdown>
      </div>
    </SectionShell>
  )
}
