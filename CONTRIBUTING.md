# Contributing to Tempi

Tempi is a local-first desktop calendar. Your data lives on your machine, with no account and no cloud.

## Prerequisites

- [Bun](https://bun.sh) 1.4.2 (see `packageManager` in `package.json`). Do not use npm, pnpm or yarn.
- macOS, Windows or Linux.
- `make` (optional): every target wraps a `bun run` script.

## Setup

```sh
git clone <repo-url> tempi
cd tempi
bun install
```

## Repository layout

```
apps/
  desktop/   Electron shell: main process, preload, SQLite, app:// protocol
  web/       Next.js app (static export) embedded by desktop
  www/       Landing page
packages/    Shared code (domain, ports, adapters)
```

Dependency versions shared across apps live in the `catalog` of the root `package.json`; apps reference them as `"catalog:"`. Lint and format rules live only in the root `biome.json`, and compiler options in `tsconfig.base.json`.

## Development

| Task                         | Bun                     | Make                                        |
| ---------------------------- | ----------------------- | ------------------------------------------- |
| Web app (`:3000`)            | `bun run dev:web`       | `make dev-web`                              |
| Desktop (needs `dev:web`)    | `bun run dev:desktop`   | `make dev-desktop`                          |
| Landing page (`:3001`)       | `bun run dev:www`       | `make dev-www`                              |
| Type-check                   | `bun run typecheck`     | `make typecheck`                            |
| Lint (no writes)             | `bun run lint`          | `make lint`                                 |
| Fix lint, format and imports | `bun run check`         | `make check`                                |
| Build desktop                | `bun run build:desktop` | `make build-desktop`                        |
| Package desktop              | —                       | `make dist-mac` / `dist-win` / `dist-linux` |

Start `dev:web` first, then `dev:desktop` in another terminal. Electron retries until the dev server answers.

## Before opening a pull request

1. `bun run check`
2. `bun run typecheck`
3. Run the desktop app and exercise what you changed.

A PR that fails them will not be reviewed.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org): `feat(desktop): …`, `fix(web): …`, `chore: …`. Use the app or package name as the scope.
- Keep each PR to one change. Separate refactors from behavior changes.
- Describe what changed, why, and how you tested it. Add screenshots for UI changes.
- Don't add a dependency without explaining why the platform (Electron, Node, Bun, the browser) isn't enough.

## Guidelines

Read [AGENTS.md](./AGENTS.md). It holds the engineering rules for Electron, IPC, SQLite, TypeScript and React, and applies to humans and AI agents alike.

## Reporting bugs and security issues

- Bugs: open an issue with steps to reproduce, the expected and actual behavior, your OS and the app version.
- Security: see [SECURITY.md](./SECURITY.md). Do not open a public issue.

## Code of conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the [ISC License](./LICENSE).
