# CAPABILITY-SWERVE — Screenshot Evidence

Captured during the CAPABILITY-SWERVE gauntlet objective.

| File | Description |
|------|-------------|
| `single-player-with-ball.png` | Single player with ball at center circle (tick 330, hash: `fnv1a64-v1:f3d0b2d1...`) |
| `two-player-duel.png` | Two-player duel with ball (tick 285, hash: `fnv1a64-v1:...`) |
| `simulation-extended.png` | Extended simulation running (tick 645) |
| `swerve-ball-curve.png` | Magnus Curve trajectory diagram — 3 paths: low curveCoeff=0.001 (red), high curveCoeff=0.020 (blue), straight (yellow). Delta lateral deviation = 21.09m |
| `swerve-evaluation-results.png` | Full evaluation dashboard — all 5 axes (swerve, transient-acceleration, physical-contact, body-control, shooting-power) — OVERALL: PASS |

## Swerve axis results

- **Status**: IMPLEMENTED
- **Outcome**: PASS
- **Lateral deviation delta**: 21.091130 (INCREASE direction)
- **Materiality**: 21.091130 >= 0.001 ✓
- **Cross-coupling**: OK (ball-speed diff < 2.0)
- **Zero spin**: zero curve force → straight trajectory ✓
- **Determinism**: bit-identical across runs ✓

## Capture process

These screenshots were produced by the dev server and a browser test harness
using the existing `test-bridge.capture()` API. See
`scripts/capture-screenshots.ts` for the automated capture script used by
future builders.