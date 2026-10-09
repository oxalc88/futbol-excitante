# Player Controls

PES Simulator is played entirely with the keyboard. There is no gamepad or mouse control. This page lists every shipped control, the setup menu options, and the behaviors that run automatically when you give no input.

## Keyboard controls

These are the shipped bindings for the human control slot (slot 1), as shown in the in-app controls legend:

| Action | Keys | Notes |
|---|---|---|
| Move | `W A S D` | Held input; sets the movement axis. |
| Sprint | `Shift` | Held input; increases movement speed. |
| First Touch | `K` | Held input. |
| Pass | `J` | Held input. |
| Shot | `L` | Held input. |
| Switch Player | `Tab` | Edge-triggered (responds to a press, not holding); cycles to the next teammate on your team. |
| Lofted Pass | `E + J` | Hold `E` with `J`; produces a lofted pass instead of a normal pass. |
| Through Ball | `Q + J` | Hold `Q` with `J`; produces a through ball instead of a normal pass. |
| Standing Tackle | `U` | Edge-triggered (press, not hold). |
| Slide Tackle | `I` | Edge-triggered (press, not hold). |

The same table is displayed in the setup menu under "Controls" and behind the `?` button in the in-game controls overlay.

### Second local player (slot 2)

The engine also ships a second local keyboard profile for slot 2, reachable through the URL parameters `?scenario=two-player` (or `?slots=2`), which starts a two-HUMAN duel. Slot 2 bindings: move with the **arrow keys**, sprint with **Right Shift**, and the four action buttons are **Numpad 0** (first touch), **`;`** (pass), **`/`** (shot), and **`,`** (through ball). These bindings are not shown in the in-app legend overlay, which documents slot 1 only.

## Setup menu options

The setup menu is shown when the app opens (unless URL parameters auto-start a match):

- **Match Mode** — selects the scenario: AI vs AI or Human vs CPU at 5v5, 5v3, 3v3, 2v2, or 1v1. In Human vs CPU modes you control one player on the home (first-listed) team; AI vs AI modes are fully autonomous.
- **Home Team / Away Team** — the team name labels shown on the scoreboard (up to 16 characters).
- **Difficulty** — `Easy`, `Medium` (default), or `Hard`. This changes CPU decision quality and reaction speed: Easy weakens the CPU (wider aim, shorter pressing range, slower reactions), Hard strengthens it. Medium is the baseline.
- **Referee** — an opt-in toggle ("Referee — fouls, free kicks & cards"), off by default. When on, it enables foul detection, the bounded advantage window, free-kick awards, and cards, and shows the card HUD. Cards follow two paths: the accumulation path (a player accumulates fouls per match and receives a caution (yellow) at the 2nd foul and an expulsion (red) at the 5th) and the contact-severity path — a foul whose committed contact severity crosses the pinned fouls-v1 threshold is a DIRECT red at the foul tick, before any accumulation. When the toggle is off, no fouls, free kicks, or cards occur.

Press **START MATCH** to begin. **BACK TO MENU** (in game) returns to the setup menu.

## Controlling the keeper

In the 5v5 Human vs CPU mode you can take control of your team's designated keeper. Switch to the keeper with `Tab` (the switch cycle includes every teammate, keeper included). Once the keeper is your controlled player, your `W A S D` movement is the keeper's commanded movement — the keeper's normal arc/positioning logic yields to your input, still capped so you cannot run the keeper past its bounded goal arc at full field speed. Saves and claims follow the shared keeper rules, so a human-directed keeper can still answer a shot on target. The keeper role is live only in the 5v5 modes (AI vs AI 5v5 and Human vs CPU 5v5). If you switch to a field player, or in the smaller modes (5v3, 3v3, 2v2, 1v1) where the keeper role is not live, the keeper is CPU-controlled and holds its arc as normal.

## Steering restarts

When a restart window is active (throw-in, goal kick, or free kick) and your team is the awarding team, your directional input (`W A S D`) steers an awarding-team receiver. The core's nearest-receiver serve re-targets to that receiver, so your positioning during the window changes where the ball is served. Corner kicks are the exception: the core serves a cross to a fixed target at the center of the penalty area, and during a corner window your input moves the receiver the core targets instead. If you give no input, the CPU fallback executes the standard auto-serve exactly as in an AI match.

## Taking a restart yourself

If your controlled player is the designated taker of a throw-in, goal kick, corner kick, or free kick, the core holds the restart open for up to 90 ticks (~1.5 seconds) and waits for **you**. Press `Pass` (`J`) to serve: the ball is played from the taker's body along your current facing/movement direction, so steer with `W A S D` first, then press `J`. If you don't press `Pass` before the window expires, the CPU auto-serve executes exactly as described under "Restarts without input".

## Player switching

`Tab` cycles your controlled player to the next teammate, edge-triggered per press. The cycle includes the designated keeper; switching to the keeper hands keyboard control to that body (see "Controlling the keeper").

## What happens automatically

- **Kickoffs** — the match and each post-goal restart are served automatically after the kickoff window.
- **Restarts without input** — throw-ins, goal kicks, corners, and free kicks are served by the core. Throw-ins and goal kicks serve to the awarding team's nearest receiver; corner kicks serve to a fixed cross target at the center of the penalty area.
- **Halftime** — at the end of the first half the HALF TIME phase shows and a short countdown runs; play then resets and the second half starts automatically.
- **Fulltime** — at the end of the second half the match freezes at FULL TIME and a panel offers REMATCH (or `R`) or BACK TO MENU (or `M`), with the same mode, teams, difficulty, and referee settings.

<!-- sources: src/contracts/controls-legend.ts; src/apps/browser/index.html; src/apps/browser/main.ts (setup menu, difficulty HUD, URL auto-start params, IS_KEEPER_ROLE_LIVE modes, slot-2 wiring); src/apps/browser/referee-config.ts; src/apps/browser/fulltime-flow.ts; src/apps/browser/scenario-selector.ts (two-player URL modes); src/adapters/input-browser/cpu-adapter.ts (difficulty scaling); src/adapters/input-browser/keyboard.ts (slot-1/slot-2 key configs); src/adapters/input-browser/human-keeper-control.ts; src/adapters/input-browser/human-restart-control.ts; src/simulation/loop/simulation.ts (restart countdowns, HUMAN_SERVE_WAIT_WINDOW_TICKS pass-gate, corner penalty-area target); src/simulation/card-policy.ts (accumulation + severity thresholds); specs/FOULS_CARDS_SPEC.md -->
