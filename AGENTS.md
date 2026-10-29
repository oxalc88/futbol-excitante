# Fútbol Excitante — agent rules

## Authoritative documents

- `VISION.md`: product vision.
- `research/` and `specs/`: gameplay research and specifications.
- `IMPLEMENTATION.md`: current engine scope.
- `EVALUATION.md`: evaluation contracts and manual review.

## Rules

- Do not force-push. Do not reset or rewrite `main`.
- Use one branch for each task. Open a pull request to `main`.
- Run `scripts/verify.sh` before you open a pull request. All checks must show PASS.
- The writer and the reviewer of a change must use different models.
- Every capability PR updates `docs/PROGRESS.md` with one entry: date (UTC-5), PR and issue links, what changes for the player (in Spanish), what to test, and what breaks.
- Every capability PR keeps the capability map in `.agents/skills/verify-futbol-excitante/SKILL.md` up to date.
- Use `.github/pull_request_template.md`.
- Do not add a deploy job or publish the game without explicit approval.

## UI text

- Cut taglines, helper text and secondary labels. If a screen needs them to make sense, fix the layout.
- Make the best decision that will elevate all three: the user experience (UX), developer experience (DX), and agent experience (AX) always, without breaking anything.
- Enforcement: review rejects a PR that adds on-screen help text, labels or explanations. Put controls only on the controls screen or in pause, not over the match. Reviewers examine the e2e screenshots against this rule. `scripts/smoke-touch.mjs` stage 8 fails if text shows over the match.

## Verification

```bash
scripts/verify.sh
```

The script runs `npm ci`, typecheck, tests, the headless evaluation, the build and a headless browser smoke test (`scripts/smoke-browser.mjs`). It prints PASS or FAIL for each check and exits non-zero if one check fails. Set `CHROME_PATH` to use a specific Chrome or Chromium.

See [.agents/skills/verify-futbol-excitante/SKILL.md](.agents/skills/verify-futbol-excitante/SKILL.md) for verification steps, evidence and capability coverage.

## Model selection

The writer and the reviewer must use different models.

- Until 2026-10-30: use `pi` with `mimo-v2.6-flash` to implement. Use Codex `gpt-6.1-sol` to review. If a task fails verification two times, use `glm5.3-flash`. If that also fails, use Sol to implement.
- From 2026-10-31: use Codex only. Use GPT-6 Luna to implement bounded tasks: UI, presets, tests and repetitive work. Use Sol to implement complex or long tasks: C5/C10 class tasks and PES mechanics blocks. Always use Sol at effort `medium` to review. Do not use Luna to review.
- From 2026-10-31, record the first 3 or 4 PRs that Luna implements in `docs/TOKENS.md`. Record the tokens and the number of rounds.
- From 2026-10-31, do not start `pi`, OMP, OpenCode or Grok routes that use NaN models. Do not set `NAN_API_KEY`.
