import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How OpenChurch collects, stores and protects account information, church website content, forms, enquiries and prayer requests.',
}

const UPDATED = '17 November 2026'
const VERSION = '2026-11'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">
          OpenChurch platform · version {VERSION} · last updated {UPDATED}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          OpenChurch is an open-source platform that helps churches publish their own
          websites. This policy describes what the platform collects, how it is used,
          and the controls available to you. Your own deployment operator (the person
          or organisation running this OpenChurch instance) is the data controller for
          the content stored on it.
        </p>

        <div className="mt-10 space-y-10">
          <Section title="1. Account information">
            <p>
              When you create an account we store your name, email address and a
              bcrypt-hashed password (we never store passwords in plain text). Sign-in
              creates a session record containing a cryptographically hashed session
              token and its expiry — the token itself lives only in your browser&apos;s
              httpOnly cookie. Your acceptance of our{' '}
              <Link href="/terms" className="text-primary underline underline-offset-2">Terms of Service</Link>{' '}
              at registration is recorded with a version and timestamp.
            </p>
          </Section>

          <Section title="2. Church website information">
            <p>
              Content published through the platform — church profiles, service times,
              ministries, leadership, events, sermons and media — is stored on behalf of
              the church and rendered on its public website. Published content is
              publicly accessible by design; draft content is not.
            </p>
          </Section>

          <Section title="3. Forms, enquiries and prayer requests">
            <p>
              When a visitor submits a contact form, prayer request, testimony or
              counselling enquiry, the submission is stored against that church only.
              Prayer requests and counselling enquiries are treated as{' '}
              <strong>sensitive personal information</strong>:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>they are private by default and never shown on public websites;</li>
              <li>access is restricted to authorised church personnel via server-side authorisation;</li>
              <li>submission contents are not logged in application logs;</li>
              <li>they are never exposed through public API responses;</li>
              <li>one church&apos;s submissions are never visible to another church.</li>
            </ul>
          </Section>

          <Section title="4. How information is protected">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Passwords and session tokens are hashed; cookies are httpOnly and SameSite.</li>
              <li>State-changing requests are CSRF-protected; responses carry standard security headers.</li>
              <li>Sign-in, registration and form submission are rate-limited.</li>
              <li>Dashboard APIs verify both authentication and church-scoped permissions on every request.</li>
              <li>Self-hosted deployments keep all data in the operator&apos;s own database.</li>
            </ul>
          </Section>

          <Section title="5. Retention, export and deletion">
            <p>
              <strong>Export.</strong> A church owner can download a complete JSON
              export of their church&apos;s content — pages, sermons, events,
              ministries, leaders, giving settings, forms and enquiry submissions —
              from Dashboard → Website Settings → Your data, at any time. A platform
              administrator can export any user account&apos;s data (profile,
              memberships and audit metadata — never passwords) from the platform
              admin panel.
            </p>
            <p>
              <strong>Deletion.</strong> Submissions, pages and media are deleted from
              the church dashboard; deletion removes the underlying records. A user
              account that does not own any church can be deleted by the platform
              administrator on request. An entire church (with all of its data) can
              be deleted only by the platform administrator, with typed confirmation.
            </p>
            <p>
              <strong>Retention.</strong> Sessions expire after 30 days, and
              password-reset tokens are single-use and expire after one hour;
              expired records are pruned automatically. Operators should define
              retention periods for enquiry data in line with their own data
              protection obligations. To have your personal data removed from an
              instance, contact the operator of that instance; if you cannot reach
              them, use the support address below.
            </p>
          </Section>

          <Section title="6. Your data protection rights">
            <p>
              Depending on where an instance operates, data protection law may give
              you rights over your personal data — for example the{' '}
              <strong>Nigeria Data Protection Act 2023</strong> (NDPA) for
              deployments serving people in Nigeria, or the GDPR/UK GDPR in Europe.
              Typically the deployment operator acts as data controller (and a
              church may be a controller for the enquiries it receives).
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Right of access and portability — served through the export tools described above.</li>
              <li>Right to rectification — edit your profile, or ask the church to correct an enquiry record.</li>
              <li>Right to erasure — served through the deletion tools described above.</li>
              <li>Right to object / withdraw consent — ask the receiving church to stop processing your enquiry.</li>
            </ul>
            <p>
              Exercise these rights by contacting the operator of the instance. This
              page is a technical summary written by the software&apos;s authors, not
              legal advice; operators should obtain qualified legal review for their
              own deployment and publish their own controller identity and contact.
            </p>
          </Section>

          <Section title="7. Third-party services and processors">
            <p>
              OpenChurch itself does not run third-party analytics or advertising. A
              church may link to external services it has configured — for example
              payment pages (such as Paystack or Stripe payment links), video hosting
              (such as YouTube) or maps. When you follow those links, the third
              party&apos;s own privacy policy applies. Giving is processed by the
              external provider, never by OpenChurch: the platform never receives or
              stores card details.
            </p>
            <p>
              The platform&apos;s <em>own</em> processors depend on the deployment:
              self-hosted installations keep data on the operator&apos;s own
              infrastructure; managed deployments may involve a hosting provider
              (such as Vercel), a managed database provider and, where email
              recovery is enabled, an SMTP provider. Deployment operators should
              list the processors that apply to their instance in their own privacy
              notice.
            </p>
          </Section>

          <Section title="8. Contact">
            <p>
              Questions about this policy, data export or deletion requests: contact
              the operator of the OpenChurch instance you use. Self-hosted deployments
              configure their own support address. The software itself is open source
              under the MIT licence — see the{' '}
              <Link href="/license" className="text-primary underline underline-offset-2">licence page</Link>
              ; when the operator has configured a repository link it appears on the{' '}
              <Link href="/" className="text-primary underline underline-offset-2">homepage</Link>.
            </p>
          </Section>
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          See also our{' '}
          <Link href="/terms" className="text-primary underline underline-offset-2">Terms of Service</Link>
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
