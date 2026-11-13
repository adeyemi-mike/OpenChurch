import Link from 'next/link'
import { KeyRound, MailWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/auth-shell'
import { isMailConfigured } from '@/lib/mail'
import { ResetRequestForm } from './reset-request-form'

export const metadata = { title: 'Forgot password' }

/**
 * Password recovery.
 *
 * The page is honest about this instance's capabilities: when SMTP is not
 * configured there is no "email me a link" form to press, because that
 * would silently do nothing. When SMTP IS configured, a rate-limited,
 * generic-response reset flow is available (see
 * src/app/api/auth/forgot-password).
 */
export default function ForgotPasswordPage() {
  const mailReady = isMailConfigured()

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Here is how to get back into your account."
      footer={
        <>
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {mailReady ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="text-sm leading-relaxed">
              <p className="font-medium">We can email you a reset link</p>
              <p className="mt-1 text-muted-foreground">
                Email delivery is configured on this instance. Enter the email address
                you sign in with and we will send a single-use reset link (valid for
                one hour). For security reasons the response never confirms whether an
                address is registered here.
              </p>
            </div>
          </div>
          <ResetRequestForm />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="text-sm leading-relaxed">
              <p className="font-medium">Self-service reset by email is not available here</p>
              <p className="mt-1 text-muted-foreground">
                This OpenChurch instance has not been configured to send email (the
                optional <code className="rounded bg-muted px-1 py-0.5 text-xs">SMTP_URL</code>{' '}
                setting), so there is no &ldquo;email me a link&rdquo; button to press — we
                would rather tell you that honestly than let a form silently do nothing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-4">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="text-sm leading-relaxed">
              <p className="font-medium">What to do instead</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
                <li>Contact the person who runs your OpenChurch site (your platform administrator).</li>
                <li>
                  Tell them the email address you sign in with — they can set a new password for
                  you from the admin console.
                </li>
                <li>When they do, every signed-in session is revoked, so you can sign in fresh.</li>
              </ol>
              <p className="mt-3 text-muted-foreground">
                Running this instance? Configure{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">SMTP_URL</code> to enable
                self-service resets — see the installation documentation.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  )
}
