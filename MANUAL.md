# Tempi manual

How to install, update, develop and release Tempi. For what Tempi is and how it is built, see the [README](README.md).

## Install

Download the installer for your platform from [GitHub Releases](https://github.com/SebastianUrdaneguiBisalaya/tempi/releases):

| Platform              | File                                                                         |
| --------------------- | ---------------------------------------------------------------------------- |
| macOS (Apple Silicon) | `Tempi-<version>-mac-arm64.dmg`                                              |
| macOS (Intel)         | `Tempi-<version>-mac-x64.dmg`                                                |
| Windows               | `Tempi-<version>-win-x64.exe`                                                |
| Linux                 | `Tempi-<version>-linux-x86_64.AppImage` or `Tempi-<version>-linux-amd64.deb` |

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
- **Linux (`.deb`):** the notice links to the download; install it with `sudo apt install ./Tempi-<version>-linux-amd64.deb`.

Your calendars, events and settings live in the app's data folder, not inside the app, so updating keeps them. Make a backup first from **Settings → Data** if you want to be safe.

## Development

```sh
bun install
make help        # list the available tasks
make dev-web     # web app on :3000
make dev-desktop # Electron against the web dev server
```

See [AGENTS.md](AGENTS.md) for the project rules and [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

## Releasing

1. Bump `version` in `apps/desktop/package.json` and merge it to `main`.
2. Tag that commit with the same version and push the tag:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. The **Release** workflow builds every platform, checks the Electron Fuses and creates a draft release with the installers. Review it on GitHub and publish it.

Google Calendar sync needs the `TEMPI_GOOGLE_CLIENT_ID` and `TEMPI_GOOGLE_CLIENT_SECRET` repository secrets; without them the release builds ship with sync disabled.
