# Attendance Machine (Fingerprint / Face) — Status

Your attendance device (ZKTeco uFace 950 — the one with fingerprint + face
scan) is now connected to the app. Here's what that means in plain terms.

## What it does

- Staff punch in/out on the machine as usual (fingerprint or face).
- The app automatically picks up those punches and marks attendance —
  no one has to type anything in by hand anymore.
- If the machine is ever down or broken, a Manager/Admin can still enter
  attendance manually for that day, like before. The app will never
  overwrite that manual entry once it's saved.

## What's already built and working

- **Connecting the machine — no technical setup needed.** Open the app →
  **Settings → Attendance Machine**. Click **"Scan for device"** and the
  app finds it on your WiFi/network by itself and fills in the details.
  No `.env` files, no code, no restarting anything.
- **Linking staff to the machine.** Each staff member gets an ID number on
  the machine when they're enrolled there (fingerprint/face signup still
  happens on the machine itself, same as before). That same ID is entered
  once on their profile in the app (**Employees** page) so the app knows
  whose punch is whose.
- **Automatic syncing.** The app checks the machine every ~30 seconds for
  new punches, in the background, with no action needed.
- **Manual "Sync Now" button.** If you want a punch to show up immediately
  instead of waiting, there's a button for that in Settings too.
- **Works across all devices/screens live.** When a punch comes in, every
  screen showing attendance updates automatically within a second or two.
- We tested the logic thoroughly on our end — 160 automated checks pass,
  covering things like: first punch of the day = check-in, next punch =
  check-out, manual entries never get overwritten, and the app doesn't
  break if the machine is unreachable.

## What's NOT been tested yet — and why

We built and tested all of this **without the physical machine in hand**
(it wasn't available to us during development). Everything above works
correctly in every test we can run without the real device.

What we genuinely can't confirm until we test with the actual machine:

- That the app understands the exact format the machine sends punches in.
  We built it against the machine's publicly documented behavior, but
  real hardware sometimes has small quirks that only show up in person.
- That "Scan for device" actually finds your specific machine on your
  specific network/router setup.

**Before this goes live for real use**, we strongly recommend one short
test with the physical machine present: plug it in, click "Scan for
device," link one staff member, have them punch in and out, and confirm
it shows up correctly in the app. This should take a few minutes. We're
happy to do this test together once the machine is available.

## What was intentionally not built

- The app does **not** manage fingerprint/face enrollment — that always
  happens on the machine itself, the same way it does today. The app only
  reads the attendance punches back.
- There's no "search the internet and auto-find the machine's brand"
  magic — it only looks on your own local network, for security reasons
  (exactly what you'd want).
