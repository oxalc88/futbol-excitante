# C5 manual device test record

Physical testing is pending. Run on a reachable build and fill in every action;
attach screenshots/video links, including failures. Repeat the pad actions for
both Xbox and PlayStation controllers, then with both connected together.
This checklist follows the C5 request and `EVALUATION.md`; confirm it against
issue #44 when available.

Xbox names: A = ✕, B = ○, X = □, Y = △, LB = L1, RB = R1, LT = L2, RT = R2, Menu = OPTIONS. Xbox pads have no touchpad: change the camera with key C or the top-bar icon.

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
| iPhone Safari | Start a match in landscape. Turn to portrait and back. Record what the screen shows and if the clock runs. | | | |
| iPhone Safari | Stick: move, stop and turn. Release: the player stops. R1 + stick: sprint. | | | |
| iPhone Safari | Attack: ✕ pass, ○ cross, △ through ball, □ hold and release shot (short and long hold). One shot on release, also when the finger slides off the button. | | | |
| iPhone Safari | Defence: hold ✕ (pressure), R1 + hold ✕ (chase), ✕ ×2 (standing tackle), ○ (slide), hold □ (one teammate presses), □ ×2 + hold (two teammates), hold R2 (jockey), L1 (switch player). | | | |
| iPhone Safari | Keeper: hold L1 + R2 together takes the keeper. Hold △ (rush out), R1 + hold △ (sprint rush). With the ball: ✕ hand throw, △ throw into space, hold ○ volley punt, R2 + hold ○ high punt. | | | |
| iPhone Safari | Set pieces: hold and release □, ○ or ✕; hold R2 fixes the aim; L1 + ✕ short roll; L1 + □ panenka (penalty); ○ then ✕ feint; L2 shows only on an own free kick, places the second taker beside the ball, and hold L2 + kick lets him kick. Wall: □ jump, hold ✕ no jump, hold ○ charge. Hold △ + stick moves the keeper. | | | |
| iPhone Safari | Pause and camera with the top-bar icons; open and close Controls. | | | |
| iPhone Safari | Cancel a gesture (system gesture or notification during a hold): no stuck move, no shot. | | | |
| iPhone Safari | Switch apps during a move or a shot charge and return: no stuck control, no phantom shot. | | | |
| Xbox / PlayStation | Connect and start. Check the left-stick dead zone. In defence, flick the right stick to a teammate: the cursor moves to him. | | | |
| Xbox / PlayStation | Attack: ✕, ○, L1 + ○ lob, △, hold and release □, R1 sprint. Header: □ or a pass button with the ball at head height. No shield button: shielding is automatic on contact. | | | |
| Xbox / PlayStation | Defence: hold ✕, R1 + hold ✕, ✕ ×2, ○ slide, hold □, □ ×2 + hold, hold R2, L1 switch. | | | |
| Xbox / PlayStation | Keeper: R3 takes the keeper. Hold △, R1 + hold △. With the ball: ✕, △, hold ○, R2 + hold ○, R1 with the stick released puts down or picks up the ball, the stick runs with it, ✕ before the release is a feint. | | | |
| Xbox / PlayStation | Foul dive: L1 + L2 + L3 + R3 without R2. The selected player falls, no foul, no card. | | | |
| Xbox / PlayStation | Set pieces: as on touch, plus L1 + ↑ / ↓ (second taker beside / behind), hold L2 (second taker kicks), corner d-pad strategy (attack ↑ ↓ ← →, defence ↑ ← →). | | | |
| Xbox / PlayStation | Hold and release □ at short and full charge: one shot only. | | | |
| Xbox / PlayStation | Press, hold and release OPTIONS: one pause or resume per press. PlayStation: a touchpad click changes the camera. | | | |
| Both pads | Start two-player match; verify separate controls and stable player slots. | | | |
| Both pads | Disconnect one during shot charge; no shot and other pad keeps its slot. | | | |
| Both pads | Reconnect with shot/action button held, then release; no phantom action. Fresh press works. | | | |
| Both pads | Repeat disconnect/reconnect with the other controller. | | | |

## Automation coverage

Automated checks use fake standard pads in Chromium. They do not verify a physical
controller or iPhone Safari. The manual table above remains the hardware record.

| Manual row | Automation coverage |
| --- | --- |
| iPhone Safari: landscape and portrait | Human only: Safari layout and clock behavior. |
| iPhone Safari: stick movement and sprint | `touch-e2e` (multitouch stick + R1 + ✕ pass); human only: latency and comfort. |
| iPhone Safari: attack buttons and charged shot | `touch-e2e` (200 vs 800 ms shot, release outside); human only: real Safari feel. |
| iPhone Safari: defence buttons | `defense-e2e`; human only: real touch mapping and comfort. |
| iPhone Safari: keeper | `keeper-e2e-touch`; `touch-e2e` (L1 + R2 keeper switch). |
| iPhone Safari: set pieces | `touch-e2e` (touch set-piece stages); human only: real device feel. |
| iPhone Safari: pause and camera | Human only: Safari controls and dialogs. |
| iPhone Safari: cancel gesture | `touch-e2e` (pointercancel); human only: system gesture and notification. |
| iPhone Safari: switch apps | Human only: iOS app switching and input reset. |
| Xbox / PlayStation: connect, dead zone and right-stick switch | `pad-smoke` checks connection and movement, not right-stick switching; `defense.test.ts` checks the right-stick switch mapping; human only: physical controller mapping and feel. |
| Xbox / PlayStation: attack buttons | `pad-smoke`; human only: real controller mapping. |
| Xbox / PlayStation: defence buttons | `defense.test.ts` checks defence behavior and controller mappings; `defense-e2e` checks touch defence only. `pad-smoke` has no defence assertions. Human only: physical controller mapping and feel. |
| Xbox / PlayStation: keeper | `keeper-e2e` (10 steps); human only: real controller mapping. |
| Xbox / PlayStation: foul dive | `keeper-controls.test.ts` checks the foul-dive combo; `keeper-e2e` does not test foul dive. Human only: physical combo. |
| Xbox / PlayStation: set pieces | `setpiece-e2e` (24 stages); human only: real controller feel. |
| Xbox / PlayStation: charged shot | `pad-smoke`; human only: full charge and physical buttons. |
| Xbox / PlayStation: pause and camera | `pad-smoke`; human only: physical OPTIONS/touchpad mapping. |
| Both pads: separate controls and stable slots | `pad-smoke`. |
| Both pads: disconnect during charge | `pad-smoke`. |
| Both pads: reconnect while held | `pad-smoke`. |
| Both pads: repeat with other controller | `pad-smoke`. |

All physical sessions still need a human check for USB/Bluetooth behavior, latency
feel, real Xbox/PlayStation models, and comfort.
