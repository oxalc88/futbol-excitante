# C5 manual device test record

Physical testing is pending. Run on a reachable build and fill in every action;
attach screenshots/video links, including failures. Repeat the pad actions for
both Xbox and PlayStation controllers, then with both connected together.
This checklist follows the C5 request and `EVALUATION.md`; confirm it against
issue #44 when available.

| Session detail | Value |
| --- | --- |
| Tester / date | |
| Device model / controller model | |
| OS / version (iOS for iPhone) | |
| Browser / version (Safari for iPhone) | |
| Controller connection (USB / Bluetooth) | |
| Build commit / local changes | |
| Build URL | |

Use PASS / FAIL / BLOCKED per action; record expected versus observed behavior.
Copy this table for each device/controller combination.

| Device | Action / expected result | Result | Observed behavior / notes | Screenshot / video |
| --- | --- | --- | --- | --- |
| iPhone Safari | Start a match; play in portrait and landscape; controls remain accessible. | | | |
| iPhone Safari | Move, stop and turn with the joystick; release returns to neutral. | | | |
| iPhone Safari | Move while charging and releasing a shot; one shot on release. | | | |
| iPhone Safari | Move while shielding; release clears shield. | | | |
| iPhone Safari | Test pass, through ball, cross, tackle, header, lob, slide and sprint. | | | |
| iPhone Safari | Switch player; pause/resume and open/close menu. | | | |
| iPhone Safari | Cancel a joystick/button/shot gesture; no stuck movement or unintended shot. | | | |
| iPhone Safari | Switch apps and return during movement/shot charge; no stuck control or phantom shot. | | | |
| Xbox / PlayStation | Connect and start; verify movement dead zone and independent right-stick aim. | | | |
| Xbox / PlayStation | Test action buttons, sprint, shield and player switch. | | | |
| Xbox / PlayStation | Hold/release shot at short and full charge; fires once. | | | |
| Xbox / PlayStation | Press/hold/release Start to pause/resume; one toggle per press. | | | |
| Both pads | Start two-player match; verify separate controls and stable player slots. | | | |
| Both pads | Disconnect one during shot charge; no shot and other pad keeps its slot. | | | |
| Both pads | Reconnect with shot/action button held, then release; no phantom action. Fresh press works. | | | |
| Both pads | Repeat disconnect/reconnect with the other controller. | | | |

## Automation coverage

Automated checks use fake standard pads in Chromium. They do not verify a physical
controller or iPhone Safari. The manual table above remains the hardware record.

| Manual row | Automation coverage |
| --- | --- |
| iPhone: portrait and landscape | Human only: real Safari layout and ergonomics. |
| iPhone: joystick move, stop and turn | Human only: real touch movement and latency feel. |
| iPhone: move while charging a shot | Human only: simultaneous gestures. Automated (scripts/smoke-gamepad.mjs, scenario 6) checks one touch shot tap only. |
| iPhone: move while shielding | Human only: simultaneous gestures and ergonomics. |
| iPhone: action buttons and sprint | Human only: real touch targets and latency feel. |
| iPhone: switch, pause and menu | Human only: Safari controls and dialogs. |
| iPhone: cancel gesture | Human only: real pointer cancellation. |
| iPhone: switch apps | Human only: iOS app switching and input reset. |
| Pad: connect, dead zone and aim | Human only: Xbox/PlayStation mapping, real dead zone and right-stick aim. Scenario 5 covers fake left axes only. |
| Pad: actions, sprint, shield and switch | Human only: real pad mapping. |
| Pad: short and full shot charge | Automated (scripts/smoke-gamepad.mjs, scenarios 2 and 4): charge, single release, fresh short charge. Human only: full charge and physical buttons. |
| Pad: Start pause/resume | Automated (scripts/smoke-gamepad.mjs, scenario 1). |
| Both: separate controls and stable slots | Automated (scripts/smoke-gamepad.mjs, scenarios 3 and 5). |
| Both: disconnect during charge | Automated (scripts/smoke-gamepad.mjs, scenario 3), for each pad. |
| Both: reconnect held, release, fresh press | Automated (scripts/smoke-gamepad.mjs, scenario 4), for the shot button. Human only: other physical buttons. |
| Both: repeat with other pad | Automated (scripts/smoke-gamepad.mjs, scenarios 3 and 4). |

All physical sessions still need a human check for USB/Bluetooth behavior, latency
feel, real Xbox/PlayStation models, and comfort.
