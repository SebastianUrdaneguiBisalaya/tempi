# Tempi

A local-first desktop calendar for macOS, Windows and Linux. No accounts, no backend: your data stays on your device.

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
