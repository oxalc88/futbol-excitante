# Gauntlet 0.11.1 — OMP startup version announcement

Patch over 0.11.0. Starting or resuming `/skill:gauntlet` in OMP now requires the same compact version announcement already present in the Grok skills, before status prose or delegation:

`Gauntlet <version> · <agent-or-role> · <model>`

The skill reads `gauntlet/VERSION.json` and reports the active session role/model. Unavailable role/model fields are `unknown`; configured defaults must not masquerade as the active model. This is a skill startup instruction, not a new runtime hook or a per-tool-call banner. Start a fresh OMP session after updating the checkout to load the updated skill.

New selection and outcome trajectory records also read the canonical installed version instead of hardcoding 0.11.0. The existing command test covers a patch upgrade within a Horizon and preserves earlier append-only records. Historical releases, frozen baseline and accepted state/evidence are unchanged.

Verification: 47 deterministic scenarios, 46 prompt gates including the new OMP startup rule, and the Node product/runtime/contract checks, state audit, typecheck and build in Gauntlet maintenance CI. The existing base/head classifier retains historical accepted-evidence failures; no oracle is weakened. No Chromium is required for this patch. A live OMP session was not run during validation.

Model routing, Grok/OpenCode adapters, application code and the 0.11 product/quality loop are unchanged. Publication follows the existing immutable tag workflow after merge to main.
