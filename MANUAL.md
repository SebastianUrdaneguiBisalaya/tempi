# Tempi manual

How to install, update, develop and release Tempi. For what Tempi is and how it is built, see the [README](README.md).

## Install

Download the installer for your platform from the [latest GitHub release](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest):

| Platform              | File                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS (Apple Silicon) | [`Tempi-mac-arm64.dmg`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-mac-arm64.dmg)                                                                                                                                                  |
| macOS (Intel)         | [`Tempi-mac-x64.dmg`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-mac-x64.dmg)                                                                                                                                                      |
| Windows               | [`Tempi-win-x64.exe`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-win-x64.exe)                                                                                                                                                      |
| Linux                 | [`Tempi-linux-x86_64.AppImage`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-linux-x86_64.AppImage) or [`Tempi-linux-amd64.deb`](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/Tempi-linux-amd64.deb) |

### Opening an unsigned build on macOS

Tempi isn't signed with an Apple Developer certificate yet, so macOS blocks it the first time. After moving Tempi to Applications, do one of the following:

- Open **System Settings → Privacy & Security**, scroll to the message about Tempi and click **Open Anyway**.
- Or remove the quarantine flag in Terminal:

  ```sh
  xattr -dr com.apple.quarantine /Applications/Tempi.app
  ```

### Windows

Windows SmartScreen may warn about an unrecognized app. Click **More info → Run anyway**.

## Update

Tempi checks GitHub Releases for a newer version shortly after it starts, then every few hours. You can also check by hand in **Settings → About → Check for updates**.

- **Windows and Linux (AppImage):** the update downloads in the background. A notice says when it's ready; click **Restart to update**, or it installs the next time you quit Tempi.
- **macOS:** automatic installs need an app signed with an Apple Developer ID, which Tempi doesn't have yet. Instead, a notice says a new version is available and links to its download. Then:
  1. Quit Tempi (also from the menu bar).
  2. Open the new `.dmg` and drag Tempi to Applications, choosing **Replace**.
  3. Allow it again as described in [Opening an unsigned build on macOS](#opening-an-unsigned-build-on-macos).
- **Linux (`.deb`):** the notice links to the download; install it with `sudo apt install ./Tempi-linux-amd64.deb`.

Your calendars, events and settings live in the app's data folder, not inside the app, so updating keeps them. Make a backup first from **Settings → Data** if you want to be safe.

## Development

```sh
bun install
make help        # list the available tasks
make dev-web     # web app on :3000
make dev-desktop # Electron against the web dev server
```

### Environment variables

Only the desktop app reads environment variables; `apps/web` and `apps/www` need none. Copy the example and fill in what you need:

```sh
cp apps/desktop/.env.example apps/desktop/.env
```

| Variable                     | Needed for                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `TEMPI_GOOGLE_CLIENT_ID`     | Google Calendar sync (see [Google Calendar setup](#google-calendar-setup))   |
| `TEMPI_GOOGLE_CLIENT_SECRET` | Google Calendar sync                                                         |
| `TEMPI_WEB_URL`              | Optional, dev only: the web dev server URL (default `http://localhost:3000`) |

The Google values are inlined into the main process when it's built, so restart `make dev-desktop` after changing them. Without them, the app works and Google sync stays off.

To start over from the onboarding, close the app and run `make reset-desktop`: it deletes the dev database and keeps your AI keys and Google account.

See [AGENTS.md](AGENTS.md) for the project rules and [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

## Releasing

Releases are built by GitHub Actions, not on your computer. Pushing a `v*` tag runs the **Release** workflow (`.github/workflows/release.yml`), which builds every platform and collects the installers in a draft GitHub Release. Nothing is public until you publish that draft.

### Before the first release

- **Secrets.** Add `TEMPI_GOOGLE_CLIENT_ID` and `TEMPI_GOOGLE_CLIENT_SECRET` under **GitHub → Settings → Secrets and variables → Actions** (see [Google Calendar setup](#google-calendar-setup)). Without them the builds ship with Google sync disabled.
- **Actions.** Make sure Actions is enabled under **Settings → Actions → General**. The workflow asks for the write permission it needs to create the release, so the default token settings are enough.

### Cut a release

1. **Bump the version.** Change `version` in `apps/desktop/package.json` (for example `0.1.0` → `0.2.0`) through the usual issue → branch → PR flow, and merge it to `main`.
2. **Tag the merged commit** with the same version, prefixed with `v`, and push the tag:

   ```sh
   git switch main
   git pull --ff-only origin main
   git tag v0.2.0
   git push origin v0.2.0
   ```

   The workflow fails on purpose if the tag doesn't match `apps/desktop/package.json`.

3. **Wait for the build.** Follow it under **GitHub → Actions → Release**. It builds macOS, Windows and Linux in parallel, then checks the Electron Fuses.
4. **Review the draft.** Under **GitHub → Releases**, open the new draft. It should have these files, plus `.blockmap` files:

   | File                          | Used by                      |
   | ----------------------------- | ---------------------------- |
   | `Tempi-mac-arm64.dmg`         | macOS (Apple Silicon)        |
   | `Tempi-mac-x64.dmg`           | macOS (Intel)                |
   | `Tempi-win-x64.exe`           | Windows                      |
   | `Tempi-linux-x86_64.AppImage` | Linux                        |
   | `Tempi-linux-amd64.deb`       | Linux (Debian, Ubuntu)       |
   | `latest.yml`                  | Windows auto-update          |
   | `latest-linux.yml`            | Linux (AppImage) auto-update |

   Edit the generated release notes if you want, and install a build or two to try them.

5. **Publish.** Click **Publish release**, keeping **Set as the latest release** checked. Don't mark it as a pre-release: drafts and pre-releases are never "latest".

### What picks up a new release

Once the release is published, these update without any further step:

- **The landing page.** Its download buttons (`apps/www/src/lib/downloads.ts`) and the [Install](#install) table link to `https://github.com/SebastianUrdaneguiBisalaya/tempi/releases/latest/download/<file>`. GitHub redirects that to the file in the newest published release. Installers carry no version in their names (`artifactName` in `apps/desktop/package.json`), so the links never change. The landing is deployed to Vercel by hand and needs no redeploy for a release.
- **Installed apps.** They find the new version as described in [Update](#update).

### If something goes wrong

- **The workflow failed.** Open the failed job under **Actions** and fix the cause on a branch. Then delete the tag, merge the fix, and tag again:

  ```sh
  git push origin :refs/tags/v0.2.0   # delete the remote tag
  git tag -d v0.2.0                   # delete the local tag
  ```

  Delete any draft the failed run left under **Releases** too.

- **A published release is broken.** Don't reuse its version. Bump to the next patch version (for example `0.2.1`) and release again; it becomes the latest and replaces the broken one everywhere.
- **A download link returns 404.** Check that the release is published (not a draft or pre-release), marked as latest, and that it has a file with exactly that name.

## Google Calendar setup

Tempi connects to Google Calendar with its own OAuth client, which you register once in Google Cloud. Each user then signs in with their own Google account; their tokens stay encrypted on their computer.

1. **Create a project.** In [Google Cloud Console](https://console.cloud.google.com/), create a project (for example `Tempi`) and select it.
2. **Enable the Google Calendar API.** Go to **APIs & Services → Library**, search for **Google Calendar API** and click **Enable**. Without it, sign-in works but sync fails.
3. **Configure the consent screen.** Go to **Google Auth Platform** (**APIs & Services → OAuth consent screen**):
   - **Branding:** app name `Tempi`, a support email and a developer contact email.
   - **Audience:** **External**. While the app is in **Testing**, add every Google account that will connect under **Test users** (up to 100).
   - **Data access:** add these scopes:

     | Scope                                                            | Why                                      |
     | ---------------------------------------------------------------- | ---------------------------------------- |
     | `openid`, `email`                                                | Show which account is connected          |
     | `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | List the account's calendars             |
     | `https://www.googleapis.com/auth/calendar.events`                | Read and write events in those calendars |

4. **Create the OAuth client.** Go to **Clients** (**APIs & Services → Credentials → Create credentials → OAuth client ID**), choose **Desktop app** and create it. Desktop clients need no redirect URI: Tempi receives the sign-in on a temporary `127.0.0.1` port.
5. **Use the client ID and secret:**
   - Local builds: put them in `apps/desktop/.env` (see [Environment variables](#environment-variables)).
   - Releases: add them as the `TEMPI_GOOGLE_CLIENT_ID` and `TEMPI_GOOGLE_CLIENT_SECRET` repository secrets (**GitHub → Settings → Secrets and variables → Actions**).

Things to know:

- **Testing vs. production.** The calendar scopes are sensitive. While the app is in **Testing**, only test users can connect, and Google expires their sign-in after 7 days, so Tempi asks them to reconnect. To let anyone connect, click **Publish app** under **Audience** and complete Google's verification for sensitive scopes.
- **The secret isn't secret.** Both values are built into the app and anyone can extract them. Google treats desktop clients' secrets as non-confidential; the sign-in is protected by PKCE and the user's consent, so the values give no access to anyone's calendar. They can still be misused against your quota or to impersonate Tempi's consent screen: watch usage in the Cloud Console, and if you see abuse, add a new secret to the client, update the repository secret, release, then delete the old one.
