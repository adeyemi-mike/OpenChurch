'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'
import { apiFetch, ApiClientError } from '@/lib/client/api'

const formSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(120),
  email: z.string().trim().email('Enter a valid email address.').or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, 'Please write a short message.').max(4000),
  company: z.string().optional(), // honeypot — humans never see it
})

type FormValues = z.infer<typeof formSchema>

export function PublicContactForm({
  slug,
  formType,
  successMessage,
  variant = 'light',
}: {
  slug: string
  formType: string
  successMessage: string | null
  variant?: 'light' | 'dark'
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { name: '', email: '', phone: '', subject: '', message: '', company: '' } })

  const inputClass =
    variant === 'dark'
      ? 'w-full rounded-[var(--oc-radius)] bg-white/10 border border-white/20 text-white placeholder:text-white/40 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/40'
      : 'w-full rounded-[var(--oc-radius)] bg-white border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2'

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setStatus('sending')
    try {
      // apiFetch attaches the CSRF double-submit header required behind
      // gateways that rewrite the Host header (preview/prod proxy).
      await apiFetch(`/api/public/${slug}/submit`, {
        method: 'POST',
        body: JSON.stringify({ ...values, type: formType }),
      })
      setStatus('sent')
      reset()
    } catch (err) {
      setServerError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not send your message.'
      )
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <div
        className="rounded-[var(--oc-radius)] p-8 text-center"
        style={{
          background: variant === 'dark' ? 'rgb(255 255 255 / 0.08)' : 'var(--oc-bg-soft)',
        }}
        role="status"
      >
        <CheckCircle2 className="size-10 mx-auto" style={{ color: 'var(--oc-secondary)' }} aria-hidden />
        <p className="mt-3 font-semibold">
          {successMessage ?? 'Thank you — your message has been received.'}
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm underline underline-offset-4 opacity-70 hover:opacity-100"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError ? (
        <p role="alert" className="text-sm rounded-[var(--oc-radius)] px-3 py-2.5" style={{ background: 'rgb(190 40 40 / 0.1)', color: '#b91c1c' }}>
          {serverError}
        </p>
      ) : null}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pcf-name" className="block text-sm font-medium mb-1.5">
            Your name *
          </label>
          <input id="pcf-name" {...register('name')} className={inputClass} autoComplete="name" />
          {errors.name ? <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.name.message}</p> : null}
        </div>
        <div>
          <label htmlFor="pcf-email" className="block text-sm font-medium mb-1.5">
            Email {formType === 'PRAYER' || formType === 'COUNSELLING' ? '' : '*'}
          </label>
          <input id="pcf-email" type="email" {...register('email')} className={inputClass} autoComplete="email" />
          {errors.email ? <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.email.message}</p> : null}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pcf-phone" className="block text-sm font-medium mb-1.5">
            Phone (optional)
          </label>
          <input id="pcf-phone" type="tel" {...register('phone')} className={inputClass} autoComplete="tel" />
        </div>
        <div>
          <label htmlFor="pcf-subject" className="block text-sm font-medium mb-1.5">
            Subject (optional)
          </label>
          <input id="pcf-subject" {...register('subject')} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="pcf-message" className="block text-sm font-medium mb-1.5">
          Your message *
        </label>
        <textarea id="pcf-message" rows={5} {...register('message')} className={inputClass} />
        {errors.message ? <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.message.message}</p> : null}
      </div>
      {/* Honeypot — hidden from humans, catches bots */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="pcf-company">Company</label>
        <input id="pcf-company" {...register('company')} tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" className="ocs-btn ocs-btn-primary w-full sm:w-auto" disabled={status === 'sending'}>
        {status === 'sending' ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
          </>
        ) : (
          <>
            <Send className="size-4" aria-hidden /> Send message
          </>
        )}
      </button>
      {formType === 'PRAYER' || formType === 'COUNSELLING' ? (
        <p className="text-xs opacity-60">
          Your message is kept confidential and visible only to authorised pastoral staff.
        </p>
      ) : null}
    </form>
  )
}
