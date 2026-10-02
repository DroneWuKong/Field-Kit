# Field Kit 0.4.1 ArduPilot production configuration

Field Kit 0.4.1 makes ArduPilot a first-class target in the Android production
configuration workflow. It uses the same `com.dronewukong.fieldtools` package
and original signing identity so it installs as an update.

## ArduPilot workflow

1. Choose **Configuration workbench**, **Connected device**, and **ArduPilot
   parameters**.
2. Connect over USB serial or MAVLink UDP. The app confirms a disarmed
   autopilot, reads its identity and version, then pulls the complete parameter
   catalog. If the count changes while a subsystem is coming online, the app
   restarts the catalog read instead of treating a mixed catalog as complete.
3. Search the live catalog, pull a `.param` file, or load a reviewed parameter
   template. Imported text may use `NAME VALUE`, `NAME,VALUE`, or five-column
   QGroundControl rows.
4. Compare the exact board and firmware. Select the differences to apply.
   Aircraft identity and common calibration values are unchecked by default;
   an operator can deliberately select one when a controlled process requires
   it.
5. The run saves a before-change backup before its first write, sends typed
   `PARAM_SET` messages one setting at a time, then pulls a fresh complete
   catalog and verifies every selected value. Any missing, rejected or changed
   setting stops the run.
6. Manually power-cycle the controller and tap **Verify after power cycle**.
   `verified-persistent` is recorded only after the same controller is read and
   every applied value still matches.
7. Tap **Process next aircraft**. The template, batch and operator remain loaded
   while the connection and asset-label field are cleared for the next unit.

## Scope

This release supports ArduPilot parameter pull, export, import, search,
comparison, selected apply, fresh readback, after-restart verification, reusable
templates and one-at-a-time production handoff. It does not flash ArduPilot
firmware or change missions, fences, rally points or MAVLink signing keys.
Those are separate operations with different protocols and recovery needs.

Practice mode remains a software rehearsal. Connected mode always uses the
native USB/UDP bridge and never falls back to a simulated aircraft.
