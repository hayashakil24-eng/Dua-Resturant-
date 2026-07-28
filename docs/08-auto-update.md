# Auto-update

Status: **built**. Not a numbered phase (like [`07-post-phase1-features.md`](07-post-phase1-features.md), this is ordinary feature work, not backend infrastructure) — added because `requirements.md` §14 asks for a "built-in auto-update feature" with a manual USB/patch fallback for when internet is unavailable.

## Goal

Ship a new build of the POS app (`frontend/`) or the Control Panel (`control-panel/`) from a developer machine, and have every already-installed copy notice, download, and offer to install it — without anyone visiting the restaurant or re-running the installer by hand.

## How it works

Both Electron apps use [`electron-updater`](https://www.electron.build/auto-update) (the runtime counterpart to `electron-builder`, already used to package both). Each app's `package.json` has a `build.publish` block pointing at the VPS:

```json
"publish": { "provider": "generic", "url": "https://<vps-host>/updates/<app>", "channel": "latest" }
```

- `frontend/package.json` → `.../updates/frontend`
- `control-panel/package.json` → `.../updates/control-panel`

`backend/src/vps/app.ts` registers `@fastify/static` serving `env.updatesDir` (default `backend/updates/`, override via `UPDATES_DIR`) under `/updates/` — so `.../updates/frontend/latest.yml` etc. resolve straight to plain files on disk. Nothing else on the VPS needs to change per release; this is a static file drop, not a route.

On launch (packaged builds only — `app.isPackaged` gates this, since dev has no `app-update.yml` to read a feed URL from) and every 4 hours after, each app calls `autoUpdater.checkForUpdates()`. If a newer version is published:

1. It downloads in the background (`autoDownload = true`).
2. Once downloaded, the app tells its renderer (`update-downloaded` IPC event) — the POS app shows a dismissible bottom banner (`frontend/src/components/UpdateBanner.jsx`) with a "Restart & Update" button; the Control Panel shows an equivalent row in its dashboard (`control-panel/src/index.html`/`app.js`).
3. Clicking that button calls `autoUpdater.quitAndInstall(true, true)` — silent install, relaunch after. If the app is just quit normally instead, `autoInstallOnAppQuit = true` applies the update anyway at next launch.

A failed or offline check (`error` event) is deliberately silent — logged to the console only, never surfaced to the renderer. This restaurant's internet is unreliable by design (see `00-overview.md`), so "couldn't check for updates" is the normal state, not a fault worth interrupting a cashier over.

## The install-location wrinkle

Both apps are normally installed via `installer/installer.nsi` — a hand-written combined NSIS wizard that copies both apps' `win-unpacked` output into a fixed `Program Files\Cafe Ali\{App,ControlPanel}` layout, not electron-builder's own default per-app NSIS installer path. `electron-updater`'s Windows updater (`NsisUpdater`) downloads and silently re-runs each app's *own* electron-builder-generated installer to apply an update — which would, left to its own defaults, reinstall into its own default location instead of the one the combined installer actually used.

Both `main.js` files set `autoUpdater.installDirectory = path.dirname(process.execPath)` before checking — this pins the update to wherever the app is *actually* running from (passed to the downloaded installer as `/D=<dir>`), regardless of which installer originally put it there. Verified against `electron-updater`'s own source (`NsisUpdater.js`'s `doInstall`), not just assumed.

Since the combined installer requests admin/`Program Files`, applying an update there also needs elevation — `electron-updater` handles this itself (spawns `elevate.exe`, prompting UAC) when the install directory isn't user-writable; expect a UAC prompt on update, same as on initial install.

## Release workflow

See `deployment-setup.md`'s "Publishing an app update" section for the exact steps (bump version → build → upload to the VPS). In short: `npm version` + `npm run dist` in whichever app changed, then copy `release/latest.yml`, the new installer `.exe`, and its `.blockmap` into `/opt/cafeali/updates/<app>/` on the VPS, replacing what's there. Nothing on already-installed clients needs touching — they pick it up on their next check.

## What's NOT covered

- **macOS/Linux code signing** — irrelevant here (`requirements.md` targets Windows only), but worth noting `electron-updater` verifies Windows binary signatures when a `publisherName` is present in `app-update.yml`; these apps aren't code-signed (see `installer/installer.nsi`'s Smart App Control workaround), so that check is effectively a no-op — anyone able to intercept/spoof the VPS's `/updates/` responses over HTTPS (i.e., not without breaking TLS) could serve a malicious update. Getting a real code-signing certificate would close this; out of scope for now, same trade-off already accepted for the initial install.
- **Manual USB fallback** — `requirements.md`'s other half of this ask (apply an update via USB when there's no internet) is unchanged from before this feature: hand over a freshly-built installer on a USB stick and re-run it, same as first install. No separate tooling was built for this since the existing installer is already idempotent (re-running it over an existing install just overwrites the files in place).
- **Rollback** — there's no "downgrade to previous version" button; a bad release needs a new, higher-versioned release to fix, same as most `electron-updater` deployments.
