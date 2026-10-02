"""User-facing copy for the illustrated Field Kit guides."""

def page(title, intro, shot, steps, heading, result, note_heading, note, caption=None):
    return (title, intro, shot, steps, (heading, result), (note_heading, note), caption)

QUICK = [
page('Start here',
     'Field Kit helps you plan a setup, check a connection and keep useful notes. Pick the job you have in front of you.', 'home', [
    ('Choose what you want to do', 'The four buttons on Home are the easiest way in. For a first look, tap Check a connection.'),
    ('Name your setup', 'Save your drone or test rig under Equipment. You can reuse its radio and battery settings instead of typing them again.'),
    ('Looking for something specific?', 'Tap Tools or Search. Try a word such as GPS, cable or battery to find the right tool.')],
    'You don\'t need to learn all 21 tools', 'Start with one task. Come back to Home when you want to try something else.',
    'What the app does', 'Field Kit calculates, checks incoming data and saves notes. Connected Configuration can read and write reviewed flight-controller settings. It does not fly the drone or flash firmware.'),
page('Give your setup a name',
     'Open Equipment. A name makes it much easier to tell one drone\'s settings and reports from another\'s.', 'equipment', [
    ('Use a name you will recognize', '“Demo quad” is used in this guide. Use the name you normally call your own drone or test rig.'),
    ('Add the serial number if you have it', 'You can leave this blank for calculators. You will need a serial number to save a connection check against a particular drone.'),
    ('Save, then check the settings', 'Tap Save equipment. Open the radio, battery and hardware sections below and check their values before using the calculators.')],
    'Use it again next time', 'Your saved setup appears on Home and above the tools. Open Equipment whenever you need to edit it.',
    'One useful distinction', 'These are settings for the app\'s calculations. Saving them does not program your radio or flight controller. Terrain and mesh have their own radio selections.',
    'Example equipment: Demo quad, serial DEMO-001.'),
page('Try it without a drone',
     'Home > Check a connection > Practice. You can learn this part of the app without plugging anything in.', 'doctor-practice', [
    ('Tap Practice', 'This runs a software example. You can switch to USB cable or Wi-Fi / Ethernet later, when you want to check real equipment.'),
    ('Pick an example', 'Start with Healthy telemetry. Then try a fault such as No data, bad frames or stale telemetry to see how the result changes.'),
    ('Tap Try this example', 'Read the message that appears. Open the details below if you want to see what led to it.')],
    'A good first five minutes', 'Run one healthy example and one fault. That is enough to get a feel for the connection checker before you use a cable.',
    'About the examples', 'Practice results are labeled SOFTWARE SIMULATION. They show how the app responds; they are not readings from your drone.'),
page('Read the message, then the details',
     'The connection checker puts the next thing to try near the top, so you do not have to decipher every row first.', 'doctor-fault', [
    ('Check where the result came from', 'This example is simulated. When you check equipment, this area identifies the connection being used.'),
    ('Try the suggested next step', 'Here, No data is arriving points you toward the cable, port or sender. In Practice, Try another fault lets you explore a different example.'),
    ('Open a row if you need more detail', 'Transport, Protocol, Telemetry and Video answer different questions. Tap a row to find out what the app saw.')],
    'What to tell someone else', 'Describe the message and the connection you checked. That is more useful than saying the whole drone “doesn\'t work.”',
    'Keep the links separate', 'A drone may still have control and video even when no GPS telemetry reaches this app. Check each connection on its own.'),
page('Save what happened',
     'After a check, scroll down and open Save a per-drone test record. Use equipment with a serial number.', 'save-check', [
    ('Say who ran the check', 'Enter the operator or station. Add a work order if you use one.'),
    ('Write the useful details', 'What did you connect? What worked? What still needs checking? Include video behavior if you checked it separately.'),
    ('Tap Save diagnostic snapshot', 'The app saves the check, its equipment settings and your notes. Open Saved checks to find it later.')],
    'Make the next check easier', 'A short, specific note can save you from repeating the same troubleshooting next week. If you changed calculator settings during the session, start a fresh check before saving.',
    'Save a copy you can keep', 'The app keeps the latest 50 snapshots on this device. Export anything you need long term. Saving a check does not automatically mark the drone as passed.'),
page('Send someone the report',
     'Open Saved checks, find the right entry, then tap Export readable report.', 'saved-checks', [
    ('Choose the right drone', 'Check the name and serial number before exporting.'),
    ('Check the date and type of check', 'An old report keeps the settings used at that time. Practice reports keep their simulation label.'),
    ('Save the file, then share it', 'Android asks where to save the HTML report. Once saved, send that file using your usual sharing app.')],
    'They can read it without Field Kit', 'The report opens in a browser. It includes the results and notes, with more detail available farther down.',
    'Reading this guide', 'The screenshots use an example drone and practice data. Android\'s permission prompts and file picker are not shown.')
]

TOOLS = {
'equipment-profiles': page('Keep your equipment settings together',
    'Use this when you work on more than one drone, or want to stop re-entering the same numbers.', 'equipment-summary', [
    ('Check which setup is selected', 'The summary shows the name, serial number and main radio and battery values.'),
    ('Edit what changed', 'Open Edit, change the relevant fields, then save. The radio, battery and hardware fields are grouped to make them easier to find.'),
    ('Move a setup to another device', 'Open Import, share or delete equipment. Copy equipment JSON exports the setup; Import reads that format back in.')],
    'When the numbers look different', 'If you changed a shared calculator input, the app marks it inputs changed. Use saved inputs restores the selected equipment\'s values.',
    'Your saved setups', 'You can keep up to 50 profiles. They contain the values you entered; selecting one does not detect or configure the hardware. Use Configuration workbench for connected reads and writes.'),
'connection-doctor': page('Check a USB connection',
    'Use this when your phone is connected to a serial telemetry device and you want to see whether data is arriving.', 'doctor-usb', [
    ('Connect, then choose USB cable', 'Use a cable that carries data and a USB host adapter if your phone needs one. Tap Refresh ports if the device does not appear.'),
    ('Choose the port', 'Select the device you want to read. Android may ask you to allow access to it.'),
    ('Check the protocol and baud rate', 'Open Advanced connection settings. Match the device\'s baud rate; choose Auto detect or the protocol you expect. Scroll down and start the check.')],
    'If the connection stays quiet', 'This checker listens without requesting data. A device using MSP may need requests from another application before it sends anything.',
    'Before you change adapters', 'Stop the check first. Pausing the app or changing the adapter or equipment also closes the session. DTR is optional because it can reset some flight controllers.',
    'The USB port name in this screenshot is an example.'),
'connection-network': page('Listen over Wi-Fi or Ethernet',
    'Use this for a device that sends UDP telemetry to your phone. The phone and sender need a network path to each other.', 'doctor-udp', [
    ('Choose Wi-Fi / Ethernet', 'This makes the phone listen for incoming packets. It does not find or connect to a flight controller automatically.'),
    ('Match the port at both ends', 'The default is 14550. On the sending device, set the destination to your phone\'s IP address and this port.'),
    ('Tap Listen for telemetry', 'Read the result after data arrives. Tap Stop check when you are finished. Use Practice if you want an example without a sender.')],
    'If packets arrive but no position appears', 'Open the Protocol and Telemetry rows. The sender may be reachable without sending the kind of position data the app understands.',
    'A connection is only part of the check', 'UDP reception does not verify which aircraft sent it. A TCP video-endpoint check only shows that the port accepts a connection; it does not play video or measure its delay.'),
'position-health': page('Is this position recent enough?',
    'Use this when coordinates are missing, look wrong or may be left over from an earlier connection.', 'position', [
    ('Set how old is too old', 'Enter the maximum age in seconds. Choose a limit that makes sense for what you are checking.'),
    ('Read the source and age', 'The position may come from the aircraft or a practice session. Check the timestamp and fix information before using it.'),
    ('Compare with the phone', 'Request phone fix asks Android for a current location. Allow location access if prompted, then try again.')],
    'Comparing two positions', 'The tool shows phone and aircraft positions separately. You can also enter a known WGS84 position to compare against them.',
    'What a disagreement means', 'The phone and drone may simply be in different places. HDOP is not an accuracy measurement in meters, and a good GPS fix alone does not establish survey accuracy.'),
'config-inspector': page('Make sense of a Betaflight dump',
    'Use this when someone sends you CLI text, or when you want to check what changed between two configurations.', 'config-input', [
    ('Paste the current configuration', 'Use a Betaflight dump or diff, or import a text file. The text stays in this open session.'),
    ('Add an older copy to compare', 'Open Compare with a baseline and paste the earlier configuration. Prefer a copy from the same board and firmware.'),
    ('Tap Inspect or Compare', 'The button changes to Compare configurations when a baseline is present.')],
    'Start with the board and UARTs', 'The result pulls out board and firmware names, resource pins, UART settings and VTX-table information. It also flags issues in the supplied text.',
    'A diff can leave things out', 'A missing line does not mean a setting was removed or reset. Unsupported and profile-specific lines are not fully interpreted. This tool does not send commands to the board.'),
'config-results': page('Find what changed',
    'Read the comparison before assuming that a new configuration caused the problem.', 'config-results', [
    ('Check the board and firmware first', 'If they differ, the old configuration may not be a suitable comparison. Read any warnings about repeated settings or pin conflicts.'),
    ('Look at the changed fields', 'Each row puts the old and new values side by side. In this example, the VTX channel changed from 1 to 2.'),
    ('Export if you need a second opinion', 'Export comparison saves an HTML report. Send it with a description of the problem you are seeing.')],
    'A useful question to ask', 'Does the changed setting explain the symptom? Open Inspect current global fields when you need to look beyond the differences.',
    'Before changing the board', 'This report is a comparison, not a script to apply. Its SHA-256 hashes identify the supplied text files, not the physical flight controller.',
    'Example board name: DEMO_F405.'),
'fc-matcher': page('Which flight controller target is this?',
    'Use this when you have Betaflight CLI output but do not know which board documentation to look for.', 'fc-matcher', [
    ('Paste the board\'s CLI output', 'Use status or dump-style output from the device you are checking.'),
    ('Tap Identify FC', 'The matcher looks for the board, manufacturer and other identifying text. Clear starts over.'),
    ('Use the name to find the right documentation', 'Check that the reported target matches the actual board before choosing firmware or a wiring diagram.')],
    'If it cannot identify the board', 'Keep the original output and look for the manufacturer\'s exact model and revision. An unknown result is better than guessing a similar target.',
    'About this example', 'DEMO_F405 is a made-up board name used in the guide. The matcher reads text; it does not connect to the board or verify its pin mapping.'),
'elrs-info': page('Look up an ExpressLRS setting',
    'Use this as a quick reference when you are checking an ELRS radio setup.', 'elrs-info', [
    ('Open ExpressLRS reference', 'Find it under Tools. You can read the bundled reference without connecting a radio.'),
    ('Find the section you need', 'Start with the hardware and band tables. Scroll for packet rates, switch modes and telemetry ratios.')],
    'When you need more detail', 'The page links to the configurator, releases, product finder and signal-health documentation. Those links need internet access.',
    'Check the firmware version', 'The built-in reference is a snapshot. Confirm current instructions for your exact radio and firmware before changing its setup.'),
'range': page('Get a first estimate of radio range',
    'Use this to compare radio setups before you look at terrain or test the link outside.', 'range', [
    ('Enter the frequency', 'Use MHz. For example, enter 915 for a 915 MHz link.'),
    ('Enter transmitter power', 'This field uses mW. Enter RF output power, not the electrical power the radio draws from its battery.'),
    ('Check the radio details', 'Expand the gains, receiver sensitivity and margin. Use sensitivity for the radio mode you actually intend to run.')],
    'Read it as a starting estimate', 'The result includes free-space range and the radio link budget. Scroll down to reuse the frequency in related tools.',
    'Why the real range can be shorter', 'Terrain, interference, cable loss, antenna placement and the horizon can all reduce the usable range. This calculation has not measured those conditions.'),
'range-result': page('Take the estimate to the next tool',
    'Once the radio numbers look right, check whether the planned path has enough clearance.', 'range-results', [
    ('Read the free-space limit', 'This is the distance the entered power and sensitivity predict after your selected margin. It is not a tested coverage radius.'),
    ('Tap Use this frequency', 'This carries the frequency into the Fresnel, antenna-length and harmonics tools so you do not have to enter it again.')],
    'Where to go next', 'Use Terrain link to look at the route, and Fresnel clearance to see how much space the signal needs around it.',
    'Watch the power units', 'Link range uses mW. Terrain and mesh use dBm. 100 mW = 20 dBm; 1000 mW = 30 dBm.'),
'rf-terrain': page('Put the radio path on a map',
    'Use Terrain link when a hill or the route itself may be limiting a ground-to-air connection.', 'terrain', [
    ('Place the two ends', 'Tap once for the ground station and again for the aircraft or receiver. Drag either marker to adjust it.'),
    ('Find the area you need', 'Enter coordinates or search for a place. The coordinate tool can also center this map.'),
    ('A blank basemap is still usable', 'You can place points on the grid when map imagery is unavailable. The imagery needs internet access.')],
    'Then scroll to the radio settings', 'Check the selected radios, power, gains, heights and margin before calculating the link.',
    'Map imagery is not elevation data', 'A blank map does not mean flat ground. Load elevation that covers the route. Equipment profiles do not replace this tool\'s radio selections.',
    'Offline map view with example points.'),
'terrain-controls': page('Check the terrain along the route',
    'With the endpoints placed, give the tool elevation data and review the radio settings.', 'terrain-controls', [
    ('Choose elevation data', 'Load an SRTM .hgt file or a WGS84 GeoTIFF .tif/.tiff covering the route, or use the available online elevation source.'),
    ('Calculate the link', 'Check power in dBm, antenna gains and heights. Then read the profile and any problem locations.'),
    ('Try a different route', 'Advanced mode lets you add waypoints or a repeater path. Compare the legs and export a report when you want to keep the plan.')],
    'Look for the part of the route that matters', 'A profile helps you see where the path loses clearance, rather than treating the whole route as one number.',
    'If the data does not cover the path', 'Load the right area and coordinate system. Missing elevation stays unknown. Even a clear modeled path still needs a real link test.'),
'mesh-planner': page('Sketch a radio network',
    'Use this to compare node locations and see where a planned network may be fragile.', 'mesh', [
    ('Choose the ground-station radio', 'Pick the intended radio family or Custom. You can adjust individual node radios below the map.'),
    ('Set power, height and margin', 'Power is in dBm. Use realistic heights and a margin that reflects the link you want to plan.'),
    ('Add the nodes', 'Tap for the ground station first, then the other nodes. Drag markers to try another layout.')],
    'Plan before placing hardware', 'The tool lets you compare links and groups of connected nodes before you build the network.',
    'Use compatible radios', 'Choosing presets does not make different protocols work together. This map is your plan; it has not discovered nearby radios.',
    'Example node layout on the offline grid.'),
'mesh-controls': page('What if one node goes down?',
    'A network that looks connected can still depend on a single relay. Try losing that relay in the model.', 'mesh-controls', [
    ('Load terrain for the area', 'Mesh and Terrain link share the elevation controls. Missing data stays unknown.'),
    ('Tap Analyze mesh', 'Review the link margins and connectivity table. Open a link for more detail or export the report.'),
    ('Try Failure simulation', 'Enable it, then tap a node to take it offline in the plan. Look for nodes that become disconnected.')],
    'Look for a weak point', 'If losing one relay separates the network, try another location or another path. Compare the layouts before testing them outside.',
    'Read the model for what it is', 'Coverage overlays exclude terrain and obstacles. Hop counts and latency are estimates, not measurements from a running network.'),
'fresnel': page('How much clearance does the link need?',
    'Radio signals need space around the straight line between antennas. This tool gives you a scale for that space.', 'fresnel', [
    ('Enter the full path length', 'Use meters for the distance between the two ends.'),
    ('Enter frequency and position', 'Frequency is in MHz. Position along path chooses where you want to calculate the radius.'),
    ('Read the two clearance numbers', 'The full first-zone radius and the suggested 60% clearance are different. Use the diagram to keep them straight.')],
    'Use it alongside the terrain profile', 'Compare the clearance with antenna heights, nearby trees and the ground along the path.',
    'You still need to know what is there', 'This calculator does not locate trees, buildings or other obstacles. It tells you how much space to look for.'),
'dipole': page('Work out an antenna starting length',
    'Use this when planning a dipole, or comparing how antenna dimensions change with frequency.', 'dipole', [
    ('Set the frequency', 'Enter the intended band in MHz. Use this frequency in the range tool can fill it for you.'),
    ('Check velocity factor and units', 'Use a factor suitable for the antenna material and construction. Choose the units you want to work in.'),
    ('Read the element lengths', 'The tool shows wavelength and the calculated lengths for your selected inputs.')],
    'A length to start from', 'Use the dimensions as a starting point for construction and tuning.',
    'Tune the finished antenna', 'The feed and installation affect the final result. This tool does not measure SWR or impedance.'),
'harmonics': page('Could these frequencies overlap?',
    'Use this when choosing bands or investigating a possible interference problem.', 'harmonics', [
    ('Enter the transmitter frequency', 'Use MHz for frequency and dBm for power, or choose a suitable preset.'),
    ('Set the video band', 'Enter its start and end frequencies. The end must be higher than the start.'),
    ('Read the flagged multiples', 'Scroll through the harmonics, video-band overlaps and GNSS warnings.')],
    'A place to start investigating', 'A flagged harmonic tells you which frequency relationship deserves a closer look.',
    'Confirm interference with measurements', 'Suppression and risk levels are approximate. An overlap in the calculation does not prove that the transmitter is causing interference.'),
'vtx-config': page('Prepare settings for a video transmitter',
    'Use this to generate Betaflight CLI text for a supported VTX model.', 'vtx-config', [
    ('Choose the manufacturer and model', 'Match the exact device. The source link shows where the preset settings came from.'),
    ('Choose the UART', 'Check which UART the VTX control wire actually uses and which protocol the hardware supports.'),
    ('Copy the text', 'Review the generated settings, then tap Copy. You can use the text in your usual Betaflight configuration workflow.')],
    'A head start on the configuration', 'The tool prepares settings and a VTX-table snippet. You still decide whether they are right for the board.',
    'Before you apply it', 'Check the board, firmware, wiring and supported frequency and power settings. This generator only prepares text; load it into Configuration workbench when you want to compare and apply it.'),
'unlock-vtx': page('Build a Betaflight VTX table',
    'The app calls this Unlock VTX table. It creates the channel and power table text for you to review.', 'unlock-vtx', [
    ('Choose the control protocol', 'Use the protocol your VTX and firmware support. The power-value format changes with the protocol.'),
    ('Choose power options and bands', 'Select the maximum-power table option and the bands you want included.'),
    ('Copy the table', 'Read the generated text, then copy it for your Betaflight workflow.')],
    'A table you can inspect before using', 'The output lists channel frequencies and power entries for the options you selected.',
    'The name can be misleading', 'Generating a table does not unlock hardware. Confirm which frequencies and power levels your VTX supports and you can use.'),
'channel-planner': page('Give each pilot a video channel',
    'Use this when up to six pilots will use video transmitters at the same time.', 'channel-planner', [
    ('Enter each planned channel', 'Choose a band and channel for each pilot. Check that transmitter and receiver use the same channel table.'),
    ('Add the rest of the pilots', 'Tap Add pilot for more rows, up to six. Remove any rows you do not need.'),
    ('Adjust channels that are too close', 'Read the spacing warnings, change the assignments and check again.')],
    'A channel plan to take to the group', 'Use it to spot close frequencies before everyone switches their video transmitters on.',
    'Test the whole setup together', 'The app flags spacing below 40 MHz. Real interference also depends on transmitter filtering, power and physical placement.'),
'closest-channel': page('Find the channel closest to a frequency',
    'Use this when you know a video frequency but need the corresponding band and channel name.', 'closest-channel', [
    ('Enter the frequency in MHz', 'The tool checks the channel tables included in the app.'),
    ('Choose the bands to search', 'Filter to Raceband or another band, or include all bands if you are unsure.'),
    ('Check the frequency difference', 'The result shows the closest entry. The table below lets you compare other choices.')],
    'Match names at both ends', 'Use the result to help line up the transmitter and receiver settings.',
    'Closest does not always mean usable', 'Confirm the actual channel tables on both devices. This tool looks up frequencies; it does not scan for a signal.'),
'coordinates': page('Put a location in the format you need',
    'Use this to move between decimal degrees, degrees/minutes/seconds and MGRS.', 'coordinates', [
    ('Paste the location', 'Enter decimal degrees, DMS or MGRS. Decimal degrees are latitude first, longitude second.'),
    ('Convert, or use phone location', 'Manual conversion works offline. Use phone location asks Android for a recent fix.'),
    ('Copy the format you need', 'Read DD, DMS and MGRS in the result. Scroll down for Copy coordinates or Open in terrain.')],
    'Move the location into your plan', 'Open in terrain centers the map on it. You still place the path endpoints yourself.',
    'More digits do not mean a better fix', 'A 1 m MGRS cell or six decimal places describes formatting, not measured accuracy. MGRS conversion covers 80°S to 84°N.'),
'battery': page('How long might the battery last?',
    'Use this for a rough estimate when you know capacity and typical current draw.', 'battery', [
    ('Enter the battery rating', 'Capacity is in mAh and nominal voltage is in V. Check the label for the pack you will use.'),
    ('Enter average current', 'Use amps, not milliamps. A measured average under the intended conditions is more useful than a brief peak.'),
    ('Choose a reserve and read the time', 'The reserve holds back some capacity. The result also shows energy in watt-hours.')],
    'A worked example', '5000 mAh at 20 A, with a 20% reserve, gives 12 minutes. At 22.2 V, the pack has 111 Wh of nominal energy.',
    'Use it to plan, then measure', 'Battery health, voltage sag, temperature and changing loads affect real runtime. This is not a live remaining-flight-time display.'),
'signal-check': page('Make sense of a signal reading',
    'Use this with readings from your radio. You can also convert transmitter power between mW and dBm.', 'signal-check', [
    ('Enter RSSI in dBm', 'Use a reading from the radio you are checking.'),
    ('Enter the right receiver sensitivity', 'Use the value for that radio\'s mode and packet rate. Changing the mode can change the sensitivity.'),
    ('Read headroom and link quality separately', 'Headroom is RSSI minus sensitivity. Link quality describes how many packets were received.')],
    'A worked example', 'RSSI of -85 dBm and sensitivity of -105 dBm gives 20 dB of headroom. You can convert mW and dBm in either direction above.',
    'These are your entered readings', 'The app does not measure RF here. A good headroom number alone does not guarantee a reliable link or a particular range.'),
'field-checklist': page('Keep track of what you checked',
    'Use this at the bench so the next person, or your future self, can see what is finished and what is still open.', 'field-checklist', [
    ('Start with hardware and firmware', 'Record the versions before you troubleshoot. They help you compare with earlier work.'),
    ('Check the intended radio setup', 'Confirm antennas, band and channel. Make clear whether a setting is only planned or has been checked on the equipment.'),
    ('Work through the rest', 'Scroll for UARTs, power wiring, telemetry age, reconnection, video and unresolved questions.')],
    'A checklist you can come back to', 'The app keeps your ticks and notes on this device. The count shows how many items you marked.',
    'Two kinds of records', 'You tick these boxes yourself. They are separate from the snapshots saved by the connection checker, and the app does not verify an item just because it is ticked.'),
'bench-export': page('Leave useful bench notes',
    'Scroll below the checklist. A few specifics are much more helpful than “tested” or “does not work.”', 'bench-export', [
    ('Write what you actually tried', 'Name the equipment and firmware, describe the connections and include any measurements or open questions.'),
    ('Check the completed count', 'The count reflects the boxes you ticked. Leave an item unticked if you have not checked it.'),
    ('Export before starting over', 'Export checklist saves an HTML file. Start a new checklist clears the current ticks and notes after confirmation.')],
    'A note worth keeping', 'For example: “USB data arrived at 115200 baud. GPS age stayed above 30 seconds. Video was checked separately; latency was not measured.”',
    'Keep the file if you need it later', 'Clearing app storage removes local checklist notes. Export first, then archive or share the file.'),
'saved-reports': page('Find an earlier check',
    'Use Saved checks before repeating work. An earlier result may explain when a problem started or what someone already tried.', 'saved-checks', [
    ('Match the name and serial number', 'Each entry keeps the equipment settings used when that check was saved.'),
    ('Read the time and type of check', 'Practice stays labeled as simulation. Older records do not change when you edit the current equipment setup.'),
    ('Export the one you need', 'Export readable report creates an HTML file with the results and notes. Extra details expand farther down.')],
    'Compare with what you see today', 'Look for changes in firmware, cabling, radio mode or test conditions. Configuration comparisons and bench checklists have their own exports.',
    'What stays on this phone', 'The app keeps the last 50 snapshots. File hashes help identify the saved data; they do not verify an aircraft\'s identity or certify a production test.')
}

NAVIGATION = page('Find a tool and keep it handy',
    'You can start from Home or search directly. Use whichever is quicker for the job.', 'search', [
    ('Search in ordinary words', 'Tap Tools or Search. GPS finds tools for coordinates and position; battery finds the runtime calculator.'),
    ('Open the result', 'Tap a matching tool. If you use it often, tap the star in its header to pin it on Home.'),
    ('Close the list to return', 'Close the search list to get back to your screen. Android Back also closes lists, then returns an open tool to Home.')],
    'Four places to remember', 'Home starts a task. Equipment holds your saved setup. Saved checks holds snapshots. Tools gives you the full list.',
    'On a small screen', 'Swipe up to reach more controls. Tap section headings to expand them. The bottom navigation may hide while the keyboard is open.')

REPORT = page('What the other person receives',
    'This is a real HTML export from the practice check shown earlier. It opens in a browser.', 'exported-report', [
    ('Check the name and type of check', 'The report names Demo quad and serial DEMO-001. It also says simulation, so the example cannot be mistaken for a hardware check.'),
    ('Read the results and notes', 'Each row shows what was checked, its status and what the app saw. Scroll for the rest of the rows, notes and full record.')],
    'No app needed to read it', 'Someone can open this file without installing Field Kit. Send the HTML file itself, rather than only a screenshot of the report.',
    'Keep the context with the result', 'This report came from Practice. For your own checks, include the connections and test conditions in the notes.',
    'HTML report from the example practice session.')

LAST_SECTIONS = [
    ('Before repeating an old problem', 'Look through Saved checks and earlier exports for the same serial number. See what was tried, what firmware was used and what changed. It may save you a second round of the same troubleshooting.'),
    ('The USB device does not appear', 'Check that the cable carries data, the phone supports the connection and Android granted USB access. Tap Refresh ports. If a port appears but no data arrives, check protocol, baud rate and whether the device actually sends data without requests.'),
    ('Network data or GPS is missing', 'Check the sender\'s destination IP and port. Open the protocol details if bytes arrive but cannot be decoded. Fresh packets do not guarantee fresh GPS: check the position timestamp too.'),
    ('The map is blank', 'You can still place points on the grid. Map pictures and elevation are separate: load a supported elevation file covering the route for offline terrain calculations.'),
    ('Before clearing app storage', 'Export the records you need. Equipment, calculator inputs, pinned and recent tools, checklist notes and the latest 50 snapshots are stored on this device. Saved templates and the latest 10 configuration runs stay on this phone until cleared.'),
    ('About the screenshots', 'General and connected configuration screens are shown from the full Field Kit interface. Version 0.4.1 keeps the package com.dronewukong.fieldtools so it updates earlier builds. Demo quad, DEMO-001, DEMO_F405 and the port labels are examples. The connected result uses a protocol test fixture; physical controller testing is still required.')
]

DESCRIPTIONS = {
    'equipment-profiles':'Reuse settings for a drone or test rig',
    'connection-doctor':'Check incoming data over USB or UDP',
    'position-health':'Check whether a position is fresh',
    'config-inspector':'Read and compare Betaflight CLI text',
    'fc-matcher':'Find a board name in CLI output',
    'elrs-info':'Look up an ExpressLRS setting',
    'range':'Compare radio range estimates',
    'rf-terrain':'Check a radio path against terrain',
    'mesh-planner':'Try node layouts and relay failures',
    'fresnel':'Work out space around a radio path',
    'dipole':'Calculate antenna starting lengths',
    'harmonics':'Look for possible frequency overlaps',
    'vtx-config':'Prepare settings for a VTX model',
    'unlock-vtx':'Generate a Betaflight VTX table',
    'channel-planner':'Give pilots separate video channels',
    'closest-channel':'Find a channel from its frequency',
    'coordinates':'Convert or copy a location',
    'battery':'Estimate runtime from current draw',
    'signal-check':'Understand RSSI and power units',
    'field-checklist':'Keep track of bench checks and notes'
}
