# C4 wave 2: HUD card evidence

Run after building:

```sh
npm run build
PLAYWRIGHT_CORE_DIR=/path/to/playwright-core CHROME_PATH=/path/to/chrome node scripts/smoke-browser.mjs
```

The existing game, CPU video and lab checks remain in place. The additional check
creates a replay using only public Simulation snapshot/restore/step APIs, loads it
through the normal replay file input and waits for the real engine's direct-red
event. It asserts that this is not a second yellow. No debug hooks or simulation
changes are needed. The replay itself can also be loaded manually from the setup
screen using “Cargar repetición”.

Outputs under `artifacts/local/smoke/`:

- `red-card-replay.json`: scripted dangerous slide checkpoint and replay hash.
- `red-card-expected.json`: engine event, tick and expected announcement.
- `red-card.png`: HUD with the player number, name and team.
- `red-card.json`: observed text/tick, event tick, expiry tick and elapsed time.

The check requires expiry at 100 ticks (with up to 12 ticks allowed for HUD
refresh and browser observation). Wall time is recorded but not asserted (runner speed varies); each browser wait has a 20 s timeout.

Local validation in this managed workspace: TypeScript, tsx tests and build
passed. Browser capture could not run because binding the preview server to
127.0.0.1:4317 fails with `listen EPERM`. Screenshot, timing and full smoke PASS
remain unverified here. Do not treat the expected JSON as browser evidence.

The skill directory is read-only. Apply `docs/c4-capability-map.patch` from the
repository root in a writable checkout to update its C4 row.
