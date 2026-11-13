import 'server-only'
import nodemailer from 'nodemailer'

/**
 * Email delivery abstraction. Credentials stay on the server (SMTP_URL env).
 *
 * When SMTP_URL is not configured the platform reports `configured: false`
 * and callers must present a truthful message — we never pretend an email
 * has been sent.
 *
 * Supported URL shape (see .env.example):
 *   SMTP_URL="smtp://user:password@smtp.example.com:587"
 *   SMTP_URL="smtps://user:password@smtp.example.com:465"
 */

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL)
}

export type MailError = { configured: false } | { configured: true; sent: boolean }

function transporter() {
  const url = process.env.SMTP_URL
  if (!url) throw new Error('SMTP_URL is not configured')
  return nodemailer.createTransport(url)
}

export async function sendMail(options: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<MailError> {
  if (!isMailConfigured()) return { configured: false }
  const from = process.env.MAIL_FROM ?? 'OpenChurch <no-reply@openchurch.local>'
  try {
    await transporter().sendMail({ from, ...options })
    return { configured: true, sent: true }
  } catch (err) {
    console.error('[mail] send failed:', err instanceof Error ? err.message : err)
    return { configured: true, sent: false }
  }
}

/** Wrap a reset link in a plain, readable email body. */
export function passwordResetEmail(link: string, minutes = 60): { subject: string; text: string } {
  return {
    subject: 'Reset your OpenChurch password',
    text: [
      'Hello,',
      '',
      'We received a request to reset the password for your OpenChurch account.',
      'This link is valid for ' + minutes + ' minutes and can be used once:',
      '',
      link,
      '',
      'If you did not request this, you can safely ignore this email — your',
      'password will stay unchanged.',
      '',
      '— The OpenChurch team',
    ].join('\n'),
  }
}
