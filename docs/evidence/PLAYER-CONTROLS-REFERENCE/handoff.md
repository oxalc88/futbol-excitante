# PLAYER-CONTROLS-REFERENCE — Unit A handoff

## Output
- docs/player-controls.md — complete shipped keyboard control table (CONTROLS_LEGEND), setup menu options (mode/scenario, difficulty, referee toggle), keeper takeover, restart destination steering, player switching, automatic behaviors.
- docs/how-to-play.md — getting-started guide and match-flow overview, pointing at player-controls.md.

## Provenance
- Every factual claim traces to: src/contracts/controls-legend.ts, src/apps/browser/index.html, src/apps/browser/referee-config.ts, src/apps/browser/fulltime-flow.ts, src/adapters/input-browser/human-keeper-control.ts, src/adapters/input-browser/human-restart-control.ts, specs/FOULS_CARDS_SPEC.md (accumulation path only; direct-red severity documented as pending, not shipped).
- Sources comment embedded at the bottom of each file.

## Local checks
- pnpm run typecheck — exit 0 (run on the coordinator tree containing this unit's output).
