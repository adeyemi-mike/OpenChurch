'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Upload, X, FileImage } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Image picker used across onboarding & the builder: choose a file (kept in
 * memory until upload) or paste a URL. Server-side upload/validation happens
 * through the media API.
 */
export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  file,
  onFileChange,
  recommended,
}: {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
  file: File | null
  onFileChange: (f: File | null) => void
  recommended?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Revoke any pending object URL on unmount.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview]
  )

  function handleFile(f: File | null) {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return f ? URL.createObjectURL(f) : null
    })
    onFileChange(f)
  }

  function clearAll() {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    onFileChange(null)
    onChange('')
  }

  const shown = preview ?? (value ? value : null)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          'rounded-xl border-2 border-dashed bg-muted/30 p-3 flex items-center gap-4',
          shown && 'border-solid'
        )}
      >
        <div className="shrink-0">
          {shown ? (
             
            <img
              src={shown}
              alt={`${label} preview`}
              className="size-20 rounded-lg object-cover border bg-background"
            />
          ) : (
            <div className="size-20 rounded-lg border bg-background grid place-items-center text-muted-foreground">
              <FileImage className="size-7" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="size-3.5" aria-hidden /> Choose file
            </Button>
            {(file || value) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
              >
                <X className="size-3.5" aria-hidden /> Remove
              </Button>
            )}
          </div>
          <Input
            placeholder="…or paste an image URL"
            value={file ? '' : value}
            disabled={Boolean(file)}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs"
            aria-label={`${label} URL`}
          />
          {file ? (
            <p className="text-xs text-muted-foreground truncate">
              {file.name} · {(file.size / 1024).toFixed(0)} KB — uploaded when you finish setup
            </p>
          ) : hint ? (
            <p className="text-xs text-muted-foreground">{hint}{recommended ? ` · Recommended: ${recommended}` : ''}</p>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
