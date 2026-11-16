import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern the use of OpenChurch websites, accounts and church content.',
}

const UPDATED = '17 November 2026'
const VERSION = '2026-11'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">
          OpenChurch platform · version {VERSION} · last updated {UPDATED}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          These terms govern the use of OpenChurch — an open-source church website
          platform. By creating an account or using an instance of the platform you
          agree to them. If you are using a self-hosted instance, the operator of
          that instance may add their own terms; theirs prevail for that instance.
        </p>

        <div className="mt-10 space-y-10">
          <Section title="1. Your account">
            <p>
              You are responsible for the activity on your account and for keeping
              your password safe. Provide accurate information, do not share
              accounts, and use a unique password. Accounts may be suspended for
              abuse, unlawful use or security violations.
            </p>
          </Section>

          <Section title="2. Acceptable use">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Use the platform only for lawful purposes consistent with running a church website.</li>
              <li>Do not publish content you do not have the rights to, including media, text and logos.</li>
              <li>Do not attempt to access other churches&apos; data, other users&apos; accounts, or platform internals.</li>
              <li>Do not use the platform for spam, harassment, malware, or misrepresentation (including fake payment claims).</li>
              <li>Forms and enquiries must not be used to collect data for purposes unrelated to the church&apos;s ministry.</li>
            </ul>
          </Section>

          <Section title="3. Church content">
            <p>
              Churches keep ownership of the content they publish. You grant the
              platform the technical licence needed to store and render that content
              on the church&apos;s public website. You may delete content at any time.
              Prayer requests and counselling enquiries submitted through church
              websites are confidential by default and must be handled only by
              authorised church personnel.
            </p>
          </Section>

          <Section title="4. Giving and payments">
            <p>
              OpenChurch does not process payments and never stores card details.
              When a church links an external payment provider, the giving
              transaction happens entirely on the provider&apos;s platform under the
              provider&apos;s terms. Demonstration payment destinations are fictional
              and clearly labelled — no real money moves through them.
            </p>
          </Section>

          <Section title="5. Availability and liability">
            <p>
              The software is provided under the MIT Licence, &ldquo;as is&quot;,
              without warranty of any kind. The platform does not guarantee
              uninterrupted availability of any instance. To the maximum extent
              permitted by law, the authors and contributors are not liable for
              damages arising from use of the software. See the{' '}
              <Link href="/license" className="text-primary underline underline-offset-2">licence page</Link>{' '}
              or the LICENSE file in the repository for the full licence text.
            </p>
          </Section>

          <Section title="6. Changes">
            <p>
              These terms may be updated as the platform evolves; material changes
              are reflected in the version and date above, and users may be asked to
              re-accept the terms on their next sign-in. Continued use of the
              platform after changes constitutes acceptance.
            </p>
          </Section>

          <Section title="7. Contact and governance">
            <p>
              OpenChurch is an open-source project. Questions about these terms:
              contact the operator of the instance you use, or reach the project via
              its public repository (linked from the{' '}
              <Link href="/" className="text-primary underline underline-offset-2">homepage</Link>).
              Security issues can be reported responsibly — see the repository&apos;s
              SECURITY.md.
            </p>
          </Section>
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          See also our{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>
          {' · '}
          <Link href="/" className="text-primary underline underline-offset-2">OpenChurch home</Link>
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}
