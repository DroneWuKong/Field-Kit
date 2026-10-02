# Android release notes

## App identity

- Package: `com.dronewukong.fieldtools`
- Version: `0.4.1` (`versionCode 7`)
- Launcher: `com.dronewukong.fieldtools.FieldToolsActivity`
- Start page: `tools_offline.html?mode=standalone#home`

Keep the package ID and signing certificate unchanged for in-place upgrades from
0.3.2. The development keystore is intentionally not committed. The 0.4.1 APK
was signed outside the repository with the same certificate as 0.3.2; its SHA-256
certificate digest is
`2e127ebcae2cfa8e81e529327b98ea2758050120ce692001136413f0437413c9`.

## What is in 0.4.1

- Home, four task paths, equipment profiles, saved checks, and all 21 tools.
- Existing planners, calculators, file import/export, phone location, and offline
  operation where the tool does not require online map data.
- Passive Connection Doctor receive over Android USB serial or UDP, supported
  MAVLink/CRSF/MSP frame observations, and a TCP reachability probe.
- Connected Configuration workbench for Betaflight CLI, ArduPilot parameters,
  and PX4 parameters over USB serial or MAVLink UDP.
- Connected runs save a before-change snapshot and read the controller again.
  Practice is explicit and never substitutes for a failed hardware connection.
- ArduPilot and PX4 connected reads include a searchable complete parameter
  catalog. The comparison lets the operator select exact changes; identity and
  calibration parameters are preserved by default but can be deliberately
  included.
- A finished hardware run can reconnect after a manual power cycle and record
  `verified-persistent` only when every applied value still matches. **Process
  next aircraft** keeps the loaded template and work order for the line.

There is no license, admin, training, or Practice gate on connected mode. Device
state checks still stop unsafe or unverifiable writes: armed or unknown armed
state, missing identity, board/firmware drift, unsupported parameters, transport
loss, or failed readback.

## Automated checks

The GitHub Actions workflow runs the configuration model and wire protocol tests,
checks the full UI at 360, 393, and 800 px, asserts that all 21 tools remain in
the catalog, completes connected PX4 UI and ArduPilot wire-level
read/change/readback checks, and builds
the APK with Android API 35. The software checks do not replace physical flight
controller testing.

## Physical test order

1. Install over a backed-up 0.3.2 device and confirm Home, saved equipment, and
   the Tools list remain available.
2. On one disarmed controller, pull and export the original configuration.
3. Change one reversible value, compare it, apply it, and inspect readback.
4. Power-cycle the controller and tap **Verify after power cycle**. Do not count
   a MAVLink run labeled only `verified-active` as persistence proof.
5. Repeat on representative Betaflight, ArduPilot, and PX4 hardware before a
   production-line rollout.

Signed MAVLink key handling, firmware flashing, missions/fences and unattended
multi-device USB switching are not in 0.4.1. Process physical controllers one
at a time and keep the run report.
