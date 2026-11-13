/**
 * Field definitions that drive the no-code section editor.
 * The builder renders a form from these definitions; the server re-validates
 * everything with Zod before persisting — the UI is never the source of
 * truth.
 */

export type FieldDef =
  | { kind: 'text'; key: string; label: string; placeholder?: string; required?: boolean }
  | { kind: 'textarea'; key: string; label: string; rows?: number; markdown?: boolean; placeholder?: string }
  | { kind: 'image'; key: string; label: string }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'number'; key: string; label: string; min?: number; max?: number }
  | { kind: 'toggle'; key: string; label: string }
  | { kind: 'link'; key: string; label: string }
  | {
      kind: 'list'
      key: string
      label: string
      itemLabel: string
      max?: number
      itemFields: FieldDef[]
    }
