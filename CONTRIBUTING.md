# Contributing to OpenChurch

Thank you for considering a contribution! This project exists so churches of every size can have a great website — every contribution serves that mission.

## Getting started

1. Fork the repository and clone your fork.
2. `bun install` (or `npm install`).
3. `cp .env.example .env` — the defaults work for local development.
4. `bun run db:push && bun run db:seed` — schema + demo content.
5. `bun run dev` and open http://localhost:3000.

## Development workflow

1. Create a branch: `git checkout -b feat/my-feature` (or `fix/...`).
2. Make your change. Please keep modules focused — see the architecture map in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to place code in the right layer.
3. Before opening a PR, all of these must pass:

```bash
bun run lint        # zero errors AND zero warnings
bun run typecheck   # tsc --noEmit, strict
bun run test        # vitest suite
```

4. Open a pull request describing **what** changed and **why**. Screenshots help a lot for anything visual.

## Code standards

- **TypeScript everywhere**, no `any` unless interfacing with untyped externals.
- **Server-side validation is the source of truth.** The UI is a convenience; every mutation goes through a Zod-validated API route with permission checks (`requireChurch(slug, permission)`).
- **Tenant safety.** Every database query for tenant data must be scoped by `churchId` from the authenticated context. Never trust a client-supplied church/tenant id.
- **Accessibility.** Semantic HTML, labelled controls, visible focus, 44px touch targets, honest alt text. Colour contrast is checked automatically for church brand colours.
- **Design tokens.** Use the platform tokens (`bg-primary`, `text-muted-foreground`, `border`…). No blue/indigo hardcoding — church sites own their colours, the platform owns its palette.
- **No dead buttons.** If a control exists, it does something real; if a feature is planned, it is documented in docs/FEATURES.md instead of stubbed.

## Adding a theme

Add a `ThemeDef` to `THEMES` in `src/lib/themes/registry.ts`. That is genuinely all — the renderer and builder consume the registry. Keep it denomination-neutral.

## Adding a page section

1. Add a Zod config schema to the discriminated union in `src/lib/sections/types.ts`.
2. Add a renderer component and wire it into `src/components/public/sections/section-renderer.tsx`.
3. Register metadata (name, icon, category, defaults, field definitions) in `src/lib/sections/registry.ts` — the builder form generates itself from the field definitions.
4. Add tests for the schema in `tests/sections.test.ts`.

## Adding a translation

Create `src/lib/i18n/<locale>.ts` mirroring `en.ts`, register it in `LOCALES` in `src/lib/i18n/index.ts`, and wire the locale switcher if one does not exist yet.

## Reporting bugs

Open an issue with: what you expected, what happened, steps to reproduce, browser/device, and (if possible) a screenshot. Security issues follow [SECURITY.md](SECURITY.md) — please do not open public issues for those.
