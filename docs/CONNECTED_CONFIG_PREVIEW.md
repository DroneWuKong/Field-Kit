# Connected configuration preview

This is a separate Android package, `com.dronewukong.fieldtools.config`, so it
can be tested alongside the existing Field Kit installation. Its first screen
is Configuration workbench. Select **Connected device**, choose USB serial or
MAVLink UDP, and tap **Connect and read**. Practice remains available for a
software-only rehearsal of the same workflow.

The connected path sends actual bytes to a selected transport. Betaflight uses
the CLI for a raw `dump all`, reviewed setting commands, `save`, reconnect and
readback. ArduPilot and PX4 use MAVLink `PARAM_REQUEST_LIST`, missing-index
requests, typed `PARAM_SET`, and a complete fresh parameter read. Saved runs
include before-change backups and attempted steps in private Android storage.
The web report uses the evidence label `hardware` only for the connected path.

## What to try first

1. Connect one flight controller with a USB data cable, or send MAVLink to the
   phone's UDP listening port. Only one writer should have the USB port open.
2. Pull its current dump or parameter list and save the exported file. Confirm
   board, firmware and asset identity match what you intended to connect.
3. Load or edit a small template containing one reversible setting. Compare the
   before and after values, then apply it. Read the same setting again after
   the run and export the report.
4. If a request times out or the connection changes during a write, keep the
   before backup, reconnect and read before deciding what to do next.

## Current limits and evidence

- The native build and software protocol peers pass CI. A physical Betaflight,
  ArduPilot or PX4 board has not yet been used for validation here. Real
  behavior depends on the board's serial implementation, firmware and link.
- Betaflight raw dumps can always be exported after CLI read. The comparison
  and apply parser supports a reviewed command subset; an unsupported command
  stops the comparison instead of sending it. `save` reboots the controller;
  the app tries to reconnect to the same USB serial and re-read it.
- MAVLink parameter values are encoded using the reported capability. If that
  capability is missing, the operator can select the encoding explicitly.
  A controller UID or UID2 identifies the aircraft when available; otherwise
  the operator enters an asset serial. The report records that distinction.
- MAVLink `PARAM_SET` is followed by a full fresh read, but this preview does
  not prove persistence through power cycling. Such a run is labeled
  `verified-active`, not a durable saved configuration.
- Signed MAVLink sessions need key handling, which this preview does not yet
  provide. Multiple physical controllers are processed by reconnecting and
  reviewing one at a time; there is no unattended USB batch queue.
- The separate preview shell does not carry over every native diagnostic API
  from the installed 0.3.2 app. Continue using that app for live Connection
  Doctor tests until the native modules are consolidated.

These are engineering limits, not a license or user-role lock. The Practice
adapter is explicit and never substitutes for a failed hardware connection.
The hardware transport is isolated in `app/src/main/java/.../ConfigLink.java`;
the software peer path covers the same framing and deployment operations.
