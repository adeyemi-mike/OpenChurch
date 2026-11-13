import { Church, MapPin, Clock, ArrowRight, Check } from 'lucide-react'

/** Stylised product mockup for the landing hero — pure CSS, no screenshots. */
export function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-4xl" aria-hidden>
      <div className="rounded-2xl border bg-background shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="ml-3 flex-1 max-w-xs rounded-md bg-background px-3 py-1 text-[10px] text-muted-foreground truncate">
            grace-community.openchurch.app
          </span>
        </div>
        {/* Mini site header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center size-6 rounded-md bg-[#0B6E4F] text-white">
              <Church className="size-3" />
            </span>
            <span className="text-xs font-semibold">Grace Community</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>About</span>
            <span>Ministries</span>
            <span>Events</span>
            <span className="rounded-full bg-[#0B6E4F] text-white px-2.5 py-1">Give</span>
          </div>
        </div>
        {/* Mini hero */}
        <div className="relative px-5 py-10 sm:py-14 text-center bg-[#124B3E] text-white overflow-hidden">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(255,255,255,.35) 0, transparent 45%), radial-gradient(circle at 85% 70%, rgba(242,179,102,.5) 0, transparent 40%)',
            }}
          />
          <p className="relative text-[10px] uppercase tracking-[0.25em] text-amber-200">Sundays 8:00 & 10:30</p>
          <p className="relative mt-2 text-xl sm:text-2xl font-semibold tracking-tight">Welcome home.</p>
          <p className="relative mt-1 text-xs text-white/70">Whoever you are, there is a seat for you.</p>
          <div className="relative mt-4 flex items-center justify-center gap-2">
            <span className="rounded-full bg-amber-400 text-amber-950 text-[10px] font-semibold px-3 py-1.5">Plan your visit</span>
            <span className="rounded-full border border-white/40 text-[10px] px-3 py-1.5">Watch online</span>
          </div>
        </div>
        {/* Mini content cards */}
        <div className="grid grid-cols-3 gap-3 px-5 py-5 bg-muted/30">
          {[
            { icon: Clock, title: 'When we gather', sub: 'Sun · Wed · Fri' },
            { icon: MapPin, title: 'Find us', sub: 'Lekki, Lagos' },
            { icon: ArrowRight, title: 'What’s new', sub: 'Youth weekend' },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border bg-background p-3">
              <c.icon className="size-3.5 text-[#0B6E4F]" />
              <p className="mt-2 text-[11px] font-medium leading-tight">{c.title}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Floating builder chip */}
      <div className="absolute -left-3 sm:-left-8 top-24 hidden sm:flex items-center gap-2 rounded-xl border bg-background shadow-lg px-3 py-2.5 text-xs">
        <span className="grid place-items-center size-6 rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-3.5" />
        </span>
        <span className="font-medium">Website published</span>
      </div>
      <div className="absolute -right-2 sm:-right-6 -bottom-5 hidden sm:flex items-center gap-2 rounded-xl border bg-background shadow-lg px-3 py-2.5 text-xs">
        <span className="flex -space-x-1.5">
          <span className="size-5 rounded-full border-2 border-background bg-[#0B6E4F]" />
          <span className="size-5 rounded-full border-2 border-background bg-[#B45309]" />
          <span className="size-5 rounded-full border-2 border-background bg-[#7A1F2B]" />
        </span>
        <span className="font-medium">Your colours</span>
      </div>
    </div>
  )
}
