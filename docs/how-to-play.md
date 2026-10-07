# How to Play

## Getting started

Run the shipped browser app — `pnpm dev` for the dev server, or serve the built `dist`. The setup menu opens. Choose a **Match Mode** (AI vs AI or Human vs CPU at 5v5, 5v3, 3v3, 2v2, or 1v1), set team names if you like, pick a **Difficulty** (Easy / Medium / Hard — this scales the CPU's decision quality and reactions), and optionally enable the **Referee** toggle to turn on fouls, free kicks, and cards. Press **START MATCH**.

In Human vs CPU modes you control one player on the home team with the keyboard: `W A S D` to move, `Shift` to sprint, `J` / `L` to pass and shoot, `U` / `I` to tackle, and `Tab` to switch to another teammate (including the keeper in 5v5). There is no gamepad support; the keyboard is the only input.

## Match flow

Play runs kickoff → first half → halftime → second half → fulltime. Goals trigger a brief GOAL phase and an automatic kickoff restart. When the ball goes out, throw-ins, goal kicks, corners, and free kicks (with the referee on) are awarded and served after a short window — your directional input during the window steers where the serve goes when your team is awarded it. Halftime shows a countdown and then the second half starts automatically. At fulltime the match freezes and a panel offers a rematch or a return to the menu.

## Full controls

See [docs/player-controls.md](player-controls.md) for the complete table of every keyboard control, the setup menu options in detail, keeper control, and restart steering.

<!-- sources: src/apps/browser/index.html; src/contracts/controls-legend.ts; src/apps/browser/referee-config.ts; src/apps/browser/fulltime-flow.ts; src/adapters/input-browser/human-restart-control.ts -->
