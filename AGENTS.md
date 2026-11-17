# AGENTS.md

Rules for anyone (human or agent) changing this repo. They are rules, not suggestions.

## Project

- Local-first desktop calendar: no backend, no accounts. Sync may come later.
- AI is optional and uses the user's own provider keys (`@tempi/ai`, desktop main only). Keys are encrypted with `safeStorage` and never reach the renderer, logs or IPC answers. With no key saved, nothing calls a provider.
- Bun monorepo: `apps/desktop` (Electron), `apps/web` (Next.js, static export, embedded by desktop), `apps/www` (landing, deployed on its own to Vercel, not static), `packages/*` (shared).
- Use Bun only: `bun install`, `bun run`, `bunx`. Add shared versions to the root `catalog`.
- Verify every change with `bun run check`, `bun run typecheck` and `bun run test`.
- Git hooks (Husky) enforce this: `pre-commit` runs Biome on staged files and the typecheck, and `pre-push` runs the tests. Never bypass them with `--no-verify`.

## Workflow: issue → branch → PR

**Never merge.** Agents never run `gh pr merge`, never `git merge` into `main`, never push to `main` and never force-push. Only the user merges.

**No AI attribution.** Commits, pull requests, issues and pushes never include `Co-Authored-By: Claude …`, "Generated with Claude Code", or any other Claude, Anthropic or AI attribution. This overrides any tool or agent default.

### 1. Issue (one per request to add, remove or change something)

- Before creating the issue, ask the user about anything unclear: scope, behavior, UI, data. The issue must leave no open questions.
- Use an imperative title of 72 characters or fewer, for example `Add week view to calendar`.
- The body uses exactly these sections, each kept short and specific:

```md
## Goal

One sentence: what and why.

## Tasks

- [ ] Concrete step (file/area it touches)

## Acceptance criteria

- [ ] Verifiable outcome

## Out of scope

- What not to do
```

- Create it with `gh issue create --title "…" --body "…"`, then wait. Start work only when the user says to do that issue.

### 2. Branch

```sh
git switch main
git pull --ff-only origin main
git switch -c <type>/<issue-number>-<short-slug>   # e.g. feat/12-week-view
```

- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
- Use one branch per issue, and touch only what the issue asks for.
- Use Conventional Commits with the app as scope, for example `feat(web): add week view`.

### 3. Pull request

- Before pushing, `bun run check`, `bun run typecheck` and `bun run test` must pass.
- Push and open the PR:

```sh
git push -u origin <branch>
gh pr create --base main --title "<conventional commit title>" --body "…"
```

- The first line of the body must be `Closes #<issue-number>` so GitHub closes the issue on merge. A PR without it is incomplete.
- Keep the PR body short:

```md
Closes #<issue-number>

## Summary

- 1–3 bullets: what changed.

## Testing

- How it was verified.
```

- Then stop and tell the user the PR is ready. If the user asks for changes, commit them to the same branch and push again.

### Allowed `gh` commands

- `gh auth status`, `gh repo view`
- `gh issue create`, `gh issue list`, `gh issue view`, `gh issue comment`, and `gh issue edit` (only on issues the agent created)
- `gh pr create --base main`, `gh pr list`, `gh pr view`, `gh pr diff`, `gh pr checks`, `gh pr comment`, and `gh pr edit` (title or body of its own PR)

Anything else is forbidden unless the user asks for that exact command, in particular `gh pr merge`, `gh pr close`, `gh issue close`, `gh issue delete`, `gh repo edit` or `gh repo delete`, `gh release *`, and mutating `gh api` calls.

## Architecture

- Domain logic and ports (interfaces such as `EventRepository`) live in `packages/core`. Core imports no Electron, Next, React or Node APIs. Its only runtime dependencies are zod and `rrule-temporal` (RRULE expansion).
- Validation has a single source of truth: the zod schemas in `packages/core` (`newEventInputSchema`, `eventPatchSchema`, `profileInputSchema`, …). Use cases, IPC handlers and web forms all reuse them. Never rewrite a rule by hand or duplicate a schema elsewhere; if a rule changes, change the core schema.
- Use zod for all runtime validation in every package. Don't hand-write validation with plain JS checks.
- Errors cross every boundary (use cases, IPC) as plain data: `DomainError = { code, issues[] }`, and each issue is `{ key, params?, field?, detail }`.
  - Return every issue (zod issues flattened), never only the first.
  - `key` is an `ErrorKey` from core's `ERROR_KEYS` (for example `validation.required`, `event.endBeforeStart`). Schema messages are always keys, never user-facing text. Built-in zod errors map to `validation.<code>`.
  - `params` carries interpolation values (`{ maximum: 1440 }`).
  - `detail` is an English description for developers (the original zod message or a backend description with ids). Log it; never show it to users.
- Rules that need stored data (the calendar exists, the default calendar can't be deleted) stay in use cases and return the same `DomainError` via `fail(code, key, { field, detail })`.
- Only the UI translates. Backend code (core, db, ipc, desktop main services) never translates errors. Web and desktop translate `key` with `params` through `@tempi/i18n` (`issueTranslation(issue)`).
- Adding an `ErrorKey` requires its `en` and `es` translations in `@tempi/i18n`. The typecheck fails otherwise.
- Adapters implement ports: SQLite in desktop today, a sync or HTTP adapter later. To swap storage, write a new adapter; never change the domain.
- Prepare for sync now: UUIDv7 text IDs, `created_at`/`updated_at` timestamps, `deleted_at` soft deletes, and no autoincrement IDs.
- Dependency direction: `apps/*` → `packages/ipc` / `packages/db` / `packages/i18n` / `packages/ai` → `packages/core`. Core depends only on zod and `rrule-temporal`. Packages never import from apps. Only `apps/desktop` (main process) imports `@tempi/ai`; web never does, and AI schemas and types for web live in core.

## Structure

```
packages/
  core/                      @tempi/core: domain + ports + zod schemas; runtime deps: zod, rrule-temporal
    src/
      domain/                entities, value objects and their zod schemas (event.ts, recurrence.ts)
      ports/                 interfaces (event-repository.ts, clock.ts, id-generator.ts)
      use-cases/             application logic using ports only (create-event.ts)
      index.ts               public API; consumers import only from here
    package.json
    tsconfig.json
  db/                        @tempi/db: SQLite adapter (node:sqlite)
    src/
      migrations/            0001_init.sql, 0002_….sql (ordered, forward-only)
      repositories/          implement core ports (sqlite-event-repository.ts)
      open-database.ts       open, pragmas, run migrations
      index.ts
  ipc/                       @tempi/ipc: contract between desktop and web
    src/
      channels.ts            channel names ('events:list', …)
      schemas.ts             runtime payload validation (composes core zod schemas)
      desktop-api.ts         DesktopApi type exposed by preload, Window augmentation
      ipc-client.ts          renderer client: calls the use cases through window.desktop, validates answers
      index.ts
  ai/                        @tempi/ai: optional AI processes over user-owned keys (AI SDK, ElevenLabs); desktop main only
    src/
      assistant.ts           streams one assistant reply (AI SDK `streamText`) with read tools and change proposals
      test-key.ts            checks a provider key without spending tokens
      voices.ts              ElevenLabs voices
      text-model.ts          the chosen text model, called with the user's key
      index.ts
  i18n/                      @tempi/i18n: shared en/es translations for web and desktop (plain data, no i18n runtime)
    src/
      locales/               en.ts (source of keys), es.ts (must match en exactly)
      index.ts               resources, namespaces (common, errors), issueTranslation

apps/desktop/src/
  main.ts                    bootstrap only: app lifecycle, wiring
  app-protocol.ts            app:// handler for the web export
  window-state.ts
  database.ts                opens @tempi/db in userData
  ai/                        encrypted key store, AI settings file, AI service and assistant chat behind `ai:*`
  ipc/                       one file per domain (events.ts), register-ipc.ts
  preload.ts                 exposes DesktopApi; no logic (bundled to dist/preload.cjs)

apps/web/src/
  app/                       routes only (layout.tsx, page.tsx); thin, compose features
  features/<feature>/        components/, hooks/ (assistant, calendar, events, settings)
  components/                shared app components
  components/ui/             generated (shadcn); do not edit by hand
  providers/                 api (`useApi()`), query client, i18n and theme providers
  lib/                       small framework-free helpers

apps/www/src/
  app/[lang]/                routes under /en and /es (layout.tsx, page.tsx, dictionaries.ts)
  app/[lang]/dictionaries/   en.json, es.json (same keys)
  features/<section>/        one folder per landing section
  components/ui/             generated (shadcn); do not edit by hand
  lib/                       i18n locales, GSAP setup, helpers
  proxy.ts                   redirects to the visitor's locale
```

- Add a new package only for a distinct responsibility, such as a sync engine. Name it `@tempi/<name>`, and give it a `package.json` with `"exports": { ".": "./src/index.ts" }` and `"test": "bun test"`, plus a `tsconfig.json` that extends `../../tsconfig.base.json`.
- Packages ship TypeScript source with no build step. Consumers compile them: Next uses `transpilePackages`, and desktop bundles its main process.
- Use kebab-case file names. Use named exports only, with no default exports except where Next requires them.

## Testing

- Use `bun test` only (`import { describe, expect, test } from 'bun:test'`). Don't add Jest, Vitest or other test runners.
- Colocate tests as `*.test.ts` next to the code they test.
- Write tests only for backend-like code:
  - `core`: test use cases with in-memory fakes of the ports.
  - `db`: test repositories against `new DatabaseSync(':memory:')` with real migrations. `node:sqlite` runs under Bun, so the tests exercise the same API Electron uses.
  - `ipc`: test schemas with valid and invalid payloads.
  - `i18n`: test that every locale has the same keys and placeholders as `en` and covers every core `ErrorKey`.
  - `apps/desktop`: test main-process services.
- No UI or component tests in `apps/web`. The user does all visual testing by hand.
- Never install Playwright, Puppeteer or similar browser automation tools.
- Test behavior, not implementation. No snapshot tests for logic.
- Every bug fix comes with a test that fails without the fix.

## Electron security

- Keep `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` and `webSecurity: true`. Never relax them.
- Load only `app://tempi` (packaged) or the dev server. Send every other URL to `shell.openExternal` through `setWindowOpenHandler` and `will-navigate`.
- Deny permission requests and checks by default (`session.setPermissionRequestHandler`, `setPermissionCheckHandler`). The only exception is audio-only `media` from the trusted origin, for dictation (`permissions.ts`); on macOS it also asks the OS (`systemPreferences.askForMediaAccess`).
- Set a strict Content-Security-Policy. Never load remote scripts, and never use `eval` or `new Function`.
- Never weaken the `app://` protocol handler's path-traversal guard.
- Enable Electron Fuses in release builds: disable `RunAsNode` and `EnableNodeOptionsEnvironmentVariable`, and enable `OnlyLoadAppFromAsar`.
- Keep Electron on a supported major version.

## IPC

- Use only `ipcRenderer.invoke` and `ipcMain.handle`. Don't use `send`/`sendSync` for request/response.
- Exception, for streams: an assistant reply (`ai:chat`) starts with an invoke that passes the usual sender and payload checks and answers at once; its events then flow over one `MessagePort` per reply, which the main process sends to the calling frame on `PUSH_CHANNELS.ai.chatPort` (`senderFrame.postMessage`). The preload keeps the port (ports can't cross `contextBridge`) and forwards each message to the page's listener; the renderer validates every event with core's `assistantStreamEventSchema`. Closing the port (`stopChat`) aborts the reply. Use this pattern only for streams, never for plain request/response.
- Name channels `domain:action`, for example `events:list` and `events:upsert`. Use one handler per channel.
- The preload exposes small, typed functions with `contextBridge`, for example `window.desktop.events.list(range)`. Never expose `ipcRenderer`, Node modules or generic `invoke(channel, …)` passthroughs.
- In every handler, check `event.senderFrame.url` against the trusted origin, then validate the payload at runtime with the core zod schemas. TypeScript types do not exist at runtime.
- Pass only plain serializable data. Return results; don't throw raw errors across IPC.
- Define the bridge type once (`DesktopApi`), share it with web, and declare it on `Window`.
- Channels are use cases (`events:create`), never repository operations. The renderer never touches repositories.
- Each handler runs its core use case inside one SQLite transaction through `@tempi/db`'s `createTransactionQueue`: calls are serialized, and a thrown error or a failed `Result` rolls back every write.
- `apps/web` must not assume Electron: feature-detect `window.desktop` and go through the API provider (`useApi()`).

## SQLite (`node:sqlite`)

- The database lives in the main process only, at `app.getPath('userData')/tempi.db`. The renderer reaches it only through IPC.
- Set on open: `journal_mode = WAL`, `foreign_keys = ON`, `synchronous = NORMAL` and `busy_timeout = 5000`.
- Use prepared statements with bound parameters only. Never build SQL from strings.
- Wrap multi-statement writes in a transaction (`BEGIN IMMEDIATE` … `COMMIT`/`ROLLBACK`). Use cases get theirs from the IPC handler's transaction queue.
- Migrations: write ordered SQL files tracked by `PRAGMA user_version`, run each in a transaction, and only move forward. Back up with `VACUUM INTO` before migrating.
- `DatabaseSync` blocks the main process. Keep queries indexed and small. Move bulk work (import, export, search) to a `utilityProcess`.
- Store every instant (`created_at`, `updated_at`, `deleted_at`, event start/end) as UTC ISO-8601 text. Convert to the user's time zone only for display. Store the event's IANA time zone separately, and recurrence as RFC 5545 `RRULE` text.
- Close the database on `before-quit`.

## TypeScript 7

- `tsc` is the native compiler. Don't depend on the TypeScript JS API (custom transformers, ts-node, language-service plugins).
- All shared options belong in `tsconfig.base.json`. App configs only extend it and add what is specific to them.
- Don't use the removed or legacy options: `baseUrl`, `moduleResolution: node`/`node10`, `outFile`, `target: ES5`, `downlevelIteration`, `esModuleInterop: false`. Use `paths` without `baseUrl`.
- Write erasable syntax only: no `enum`, `namespace` or parameter properties. Use `as const` objects and union types instead.
- Use `import type` for type-only imports (`verbatimModuleSyntax`).
- No `any`. Use `unknown` and narrow it. Use `satisfies` for typed literals. Use `!` only with a comment explaining why.
- Validate external data (IPC, files, storage) at the boundary with zod, then trust the types inside. Derive types from schemas (`z.input`/`z.output`) instead of declaring them twice.

## React (19, Next static export)

- With static export there is no runtime server: no server actions, no dynamic route handlers, no middleware, no `headers()`/`cookies()`. Dynamic routes need `generateStaticParams`.
- Data comes from the client through hooks that wrap `useApi()`. Components never call `window.desktop` directly.
- Fetch and mutate data with TanStack Query (`@tanstack/react-query`) inside feature hooks (`features/<feature>/hooks/use-*.ts`). Components call those hooks, never `useQuery`/`useMutation` with the API directly.
  - Query and mutation functions return `unwrap(await api.<domain>.<action>(…))` from `lib/query.ts`, so failures arrive as a typed `DomainError` in `error`.
  - Take keys only from `queryKeys` in `lib/query.ts`. After a successful mutation, invalidate the domain's root key (`queryKeys.events.all`) or write the returned value with `setQueryData`, so every view updates without repeated code.
  - Feedback is centralized in `QueryProvider`: every failed query or mutation logs each issue's `detail` and shows one translated error toast. Don't call `toast` for errors or successes in data hooks; declare `meta` instead: `successMessage` (a `common.toasts` key) on every create, update and delete mutation, and `handlesFieldErrors: true` on mutations whose form shows field errors.
  - Keep the `QueryProvider` defaults (`networkMode: 'always'`, `staleTime: Infinity`, no retries or refetch on focus): data is local and only this app writes it.
- Derive values during render instead of syncing them into state. Use `useEffect` only to synchronize with external systems.
- Use `useSyncExternalStore` for external stores. Avoid prop drilling beyond two levels: lift state or use context.
- Use stable keys from IDs, never array indexes.
- Don't add `useMemo`, `useCallback` or `memo` without a measured problem.
- Keep components small and colocated. Lift state only as far as needed.
- Accessibility is required: semantic elements, labelled controls and full keyboard navigation (the calendar grid included).
- `src/components/ui` is generated code. Don't edit it by hand.

## UI

- Before building UI, list `apps/web/src/components/ui` and reuse what exists. If a component is missing, never create or install it: ask the user, naming the missing shadcn component or an npm alternative.
- Use `drawer` for side panels. Never use `sheet`.
- Show a toast on every create, update and delete, through the mutation's `meta.successMessage` (see React). Show an `alert-dialog` to confirm before every delete.
- Build forms with React Hook Form and zod (`zodResolver`), using the `field` and `label` components. Pass the core schema and core's error map to the resolver (`zodResolver(schema, { error: zodErrorKeyMap })`, extending the schema only for form-only fields), and translate field errors from the `errors` namespace.
- Every screen and component must be responsive.
- All visible text goes through react-i18next, with English (`en`) and Spanish (`es`) translations. Translations live only in `@tempi/i18n`: add a key to `en.ts` and `es.ts`, never hardcode strings or keep locale files in apps.
- Exception: `apps/www` (the landing page) doesn't use `@tempi/i18n` or react-i18next. It follows the Next.js internationalization guide: routes under `app/[lang]`, its own `en.json`/`es.json` dictionaries in `app/[lang]/dictionaries/`, loaded on the server with `getDictionary()`. Client Components receive their strings as props. Never hardcode strings there either.
- Register keyboard shortcuts only through `@usehotkeys/core` / `@usehotkeys/react`.

## Style

- Biome is the only formatter and linter (root `biome.json`): tabs, single quotes, semicolons.
- Don't add a dependency when the platform covers it (Electron, `node:*`, Web APIs).
- Write comments that explain why, not what.
