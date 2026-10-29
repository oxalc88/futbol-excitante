## Capacidad
<!-- Capability (Cn) and issue: "Closes #N" or "Refs #N" with the reason -->

## Resultado de verify
<!-- Full local run: flock /tmp/fe-verify.lock env CHROME_PATH=/usr/bin/google-chrome scripts/verify.sh -->
<!-- Paste its summary (PASS/FAIL per step) and the test count -->

## Evidencia
<!-- Screenshots, match.json, test output. CI uploads only simulation-evidence and local-build; browser e2e evidence is local -->

## Revisión
<!-- Reviewer model (different from the writer) and its findings -->

## Checklist
- [ ] `docs/PROGRESS.md` updated (date UTC-5, PR/issue, player-facing change, what to test, what breaks)
- [ ] Full local verify passed (`flock /tmp/fe-verify.lock env CHROME_PATH=/usr/bin/google-chrome scripts/verify.sh`) and its summary is pasted above; CI runs only the core steps, browser e2e runs locally
- [ ] No new on-screen help text, taglines or secondary labels (see `AGENTS.md`, UI text); e2e screenshots reviewed
- [ ] Capability map in `.agents/skills/verify-futbol-excitante/SKILL.md` updated
