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

## Verification

```bash
scripts/verify.sh
```

The script runs `npm ci`, typecheck, tests, the headless evaluation, the build and a headless browser smoke test (`scripts/smoke-browser.mjs`). It prints PASS or FAIL for each check and exits non-zero if one check fails. Set `CHROME_PATH` to use a specific Chrome or Chromium.

See [.agents/skills/verify-futbol-excitante/SKILL.md](.agents/skills/verify-futbol-excitante/SKILL.md) for verification steps, evidence and capability coverage.

## Model selection

Select the model by role, not by provider.

| Role | Model |
|---|---|
| Coordination, review, hard coding | Codex |
| Scoped coding | `deepseek-v4-flash` or `glm5.3-flash` |
| Verification, second opinion | `qwen3.8-flash` or `mimo-v2.6-flash` |
| Mechanical tasks | `gemma4` or `qwen3.6` |

- The writer and the reviewer must use different models.
- If a flash model fails verification two times, escalate the task to Codex.
- Codex default: GPT-6.1 Sol (or the available Sol model) at effort `medium`. Use `high` or `xhigh` only when verification fails or the task is clearly hard. Effort levels: `low`, `medium`, `high`, `xhigh`, `max`.

### Transition on 2026-10-31

- NaN Builders models (through `pi`) are available until 2026-10-30 only.
- From 2026-10-31, use Codex only. Coding moves to Codex at effort `low` or `medium`. For a second opinion, use a separate Codex session or a different effort level.
- From 2026-10-31, do not start `pi`, OMP, OpenCode or Grok routes that use NaN models. Do not set `NAN_API_KEY`.
