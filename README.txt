Prismo Field Kit 0.4.1 Android app and documentation source

The Android project builds the complete Field Kit: Home, 21 tools, equipment
profiles, saved checks, passive USB/UDP diagnostics, and the connected
configuration workbench for Betaflight, ArduPilot and PX4. Version code 7 uses
the original `com.dronewukong.fieldtools` package so a correctly signed APK
updates 0.3.2 without creating a second companion app.

The configuration workbench can pull a Betaflight CLI dump or a complete
ArduPilot/PX4 MAVLink parameter set, search the connected catalog, compare it
with a reviewed template, let the operator select exact changes, write those
changes to one connected controller, and read the result back. After a physical
power cycle it can reconnect and prove that the applied values persisted. The
next-aircraft action preserves the template and work order for quick serial
processing. Connected mode is not hidden
behind a license, role, training, or Practice switch. The workflow still stops
on unknown armed state, identity/firmware drift, unsupported values, disconnect,
or failed readback because those are device-state checks, not user gates.

The two illustrated guides use plain language, numbered arrows, and explicit
labels for examples, simulations, and connected-device evidence.

To regenerate the PDFs from the included screenshots:
  Install Python packages reportlab, Pillow and pypdf, plus DejaVu Sans fonts.
  Run python3 tmp/pdfs/make_guides.py from this archive's root.
  PDFs are written to output/pdf.

The screenshot manifest describes each target and scroll position. CI checks
phone layouts at 360, 393 and 800 pixels, verifies all 21 tools remain present,
and runs a software MAVLink peer through connected pull/apply/readback. Those
checks do not replace physical-controller testing.
