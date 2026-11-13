'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Church,
  LayoutDashboard,
  Files,
  Palette,
  HeartHandshake,
  Users,
  BookOpen,
  CalendarDays,
  Images,
  Navigation,
  Inbox,
  HandCoins,
  UsersRound,
  Building2,
  Settings2,
  History,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/client/api'
import type { ChurchRole } from '@/lib/permissions'

export type NavItemDef = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: ChurchRole[]
}

const NAV_MAIN: NavItemDef[] = [
  { href: '', label: 'Overview', icon: LayoutDashboard },
]
const NAV_SITE: NavItemDef[] = [
  { href: '/pages', label: 'Website Pages', icon: Files },
  { href: '/appearance', label: 'Appearance', icon: Palette, roles: ['OWNER', 'ADMIN'] },
  { href: '/navigation', label: 'Navigation', icon: Navigation, roles: ['OWNER', 'ADMIN', 'EDITOR'] },
]
const NAV_CONTENT: NavItemDef[] = [
  { href: '/ministries', label: 'Ministries', icon: HeartHandshake },
  { href: '/leadership', label: 'Leadership', icon: Users },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/sermons', label: 'Sermons', icon: BookOpen },
  { href: '/media', label: 'Media Library', icon: Images },
]
const NAV_ENGAGE: NavItemDef[] = [
  { href: '/forms', label: 'Forms & Enquiries', icon: Inbox },
  { href: '/giving', label: 'Giving Settings', icon: HandCoins, roles: ['OWNER', 'ADMIN'] },
]
const NAV_ADMIN: NavItemDef[] = [
  { href: '/users', label: 'Users & Roles', icon: UsersRound, roles: ['OWNER'] },
  { href: '/profile', label: 'Church Profile', icon: Building2, roles: ['OWNER', 'ADMIN'] },
  { href: '/settings', label: 'Website Settings', icon: Settings2, roles: ['OWNER'] },
  { href: '/activity', label: 'Activity Log', icon: History, roles: ['OWNER', 'ADMIN'] },
]

const GROUPS: { title: string; items: NavItemDef[] }[] = [
  { title: '', items: NAV_MAIN },
  { title: 'Website', items: NAV_SITE },
  { title: 'Content', items: NAV_CONTENT },
  { title: 'People & engagement', items: NAV_ENGAGE },
  { title: 'Administration', items: NAV_ADMIN },
]

export function DashboardSidebar({
  slug,
  churchName,
  role,
  isPublished,
  userName,
  userEmail,
}: {
  slug: string
  churchName: string
  role: ChurchRole
  isPublished: boolean
  userName: string
  userEmail: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const base = `/console/${slug}`

  function isActive(href: string): boolean {
    const full = `${base}${href}`
    return href === '' ? pathname === full : pathname === full || pathname.startsWith(`${full}/`)
  }

  async function signOut() {
    setSigningOut(true)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    } catch {
      setSigningOut(false)
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand / church */}
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/console" className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
          <Church className="size-3.5" aria-hidden /> OpenChurch
        </Link>
        <p className="mt-2 font-semibold leading-snug">{churchName}</p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-sidebar-foreground/60">
          <span
            className={cn(
              'size-1.5 rounded-full',
              isPublished ? 'bg-emerald-400' : 'bg-amber-400'
            )}
            aria-hidden
          />
          {isPublished ? 'Website live' : 'Not published'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Dashboard">
        {GROUPS.map((group, gi) => {
          const items = group.items.filter((item) => !item.roles || item.roles.includes(role))
          if (items.length === 0) return null
          return (
            <div key={gi}>
              {group.title ? (
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                  {group.title}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={`${base}${item.href}`}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        isActive(item.href)
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Link href={`/church/${slug}`} target="_blank">
            <ExternalLink className="size-4" aria-hidden /> View website
          </Link>
        </Button>
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span className="grid place-items-center size-8 shrink-0 rounded-full bg-sidebar-accent text-xs font-semibold" aria-hidden>
            {userName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-[11px] text-sidebar-foreground/60 truncate">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-background px-4 h-14">
        <button
          type="button"
          className="rounded-lg border p-2"
          onClick={() => setMobileOpen(true)}
          aria-label="Open dashboard menu"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <p className="font-semibold truncate">{churchName}</p>
        <Link
          href={`/church/${slug}`}
          target="_blank"
          className="rounded-lg border p-2"
          aria-label="View website"
        >
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="relative w-72 max-w-[85%] h-full shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute -right-11 top-3 rounded-lg bg-background border p-2 z-10"
              aria-label="Close menu"
            >
              <X className="size-5" aria-hidden />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border h-screen sticky top-0">
        {sidebar}
      </aside>
    </>
  )
}
