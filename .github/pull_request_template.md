## Capacidad
<!-- Capability (Cn). One line: "Closes #N", "Refs #N", or "No issue: <reason>". -->

## Resultado de verify
<!-- Full local run: flock /tmp/fe-verify.lock env CHROME_PATH=/usr/bin/google-chrome scripts/verify.sh -->
<!-- Paste the "=== summary" block: the line "mode: full" and one "<step>: PASS" line per step. Add the test count. -->

## Evidencia
<!-- Screenshots, match.json, test output. CI uploads only simulation-evidence and local-build; browser e2e evidence is local. -->

## Revisión
<!-- One line per step: "Plan: <model>", "Implement: <model>", "Test: <model>", "Verify: <model>", "Review: <model>". -->
<!-- "Implement" and "Review" are required and must be different models. Then list the review findings. -->

## Checklist
- [ ] `docs/PROGRESS.md` updated (Lima date and time, PR link, issue link or «sin issue», player-facing change, what to test, what breaks)
- [ ] Full local verify passed (`flock /tmp/fe-verify.lock env CHROME_PATH=/usr/bin/google-chrome scripts/verify.sh`) and its summary is pasted above; CI runs only the core steps, browser e2e runs locally
- [ ] No new on-screen help text, taglines or secondary labels (see `AGENTS.md`, UI text); e2e screenshots reviewed
- [ ] Capability map in `.agents/skills/verify-futbol-excitante/SKILL.md` updated
