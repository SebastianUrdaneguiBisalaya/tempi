# Tempi

**A local-first desktop calendar for macOS, Windows and Linux.** No account, no cloud, no tracking: your calendars live in a database on your own computer, and Tempi works the same with or without a connection.

## Why Tempi

Most calendars are a web service you rent: your schedule sits on someone else's server, behind an account, and the app stops being useful when the network goes away. Tempi starts from the opposite end:

- **Your data, on your device.** Everything is stored in a local SQLite database. There is nothing to sign up for.
- **Fast because it's local.** Views, search and edits don't wait for a server.
- **Sync is optional.** Connect Google Calendar if you want two-way sync; everything else keeps working without it.
- **Built to last.** Records carry sync-ready IDs and timestamps, so other sync providers can be added later without changing how your data is stored.

## Features

- Day, week and month views, with a mini calendar and "go to date".
- Events with time zones, all-day events, recurrence (RFC 5545 rules), reminders as system notifications, location, video call links and status.
- Multiple calendars with colors, visibility toggles and a default calendar.
- Two-way Google Calendar sync, including read-only calendars such as holidays.
- iCalendar (`.ics`) import and export, plus full backups and restores.
- A menu bar (macOS) or tray (Windows, Linux) agenda for today.
- Event search, a command menu and keyboard shortcuts for everything.
- Light and dark themes, English and Spanish.

## Install

Download the installer for your platform from the [latest GitHub release](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest):

| Platform              | File                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS (Apple Silicon) | [`Tempi-mac-arm64.dmg`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-mac-arm64.dmg)                                                                                                                                                  |
| macOS (Intel)         | [`Tempi-mac-x64.dmg`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-mac-x64.dmg)                                                                                                                                                      |
| Windows               | [`Tempi-win-x64.exe`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-win-x64.exe)                                                                                                                                                      |
| Linux                 | [`Tempi-linux-x86_64.AppImage`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-linux-x86_64.AppImage) or [`Tempi-linux-amd64.deb`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-linux-amd64.deb) |

### macOS warning: "Tempi can't be opened"

Tempi isn't signed with an Apple Developer certificate yet, so the first time you open it macOS says it can't verify the developer. After dragging Tempi to Applications, either:

- Open **System Settings → Privacy & Security**, scroll to the message about Tempi and click **Open Anyway**, or
- Remove the quarantine flag in Terminal:

  ```sh
  xattr -dr com.apple.quarantine /Applications/Tempi.app
  ```

You need to do this again after each update.

### Windows warning: "Windows protected your PC"

SmartScreen may flag Tempi as an unrecognized app. Click **More info → Run anyway**.

### Updates

On Windows and Linux (AppImage), Tempi downloads updates in the background and installs them when you restart it. On macOS, where unsigned apps can't update themselves, Tempi tells you when a new version is out and links to its download; install it over the old one and your data is kept. The [manual](MANUAL.md#update) has the details.

## How it's built

Tempi is a Bun monorepo. The desktop app is an Electron shell around a statically exported Next.js app; the domain logic is plain TypeScript with no framework in it.

```
apps/
  desktop/   Electron main process: windows, tray, notifications, SQLite, IPC
  web/       The calendar UI (Next.js static export, embedded by desktop)
  www/       Landing page
packages/
  core/        Domain: entities, zod schemas, use cases and ports
  db/          SQLite adapter (node:sqlite) and migrations
  ipc/         Typed contract between the UI and the main process
  i18n/        English and Spanish translations
  ical/        iCalendar import and export
  sync-google/ Google Calendar sync
```

| Layer          | Stack                                                                      |
| -------------- | -------------------------------------------------------------------------- |
| Desktop        | Electron 45 (sandboxed renderer, context isolation, Electron Fuses)        |
| UI             | Next.js 16 (static export), React 19, Tailwind CSS 4, shadcn/ui on Base UI |
| Data in the UI | TanStack Query, React Hook Form                                            |
| Domain         | TypeScript 7, zod, Temporal, `rrule-temporal`                              |
| Storage        | SQLite through `node:sqlite`                                               |
| Tooling        | Bun (package manager, test runner, bundler), Biome                         |

A few rules shape the code:

- **Hexagonal core.** `packages/core` holds the domain and its ports (such as `EventRepository`) and imports no Electron, React or Node APIs. Storage and sync are adapters, so swapping them never touches the domain.
- **One source of validation.** The zod schemas in core validate use cases, IPC payloads and forms alike.
- **Errors are data.** Failures cross every boundary as `{ code, issues[] }` with translation keys; only the UI turns them into text.
- **Secure by default.** The UI reaches the database only through narrow, validated IPC use cases, and the packaged app loads only its own bundled files.

## Documentation

- [MANUAL.md](MANUAL.md): install, update, development setup and releasing.
- [CONTRIBUTING.md](CONTRIBUTING.md): how to contribute.
- [AGENTS.md](AGENTS.md): the rules every change follows.
- [SECURITY.md](SECURITY.md): reporting vulnerabilities.

## License

[ISC](LICENSE)
