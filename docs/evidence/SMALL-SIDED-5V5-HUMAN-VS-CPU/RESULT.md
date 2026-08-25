## Builder report
- objective_id: SMALL-SIDED-5V5-HUMAN-VS-CPU
- builder_agent: builder-gameplay
- builder_model: mimo-v2.5
- evidence_class: DYNAMIC_VISUAL
- hypothesis: A full 5v5 human-vs-CPU match mode is playable in the browser with 10 players (5 per team), keyboard control of the active player via slot-1 HUMAN with Tab switching, CPU-controlled teammates and opponents, and deterministic simulation.
- files_changed:
  - eval/scenarios/5v5-human-vs-cpu.v1.json (NEW) — scenario definition for 5v5 human-vs-CPU match
  - src/apps/browser/foundation-scenario.ts (MODIFIED) — added import and export for FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5
  - src/apps/browser/scenario-selector.ts (MODIFIED) — added `?mode=human-vs-ai-5v5` routing
  - src/apps/browser/json-modules.d.ts (MODIFIED) — added type declaration for 5v5-human-vs-cpu.v1.json
  - tests/browser/5v5-human-vs-cpu.browser.test.ts (NEW) — browser tests for 5v5 human-vs-CPU scenario
  - tests/unit/eval/SMALL-SIDED-5V5-HUMAN-VS-CPU-binding.test.ts (NEW) — node binding test for evidence artifacts
  - scripts/capture-5v5-human-vs-cpu-evidence.ts (NEW) — evidence capture script (trajectory, browser-cases, sequence)
  - docs/evidence/SMALL-SIDED-5V5-HUMAN-VS-CPU/RESULT.md (NEW) — this file
  - docs/evidence/SMALL-SIDED-5V5-HUMAN-VS-CPU/trajectory.json (NEW) — per-tick hashes + event summary
  - docs/evidence/SMALL-SIDED-5V5-HUMAN-VS-CPU/browser-cases.json (NEW) — browser case evidence
  - docs/screenshots/SMALL-SIDED-5V5-HUMAN-VS-CPU/sequence.json (NEW) — semantic frame sequence
  - docs/screenshots/SMALL-SIDED-5V5-HUMAN-VS-CPU/frame-*.png (NEW) — 5 semantic frames
- commands_run:
  - cmd: CI=1 pnpm vitest run --project browser tests/browser/5v5-human-vs-cpu.browser.test.ts
    exit_code: 0
    result: 20 tests passed
  - cmd: npx tsx scripts/capture-5v5-human-vs-cpu-evidence.ts
    exit_code: 0
    result: trajectory.json (361 ticks), browser-cases.json, sequence.json (5 frames) written
  - cmd: CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-5V5-HUMAN-VS-CPU-binding.test.ts
    exit_code: 0
    result: 20 tests passed
- tests_run:
  - name: "5v5 human-vs-CPU scenario structure (7 tests)"
    result: PASS
  - name: "5v5 human-vs-CPU determinism (3 tests)"
    result: PASS
  - name: "5v5 human-vs-CPU human input (1 test)"
    result: PASS
  - name: "5v5 human-vs-CPU player switching (3 tests)"
    result: PASS
  - name: "5v5 human-vs-CPU simulation (2 tests)"
    result: PASS
  - name: "5v5 human-vs-CPU DYNAMIC_VISUAL evidence (4 tests)"
    result: PASS
  - name: "SMALL-SIDED-5V5-HUMAN-VS-CPU binding (20 tests)"
    result: PASS
- integration_test_result: PASS
- slot_wiring_result: PASS — scenario has 1 HUMAN slot (slot-1, team-a, player-1) and 9 AI_FALLBACK slots (4 team-a teammates + 5 team-b opponents)
- required_evidence:
  - trajectory.json: PRESENT — 361 per-tick hashes, event summary with player-player-contact events
  - browser-cases.json: PRESENT — case BROWSER-5V5-HUMAN-VS-CPU passed=true
  - sequence.json: PRESENT — 5 semantic frames (before, human-input, cpu-play, switch, continuity)
  - Screenshots: 5 PNGs, all non-blank, distinct hashes
  - RESULT.md: PRESENT
- artifacts:
  - docs/evidence/SMALL-SIDED-5V5-HUMAN-VS-CPU/trajectory.json
  - docs/evidence/SMALL-SIDED-5V5-HUMAN-VS-CPU/browser-cases.json
  - docs/evidence/SMALL-SIDED-5V5-HUMAN-VS-CPU/RESULT.md
  - docs/screenshots/SMALL-SIDED-5V5-HUMAN-VS-CPU/sequence.json
  - docs/screenshots/SMALL-SIDED-5V5-HUMAN-VS-CPU/frame-before.png
  - docs/screenshots/SMALL-SIDED-5V5-HUMAN-VS-CPU/frame-human-input.png
  - docs/screenshots/SMALL-SIDED-5V5-HUMAN-VS-CPU/frame-cpu-play.png
  - docs/screenshots/SMALL-SIDED-5V5-HUMAN-VS-CPU/frame-switch.png
  - docs/screenshots/SMALL-SIDED-5V5-HUMAN-VS-CPU/frame-continuity.png
- spec_sections: N/A — no dedicated spec for 5v5 human-vs-CPU; implemented following existing human-vs-CPU patterns (5v3, 3v3)
- acceptance_criteria_met: YES
  - Full 5v5 human-vs-CPU match mode with 10 players (5 per team) ✓
  - Keyboard control of active player with Tab switching ✓
  - CPU-controlled teammates and opponents ✓
  - Browser test coverage: structure, determinism, human input, player switching, simulation, screenshots ✓
  - DYNAMIC_VISUAL evidence: trajectory.json, browser-cases.json, 5 semantic frames + sequence.json ✓
  - Node binding test verifies all artifacts and preserves neighboring evidence ✓
- known_gaps:
  - No dedicated goalkeeper handling (per architecture boundary)
  - No regulation rules or full-match ecology (per architecture boundary)
  - Player-switch INDICATOR-002 pre-existing failure is not addressed (per objective constraint)
  - The5v5 scenario uses the same player positions as the5v5 AI fixture; no distinct 5v5-specific formation
- claims_not_made:
  - No PES fidelity claim
  - No FOUNDATION_LAB_PASS claim
  - No PROMOTION claim
  - No milestone PASS claim
  - No numeric readability PASS claim
  - No regression PASS claim beyond what the executables actually verify
