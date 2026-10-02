# Field Kit 0.4.2 guided workflows

Field Kit 0.4.2 applies the same ease-of-use rule across the full Android app:
start with the operator's job, show the normal choices first, explain the result
in plain language, and keep the technical path available under details.

## App-wide changes

- Five job paths now lead the home screen: configure drones, fix a connection,
  plan a radio link, set up video, and use field utilities.
- All 21 tools use action-oriented names and short instructions. Search accepts
  task words as well as technical terms.
- Technical explanations and uncommon controls use progressive disclosure.
- Workflow tools keep a visible next action instead of leaving the operator at
  a result with no handoff.

## Guided ArduPilot editing

The Configuration workbench now renders the controller's actual parameter
catalog as guided cards. Cards can show a readable title and description,
current and target values, units, numeric limits, enumerated choices, bitmask
checkboxes, user level, restart requirements, and per-aircraft preservation.

Official descriptions are downloaded by the native Android shell from the
allowlisted ArduPilot parameter metadata endpoint for ArduCopter, ArduPlane,
Rover, or ArduSub. Only metadata for parameters present on the connected
controller is returned to the WebView. A small core catalog works offline.
Unknown parameters remain editable by raw name. The expert text editor is never
removed, and it edits the same template used by the guided cards.

The connected workflow remains: full read, explicit selection, comparison,
per-aircraft backup, typed MAVLink write, complete readback, and optional
post-power-cycle persistence verification.

## Verification

- 50 deterministic configuration, MAVLink transport, preservation, metadata,
  editor, and failure-path tests.
- Phone/tablet browser checks at 360, 393, and 800 pixels in CI.
- Android Java compilation and APK assembly in CI.
- Physical flight-controller validation is still required before release use.
