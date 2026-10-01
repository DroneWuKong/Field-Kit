# Field Kit 0.4.0 connected configuration

This is part of the full Android package, `com.dronewukong.fieldtools`. It opens
on Home with all 21 tools and updates the existing 0.3.2 app when signed with
the same development certificate. Open **Tools**, choose **Configuration
workbench**, select **Connected device**, choose USB serial or MAVLink UDP, and
tap **Connect and read**. Practice remains available as an explicitly labeled
software rehearsal of the workflow.

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
- Betaflight raw dumps can be exported after CLI read. The comparison
  and apply parser supports a reviewed command subset; extra lines from the
  controller are retained in the raw backup but not offered as editable
  settings. Unsupported commands in an imported template stop the comparison.
  `save` reboots the controller;
  the app tries to reconnect to the same USB serial and re-read it.
- MAVLink parameter values are encoded using the reported capability. If that
  capability is missing, the operator can select the encoding explicitly.
  A controller UID or UID2 identifies the aircraft when available; otherwise
  the operator enters an asset serial. The report records that distinction.
- MAVLink `PARAM_SET` is followed by a full fresh read, but this build does
  not prove persistence through power cycling. Such a run is labeled
  `verified-active`, not a durable saved configuration.
- Signed MAVLink sessions need key handling, which this build does not yet
  provide. Multiple physical controllers are processed by reconnecting and
  reviewing one at a time; there is no unattended USB batch queue.
- The full app includes the previous calculators and planners, saved equipment
  and checks, phone location, passive USB/UDP Connection Doctor receive, and
  TCP reachability probing. Configuration and diagnostics intentionally share
  one physical link so two parts of the app cannot write to the same port.

These are engineering limits, not a license or user-role lock. The Practice
adapter is explicit and never substitutes for a failed hardware connection.
The hardware transport is isolated in `app/src/main/java/.../ConfigLink.java`;
the software peer path covers the same framing and deployment operations.
