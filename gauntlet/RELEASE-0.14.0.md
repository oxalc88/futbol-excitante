# Gauntlet 0.14.0 — current-state authority and bureaucracy regression evals

0.14.0 restores the product-outcome hierarchy introduced in 0.11 while preserving the evidence and quality protections added later.

## Behavior change

A canonical incident is now scoped to the verification input state that failed, not to a repository boundary forever. The incident ledger remains append-only. No FAIL is rewritten and no recovery budget is reset.

- PRODUCT_FAILURE can be reverified only after product inputs change.
- HARNESS_ENVIRONMENT or UNKNOWN can be reverified after product or verification-machinery inputs change.
- Bookkeeping-only changes, CERT renames, state notes and evidence publication cannot manufacture another execution.
- A complete valid current-target PASS is authoritative for current admission. Historical incidents remain available for audit but cannot veto that PASS.
- Existing one-diagnosis/one-repair/resume controls still prevent repeating the same failed verification state indefinitely.

This directly addresses the published repository/full deadlock: after a material 0.14 machinery correction, continuation can select CERTIFY_CURRENT instead of requiring a human to alter the canonical ledger.

## Bureaucracy evals

The new deterministic bureaucracy contract measures policy separately from operational friction. It adapts World Bank B-READY, the OECD Standard Cost Model, administrative-burden research and sludge-audit ideas.

Hard regressions include:

1. current PASS stopped because of historical machinery state;
2. human stop while a deterministic action or safe product objective exists;
3. machinery-only work counted as product progress;
4. bookkeeping-only changes creating fresh verification authority.

Prospective counters expose mandatory commands, canonical writes, handoffs, full-suite runs, retries, human interventions, blocking states and learning obligations. They are reported independently; there is no aggregate score that can hide a serious regression.

The frozen 0.11.0 baseline is semantic because complete historical burden telemetry was not recorded with these definitions. Numeric burden comparison begins prospectively.

## Compatibility

No application/gameplay code, gameplay requirement, oracle, timeout, retry count, worker count or model route is changed. Objective acceptance, full certification, normal-play Horizon outcome, independent reviews, evidence provenance and exact-target milestone/release certification remain required.
