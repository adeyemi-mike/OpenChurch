'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { MediaPicker } from '@/components/builder/media-picker'
import type { FieldDef } from '@/lib/sections/fields'
import { cn } from '@/lib/utils'

type Config = Record<string, unknown>

/**
 * Renders an editor form from the section registry's field definitions.
 * The server re-validates everything with Zod on save — this UI is a
 * convenience, never the source of truth.
 */
export function SectionFieldsEditor({
  fields,
  values,
  onChange,
  slug,
}: {
  fields: FieldDef[]
  values: Config
  onChange: (key: string, value: unknown) => void
  slug: string
}) {
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const value = values[field.key]
        switch (field.kind) {
          case 'text':
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`f-${field.key}`}>{field.label}</Label>
                <Input
                  id={`f-${field.key}`}
                  value={typeof value === 'string' ? value : ''}
                  placeholder={field.placeholder}
                  onChange={(e) => onChange(field.key, e.target.value)}
                />
              </div>
            )
          case 'textarea':
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`f-${field.key}`}>
                  {field.label}
                  {field.markdown ? (
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      (Markdown supported: **bold**, ## headings, [links](url))
                    </span>
                  ) : null}
                </Label>
                <Textarea
                  id={`f-${field.key}`}
                  rows={field.rows ?? 4}
                  value={typeof value === 'string' ? value : ''}
                  placeholder={field.placeholder}
                  onChange={(e) => onChange(field.key, e.target.value)}
                />
              </div>
            )
          case 'image':
            return (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                <div className="flex items-center gap-3">
                  {typeof value === 'string' && value ? (
                     
                    <img
                      src={value}
                      alt={`${field.label} preview`}
                      className="size-16 rounded-lg border object-cover shrink-0"
                    />
                  ) : (
                    <div className="size-16 rounded-lg border bg-muted/50 grid place-items-center text-muted-foreground/60 text-xs shrink-0">
                      None
                    </div>
                  )}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPickerFor(field.key)}>
                      Choose from library
                    </Button>
                    <Input
                      placeholder="…or paste an image URL"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => onChange(field.key, e.target.value)}
                      className="text-xs"
                      aria-label={`${field.label} URL`}
                    />
                  </div>
                </div>
                {pickerFor === field.key ? (
                  <MediaPicker
                    open
                    slug={slug}
                    onClose={() => setPickerFor(null)}
                    onSelect={(url) => onChange(field.key, url)}
                  />
                ) : null}
              </div>
            )
          case 'select':
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`f-${field.key}`}>{field.label}</Label>
                <select
                  id={`f-${field.key}`}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )
          case 'number':
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`f-${field.key}`}>{field.label}</Label>
                <Input
                  id={`f-${field.key}`}
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={typeof value === 'number' ? value : ''}
                  onChange={(e) => onChange(field.key, Number(e.target.value))}
                />
              </div>
            )
          case 'toggle':
            return (
              <div key={field.key} className="flex items-center justify-between rounded-lg border px-3.5 py-3">
                <Label htmlFor={`f-${field.key}`} className="mb-0">{field.label}</Label>
                <Switch
                  id={`f-${field.key}`}
                  checked={Boolean(value)}
                  onCheckedChange={(v) => onChange(field.key, v)}
                />
              </div>
            )
          case 'link':
            return (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Button label"
                    value={((value as { label?: string })?.label) ?? ''}
                    onChange={(e) => onChange(field.key, { ...((value as object) ?? {}), label: e.target.value })}
                    aria-label={`${field.label} label`}
                  />
                  <Input
                    placeholder="Link, e.g. /about"
                    value={((value as { href?: string })?.href) ?? ''}
                    onChange={(e) => onChange(field.key, { ...((value as object) ?? {}), href: e.target.value })}
                    aria-label={`${field.label} link`}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Internal links start with / — e.g. /about or /contact.
                </p>
              </div>
            )
          case 'list':
            return (
              <ListField
                key={field.key}
                field={field}
                value={Array.isArray(value) ? (value as Config[]) : []}
                onChange={(v) => onChange(field.key, v)}
                slug={slug}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}

function ListField({
  field,
  value,
  onChange,
  slug,
}: {
  field: Extract<FieldDef, { kind: 'list' }>
  value: Config[]
  onChange: (items: Config[]) => void
  slug: string
}) {
  function updateItem(index: number, key: string, itemValue: unknown) {
    const items = [...value]
    items[index] = { ...items[index], [key]: itemValue }
    onChange(items)
  }
  function move(index: number, dir: -1 | 1) {
    const items = [...value]
    const target = index + dir
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    onChange(items)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{field.label}</Label>
        <span className="text-xs text-muted-foreground">
          {value.length}
          {field.max ? `/${field.max}` : ''}
        </span>
      </div>
      <div className="space-y-3">
        {value.map((item, index) => (
          <div key={index} className={cn('rounded-lg border bg-muted/20 p-3 space-y-3')}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5">
                <GripVertical className="size-3.5" aria-hidden /> {field.itemLabel} {index + 1}
              </p>
              <div className="flex items-center gap-0.5">
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move up`} onClick={() => move(index, -1)} disabled={index === 0}>
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move down`} onClick={() => move(index, 1)} disabled={index === value.length - 1}>
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  aria-label={`Remove ${field.itemLabel} ${index + 1}`}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            <SectionFieldsEditor
              fields={field.itemFields}
              values={item}
              onChange={(key, v) => updateItem(index, key, v)}
              slug={slug}
            />
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, Object.fromEntries(field.itemFields.map((f) => [f.key, f.kind === 'toggle' ? false : f.kind === 'number' ? 3 : '']))])}
        disabled={field.max !== undefined && value.length >= field.max}
      >
        <Plus className="size-4" aria-hidden /> Add {field.itemLabel.toLowerCase()}
      </Button>
    </div>
  )
}
