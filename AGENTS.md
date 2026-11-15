# AGENTS.md

Rules for anyone (human or agent) changing this repo. They are rules, not suggestions.

## Project

- Local-first desktop calendar: no backend, no accounts. Sync may come later.
- Bun monorepo: `apps/desktop` (Electron), `apps/web` (Next.js, static export, embedded by desktop), `apps/www` (landing), `packages/*` (shared).
- Use Bun only: `bun install`, `bun run`, `bunx`. Add shared versions to the root `catalog`.
- Verify every change with `bun run check`, `bun run typecheck` and `bun run test`.
- Git hooks (Husky) enforce this: `pre-commit` runs Biome on staged files and the typecheck, and `pre-push` runs the tests. Never bypass them with `--no-verify`.

## Workflow: issue → branch → PR

**Never merge.** Agents never run `gh pr merge`, never `git merge` into `main`, never push to `main` and never force-push. Only the user merges.

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

- Domain logic and ports (interfaces such as `EventRepository`) live in `packages/core`. Core imports no Electron, Next, React or Node APIs.
- Adapters implement ports: SQLite in desktop today, a sync or HTTP adapter later. To swap storage, write a new adapter; never change the domain.
- Prepare for sync now: UUIDv7 text IDs, `created_at`/`updated_at` timestamps, `deleted_at` soft deletes, and no autoincrement IDs.
- Dependency direction: `apps/*` → `packages/ipc` / `packages/db` → `packages/core`. Core depends on nothing. Packages never import from apps.

## Structure

```
packages/
  core/                      @tempi/core: domain + ports, no runtime deps
    src/
      domain/                entities and value objects (event.ts, recurrence.ts)
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
      schemas.ts             runtime payload validation
      desktop-api.ts         DesktopApi type exposed by preload, Window augmentation
      ipc-event-repository.ts  renderer adapter: implements core ports via window.desktop
      index.ts

apps/desktop/src/
  main.ts                    bootstrap only: app lifecycle, wiring
  app-protocol.ts            app:// handler for the web export
  window-state.ts
  database.ts                opens @tempi/db in userData
  ipc/                       one file per domain (events.ts), register-ipc.ts
  preload.cts                exposes DesktopApi; no logic

apps/web/src/
  app/                       routes only (layout.tsx, page.tsx); thin, compose features
  features/<feature>/        components/, hooks/, <feature>.test.ts (calendar, events, settings)
  components/                shared app components
  components/ui/             generated (shadcn); do not edit by hand
  providers/                 repository provider (injects the port implementation)
  lib/                       small framework-free helpers
```

- Add a new package only for a distinct responsibility, such as a sync engine. Name it `@tempi/<name>`, and give it a `package.json` with `"exports": { ".": "./src/index.ts" }` and `"test": "bun test"`, plus a `tsconfig.json` that extends `../../tsconfig.base.json`.
- Packages ship TypeScript source with no build step. Consumers compile them: Next uses `transpilePackages`, and desktop bundles its main process.
- Use kebab-case file names. Use named exports only, with no default exports except where Next requires them.

## Testing

- Use `bun test` only (`import { describe, expect, test } from 'bun:test'`). Don't add Jest, Vitest or other test runners.
- Colocate tests as `*.test.ts` next to the code they test.
- Every package must have tests:
  - `core`: test use cases with in-memory fakes of the ports.
  - `db`: test against `new DatabaseSync(':memory:')` with real migrations. `node:sqlite` runs under Bun, so the tests exercise the same API Electron uses.
  - `ipc`: test schemas with valid and invalid payloads.
- Test behavior, not implementation. No snapshot tests for logic.
- Every bug fix comes with a test that fails without the fix.

## Electron security

- Keep `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` and `webSecurity: true`. Never relax them.
- Load only `app://tempi` (packaged) or the dev server. Send every other URL to `shell.openExternal` through `setWindowOpenHandler` and `will-navigate`.
- Deny permission requests by default (`session.setPermissionRequestHandler`).
- Set a strict Content-Security-Policy. Never load remote scripts, and never use `eval` or `new Function`.
- Never weaken the `app://` protocol handler's path-traversal guard.
- Enable Electron Fuses in release builds: disable `RunAsNode` and `EnableNodeOptionsEnvironmentVariable`, and enable `OnlyLoadAppFromAsar`.
- Keep Electron on a supported major version.

## IPC

- Use only `ipcRenderer.invoke` and `ipcMain.handle`. Don't use `send`/`sendSync` for request/response.
- Name channels `domain:action`, for example `events:list` and `events:upsert`. Use one handler per channel.
- The preload exposes small, typed functions with `contextBridge`, for example `window.desktop.events.list(range)`. Never expose `ipcRenderer`, Node modules or generic `invoke(channel, …)` passthroughs.
- In every handler, check `event.senderFrame.url` against the trusted origin, then validate the payload at runtime. TypeScript types do not exist at runtime.
- Pass only plain serializable data. Return results; don't throw raw errors across IPC.
- Define the bridge type once (`DesktopApi`), share it with web, and declare it on `Window`.
- `apps/web` must not assume Electron: feature-detect `window.desktop` and go through the repository port.

## SQLite (`node:sqlite`)

- The database lives in the main process only, at `app.getPath('userData')/tempi.db`. The renderer reaches it only through IPC.
- Set on open: `journal_mode = WAL`, `foreign_keys = ON`, `synchronous = NORMAL` and `busy_timeout = 5000`.
- Use prepared statements with bound parameters only. Never build SQL from strings.
- Wrap multi-statement writes in a transaction (`BEGIN IMMEDIATE` … `COMMIT`/`ROLLBACK`).
- Migrations: write ordered SQL files tracked by `PRAGMA user_version`, run each in a transaction, and only move forward. Back up with `VACUUM INTO` before migrating.
- `DatabaseSync` blocks the main process. Keep queries indexed and small. Move bulk work (import, export, search) to a `utilityProcess`.
- Store instants as UTC ISO-8601 text. Store the event's IANA time zone separately, and recurrence as RFC 5545 `RRULE` text.
- Close the database on `before-quit`.

## TypeScript 7

- `tsc` is the native compiler. Don't depend on the TypeScript JS API (custom transformers, ts-node, language-service plugins).
- All shared options belong in `tsconfig.base.json`. App configs only extend it and add what is specific to them.
- Don't use the removed or legacy options: `baseUrl`, `moduleResolution: node`/`node10`, `outFile`, `target: ES5`, `downlevelIteration`, `esModuleInterop: false`. Use `paths` without `baseUrl`.
- Write erasable syntax only: no `enum`, `namespace` or parameter properties. Use `as const` objects and union types instead.
- Use `import type` for type-only imports (`verbatimModuleSyntax`).
- No `any`. Use `unknown` and narrow it. Use `satisfies` for typed literals. Use `!` only with a comment explaining why.
- Validate external data (IPC, files, storage) at the boundary, then trust the types inside.

## React (19, Next static export)

- With static export there is no runtime server: no server actions, no dynamic route handlers, no middleware, no `headers()`/`cookies()`. Dynamic routes need `generateStaticParams`.
- Data comes from the client through hooks that wrap the repository port. Components never call `window.desktop` directly.
- Derive values during render instead of syncing them into state. Use `useEffect` only to synchronize with external systems.
- Use `useSyncExternalStore` for external stores. Avoid prop drilling beyond two levels: lift state or use context.
- Use stable keys from IDs, never array indexes.
- Don't add `useMemo`, `useCallback` or `memo` without a measured problem.
- Keep components small and colocated. Lift state only as far as needed.
- Accessibility is required: semantic elements, labelled controls and full keyboard navigation (the calendar grid included).
- `src/components/ui` is generated code. Don't edit it by hand.

## Style

- Biome is the only formatter and linter (root `biome.json`): tabs, single quotes, semicolons.
- Don't add a dependency when the platform covers it (Electron, `node:*`, Web APIs).
- Write comments that explain why, not what.
