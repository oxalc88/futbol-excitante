# Screenshots — WIP Evidence

This directory stores screenshot evidence for each gauntlet objective.

## Structure

```
docs/screenshots/
├── single-player.png      # Earlier sections (single-player scenario)
├── two-player.png          # Earlier sections (two-player duel)
└── <section>/              # One folder per objective
    ├── README.md           # What this section proves
    ├── frame-<NNN>.png     # Screenshot N
    ├── frame-<NNN>.meta.json  # State hash, tick, positions
    └── ...
```

## How builders capture screenshots

Each objective that touches gameplay or presentation should save
screenshots using the browser test harness:

```bash
# Run capture for a specific objective
WIP_SECTION=capability-swerve pnpm run capture-wip

# Capture multiple frames
WIP_SECTION=capability-swerve WIP_FRAMES=5 pnpm run capture-wip
```

This runs `tests/browser/capture-wip.browser.test.ts`, which uses the
existing `bridge.capture()` base64 PNG and writes it through
`eval/capture-snapshot.ts` to `docs/screenshots/<section>/`.

Commit those files only after critic + integration ACCEPT, with the
objective. Screenshots are diagnostic evidence only — not a PES or
PLAYABLE_1V1 PASS.