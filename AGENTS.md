# Fútbol Excitante — agent rules

## Authoritative documents

- `VISION.md`: product vision.
- `research/` and `specs/`: gameplay research and specifications.
- `IMPLEMENTATION.md`: current engine scope.
- `EVALUATION.md`: evaluation contracts and manual review.

## Rules

- Do not force-push. Do not reset or rewrite `main`.
- Use one branch for each task. Open a pull request to `main`.
- Run the full local verify before you open a pull request. All checks must show PASS. See Verification.
- The writer and the reviewer of a change must use different models.
- Every capability PR updates `docs/PROGRESS.md` with one entry. Write it in Spanish. Give the date and time (Lima, UTC-5), the PR link, the issue link or «sin issue», what changes for the player, what to test and what breaks. Write «PR pendiente» while the PR is open. When you edit the file, remove «PR pendiente» from entries of merged PRs. `tests/docs-format.test.ts` checks the header format and the order.
- Every capability PR keeps the capability map in `.agents/skills/verify-futbol-excitante/SKILL.md` up to date.
- Use `.github/pull_request_template.md`. Fill all 5 sections. The `pr-body` check (`.github/workflows/pr-body.yml`) fails if a section is empty, the issue line is missing, the verify summary is not `mode: full` with PASS for each step, the models per step are missing, or a checklist item is not checked.
- Do not add a deploy job or publish the game without explicit approval.

## UI text

- Cut taglines, helper text and secondary labels. If a screen needs them to make sense, fix the layout.
- Make the best decision that will elevate all three: the user experience (UX), developer experience (DX), and agent experience (AX) always, without breaking anything.
- Enforcement: review rejects a PR that adds on-screen help text, labels or explanations. Put controls only on the controls screen or in pause, not over the match. Reviewers examine the e2e screenshots against this rule. `scripts/smoke-touch.mjs` stage 8 fails if text shows over the match.

## Verification

```bash
flock /tmp/fe-verify.lock env CHROME_PATH=/usr/bin/google-chrome scripts/verify.sh
```

This full local run is mandatory before you ask for review. Paste its summary into the PR body.

If a game test fails in the local verify after a merge, for example in the verify of the next task, do not stop the current task. Open a separate PR that contains only the fix. Opening that PR is approved. Merging it needs the owner's approval.

The full run covers the core steps and the browser e2e suites, prints PASS or FAIL for each check, and exits non-zero if one check fails.

CI (`.github/workflows/ci.yml`) runs `scripts/verify.sh --ci`, which runs only the core steps: no-legacy, install, typecheck, test, evaluate, build, dist-check, build-lab. Browser e2e suites run only locally; CI installs no browser and runs no browser step.

A second workflow, `.github/workflows/pr-body.yml` (check `pr-body`), reads only the PR description. It has read-only permission, runs no build and publishes nothing. To check a body locally: `node scripts/check-pr-body.mjs --file <body.md>`.

See [.agents/skills/verify-futbol-excitante/SKILL.md](.agents/skills/verify-futbol-excitante/SKILL.md) for verification steps, evidence and capability coverage.

## Model selection

The writer and the reviewer must use different models.
Every summary names the model of each step: plan, implement, test, verify and review. This applies to the PR body («Revisión»), the task report and the `docs/TOKENS.md` rows.

| Period (Lima) | Implement | Test interfaces | Review |
|---|---|---|---|
| Until 2026-10-27 | `pi` with `mimo-v2.6-flash`. After two failed verifications, `glm5.3-flash`. If that also fails, Codex `gpt-6.1-sol`. | — | Codex `gpt-6.1-sol` |
| 2026-10-28 | As above. Rolando approved `pi` with `deepseek-v4-flash` on 2026-10-28. | — | Codex `gpt-6.1-sol` |
| 2026-10-29 to 2026-10-30 | `pi` with `deepseek-v4-flash` or `glm5.3-flash`. If both fail, Codex `gpt-6.1-sol`. | Codex `gpt-6.1-terra`: screenshots and UI checks only. Terra does not review code. | Codex `gpt-6.1-sol`, effort `medium` |
| From 2026-10-31 | Codex only. Luna (`gpt-6-luna`) for bounded tasks: UI, presets, tests and repetitive work. Sol (`gpt-6.1-sol`) for complex or long tasks: C5/C10 class tasks and PES mechanics blocks. | — | Sol, effort `medium`. Do not use Luna to review. |

Audit PRs (2026-10-30, Rolando's decision, overrides the table for these PRs only):
plan with Claude Code `claude-opus-5-5` (effort `high`), implement with Codex `gpt-6-luna`,
verify with Codex `gpt-6.1-sol` (effort `medium`), final review with Claude Code `claude-opus-5-5` (effort `high`).

- From 2026-10-31, record the first 3 or 4 PRs that Luna implements in `docs/TOKENS.md`. Record the tokens and the number of rounds.
- From 2026-10-31, do not start `pi`, OMP, OpenCode or Grok routes that use NaN models. Do not set `NAN_API_KEY`.
