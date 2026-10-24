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
