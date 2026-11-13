'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BRAND_PRESETS, meetsAA } from '@/lib/color'
import { cn } from '@/lib/utils'

/** Brand colour picker with accessible presets and WCAG contrast feedback. */
export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  const readable = meetsAA('#ffffff', value)
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-10 shrink-0 rounded-lg border bg-background cursor-pointer"
          aria-label={`${label} colour wheel`}
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value.toUpperCase()
            if (/^#[0-9A-F]{0,6}$/.test(v)) onChange(v)
          }}
          className="font-mono w-28"
          aria-label={`${label} hex value`}
        />
        <span
          className="ml-auto hidden sm:grid place-items-center h-10 px-3 rounded-lg text-xs font-semibold border"
          style={{ background: value, color: readable ? '#fff' : '#000' }}
        >
          White text: {readable ? 'readable' : 'low contrast'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1" role="radiogroup" aria-label={`${label} presets`}>
        {BRAND_PRESETS.map((preset) => {
          const hex = label.toLowerCase().startsWith('prim') ? preset.primary : preset.secondary
          return (
            <button
              key={preset.name + hex}
              type="button"
              role="radio"
              aria-checked={value === hex}
              title={preset.name}
              onClick={() => onChange(hex)}
              className={cn(
                'size-7 rounded-full border-2 transition-transform hover:scale-110',
                value === hex ? 'border-foreground ring-2 ring-ring ring-offset-2' : 'border-transparent'
              )}
              style={{ background: hex }}
            />
          )
        })}
      </div>
    </div>
  )
}
