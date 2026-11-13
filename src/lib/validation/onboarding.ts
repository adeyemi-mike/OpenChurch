import { z } from 'zod'

/** Shared validation schemas for platform accounts & onboarding. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(200)

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(100, 'That password is too long.')
  .regex(/[a-zA-Z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(100),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
})

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const onboardingInfoSchema = z.object({
  name: z.string().trim().min(2, 'Enter the church name.').max(120),
  denomination: z.string().trim().max(120).optional().default(''),
  country: z.string().trim().length(2, 'Select a country.').default('NG'),
  region: z.string().trim().max(120).default(''),
  city: z.string().trim().max(120).default(''),
  address: z.string().trim().max(240).default(''),
  phone: z.string().trim().max(40).default(''),
  email: z.string().trim().email('Enter a valid email.').max(200).optional().or(z.literal('')),
  timezone: z.string().trim().max(60).default('UTC'),
  currency: z.string().trim().max(8).default('USD'),
})

export const onboardingIdentitySchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a primary colour.'),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a secondary colour.'),
  fontKey: z.string().trim().max(40),
  logoUrl: z.string().trim().max(500).optional().default(''),
  heroImageUrl: z.string().trim().max(500).optional().default(''),
})

export const leaderInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2, 'Add a role, e.g. Senior Pastor.').max(120),
  bio: z.string().trim().max(2000).default(''),
})

export const ministryInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  leaderName: z.string().trim().max(120).default(''),
  meetingTime: z.string().trim().max(120).default(''),
})

export const serviceInputSchema = z.object({
  name: z.string().trim().min(2, 'Name the service.').max(120),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h).'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal('')),
  notes: z.string().trim().max(200).default(''),
})

export const locationInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(240).default(''),
  city: z.string().trim().max(120).default(''),
  country: z.string().trim().length(2).default('NG'),
})

export const onboardingStructureSchema = z.object({
  leaders: z.array(leaderInputSchema).max(20).default([]),
  ministries: z.array(ministryInputSchema).max(20).default([]),
  services: z.array(serviceInputSchema).max(14).default([]),
  locations: z.array(locationInputSchema).max(10).default([]),
})

export const onboardingDesignSchema = z.object({
  themeKey: z.string().trim().max(40),
})

export const createChurchSchema = z.object({
  info: onboardingInfoSchema,
  identity: onboardingIdentitySchema,
  structure: onboardingStructureSchema,
  design: onboardingDesignSchema,
  slug: z.string().trim().regex(slugRegex, 'Use lowercase letters, numbers and dashes.').min(2).max(40),
  publish: z.boolean().default(false),
})

export type CreateChurchInput = z.infer<typeof createChurchSchema>
export type OnboardingInfo = z.infer<typeof onboardingInfoSchema>
export type OnboardingIdentity = z.infer<typeof onboardingIdentitySchema>
export type OnboardingStructure = z.infer<typeof onboardingStructureSchema>
