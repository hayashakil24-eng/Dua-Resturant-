# Cafe Ali — Receipt Printer "Invalid printer settings" — Handoff

## Repo
`Dua-Resturant-` monorepo, Electron desktop app in `frontend/`. Printer logic lives in
`frontend/electron/main.js` (IPC handler `print-silent`) and `frontend/src/utils/print.js`
(renderer-side caller, `safePrint`). Printer picked in Settings → Receipt Printer is stored
in `localStorage['receiptPrinter']` (see `frontend/src/pages/Settings.jsx`, `PrinterSettingsPanel`).

## Client's printer
Thermal receipt printer, Windows-visible as **"BC-98AC"** (also seen as "Black Copper BC-85AC"
duplicates in Windows' printer list — see below). 80mm roll.

## Reported symptom
Cashier prints a bill → toast: **"Print failed — Invalid printer settings"**. Happens
regardless of which printer is selected in Settings → Receipt Printer.

## What we ruled out (don't re-chase these)
1. **Stale/duplicate Windows printer objects.** Windows had accumulated many duplicate
   entries (`BC-98AC (copy 1)` … `(copy 9)`, `Black Copper BC-85AC(copy of 1/2)`) — classic
   symptom of the USB printer reconnecting and Windows spawning a new printer object each
   time instead of reusing one. We had the client clean these up / reselect in Settings.
   **This did not fix it** — every option, including a clean re-detected entry, still failed.
2. **Print spooler / driver corruption at the OS level.** Ruled out because:
   - Windows' own "Print a test page" works for this printer (not confirmed but was the
     planned next check — see below if not yet done).
   - **A different company's POS software prints successfully to the same "BC-98AC"
     Windows printer entry on the same machine.** This is the key fact — it proves the
     printer, driver, and Windows print pipeline are all fine. The failure is specific to
     how Cafe Ali's Electron app sends the print job.
3. **Not a printer-selection/localStorage bug** — confirmed failing even on freshly
   reselected, valid printer names.

## Root cause (confirmed via client statement, not yet via log)
The client said: **"pehle print ho raha tha, jab se print window remove ki hai us ke baad se
print nahi ho raha"** — i.e. printing worked when the app used a visible print dialog, and
broke specifically when silent printing was introduced.

Git history confirms: commit `395e711` ("feat(printing): silent Electron printing + premium
thermal receipt redesign") replaced the old `window.print()` dialog flow with Electron's
silent `webContents.print({ silent: true, ... })`. A later commit `2582166` added a first
compatibility fallback for a related but distinct problem (virtual printers like "Microsoft
Print to PDF" failing `usePrinterDefaultPageSize` + `printableArea` margins).

**Working theory:** the BC-98AC's Windows driver cannot correctly answer Chromium's
page-size/printable-area capability queries that `usePrinterDefaultPageSize` and
`margins: { marginType: 'printableArea' }` (and even `marginType: 'default'`) trigger, so
Chromium's own print backend rejects the job with the generic error string
`"Invalid printer settings"` — before the job ever reaches the driver/spooler. This is
consistent with the old dialog-based flow working: when a user prints via the native
Windows print dialog, Chromium never issues these capability queries — the job goes out
with the driver's own already-configured defaults.

This is a known category of issue with cheap/generic thermal printer drivers (some ship
as "Generic / Text Only" drivers) — Electron's `webContents.print()` "smart" options
assume proper DEVMODE reporting that these drivers don't always provide.

## Fix already applied (committed as `e21c900`)
File: `frontend/electron/main.js`, IPC handler `print-silent`.

Added a **third fallback attempt** after the existing two, with no `margins`/`pageSize`
field at all — i.e. the closest silent equivalent to "just click Print with no custom
settings" (what the old dialog flow effectively did). Sequence is now:

1. `usePrinterDefaultPageSize: true` + `margins: { marginType: 'printableArea' }` (original,
   best result on printers with proper DEVMODE support)
2. `margins: { marginType: 'default' }` (existing compatibility fallback, e.g. Microsoft
   Print to PDF)
3. **NEW:** bare-minimum — `{ silent: true, printBackground: true, deviceName? }`, nothing
   else

Also added **error logging** at each failed attempt via `electron-log` (`log.error(...)`),
so the exact Chromium `failureReason` for all three attempts now lands in the app's log
file instead of only a generic toast. Log file path (unpackaged/dev):
`%AppData%\Roaming\cafe-ali\logs\app.log`
(packaged app: check `installDirectory`/userData path logged at `APP STARTED` — same
`electron-log` config, should be the same `%AppData%\Roaming\cafe-ali\logs\app.log`).

**Status: committed to `main` as `e21c900`, but this fix has NOT been validated against a
real printer yet.** It was tested on a dev machine with no physical printer attached — only Windows virtual printers (Microsoft
Print to PDF, XPS Document Writer, Fax), which all use a `PORTPROMPT:`/`SHRFAX:` port and
therefore **always** fail with the same `"Invalid printer settings"` error regardless of
any option combination (Chromium can't get valid capabilities from a port that requires an
interactive Save-As prompt). That failure mode is expected and unrelated to this bug — do
not treat it as evidence against the fix. A real conclusion requires the actual BC-98AC (or
any real USB/hardware-port printer).

## What still needs to happen (on the client's / a machine with the real printer)
1. Make sure the machine testing this is running code that includes commit `e21c900`
   (already on `main` — `git log --oneline -1 -- frontend/electron/main.js` should show it;
   no manual patching needed).
2. Rebuild/run the app (`cd frontend && npm run dev`, or build+install a fresh `npm run
   dist` installer) on a machine where the real BC-98AC is attached.
3. Print a real bill.
4. **If it still fails:** open `%AppData%\Roaming\cafe-ali\logs\app.log` and find the three
   new `print-silent: attempt N ... failed` lines — they now carry the real
   `failureReason` string per attempt instead of the generic toast. Send those three log
   lines back — that's the next real diagnostic signal (would tell us, e.g., if it's still
   literally `"Invalid printer settings"` on all three, meaning even the bare-minimum
   attempt is rejected by this driver, vs. a different/more specific error).
5. **If it still fails on all three attempts even bare-minimum:** the likely next real fix
   is switching away from Chromium's `webContents.print()` entirely for this printer class,
   toward raw ESC/POS printing (sending raw text/commands directly to the Windows print
   queue as a RAW datatype job, bypassing HTML/CSS page rendering altogether) — this is a
   bigger, deliberate architecture change, not a quick patch, and should be scoped
   separately once we have the attempt-3 log data confirming it's needed.
6. Also worth checking once, if convenient: the printer's driver name in Windows (**Control
   Panel → Devices and Printers → BC-98AC → Printer properties → General/Advanced tab**) —
   if it says "Generic / Text Only", that independently supports the raw-ESC/POS-printing
   theory in step 5, and the manufacturer's site may have a proper GDI driver as a
   lower-effort alternative to try first.

## Not part of this issue (separate, unresolved, do not mix up)
A separate 2-PC networking problem came up during testing (`control-panel` on PC1 as the
LAN server, `frontend` installed on PC2, PC2 shows "Cannot reach the server") — that's a
LAN discovery/firewall issue, unrelated to printing. Don't conflate the two if debugging
on-site; check control-panel shows "server running", both PCs on the same network, and
Windows Firewall allows the app through, separately from the printer investigation above.
