# Gauntlet bureaucracy regression contract — 0.14.0

Gauntlet exists to accelerate safe product progress. Verification protects the product; incident history explains prior failures. Historical machinery state must not become a permanent authority over a correctly verified current product state.

## Measurement model

This contract adapts four public-administration ideas:

- World Bank B-READY separates regulatory framework, public services and operational efficiency. Gauntlet maps these to policy quality, automation quality and execution efficiency.
- The OECD Standard Cost Model decomposes obligations into activities and measures time/cost/frequency. Gauntlet records commands, canonical writes, handoffs, full-suite runs, retries, human interventions and blocking states.
- Administrative-burden research separates learning and compliance costs. For coding agents, learning obligations and compliance actions are measured separately; uncertainty is reported rather than hidden in a single score.
- Sludge audits look for excessive or unjustified friction. Gauntlet therefore reports burden deltas without allowing a low-cost metric to compensate for a product-blocking failure.

References:
- https://www.worldbank.org/en/businessready/methodology
- https://www.oecd.org/en/publications/implementing-regulatory-impact-assessment-at-peru-s-national-superintendence-of-sanitation-services_c0cdc331-en/full-report/guidelines-for-performing-ria_9b9c9171.html
- https://www.cambridge.org/core/journals/behavioural-public-policy/article/abs/sludge-audits/12A7E338984CE8807CC1E078EC4F13A7
- https://academic.oup.com/ppmg/article/5/1/16/6482576

## Hard invariants

1. **Current green state cannot be stopped by history.** A complete valid PASS for the current target is authoritative for current admission.
2. **Safe deterministic work forbids human stop.** If a routine action or safe product objective is executable, continuation cannot require a human merely to repair bookkeeping.
3. **Machinery is not product progress.** Gauntlet/test/ledger-only changes never increment player-visible progress or complete a Horizon.
4. **No bookkeeping retry.** A new CERT label, ledger write, state note or evidence publication alone cannot create a fresh verification execution.
5. **Changed-state verification.** Any changed product or verification input creates a new content-addressed current state that may be verified once even when an older incident exhausted recovery. The prior failure classification does not grant or deny observation of new current truth; an unchanged state cannot rerun.
6. **No aggregate bureaucracy score.** Each failure remains visible; burden reductions cannot offset weakened quality or a new stop condition.

## Prospective burden counters

For each representative flow record:

- mandatory commands;
- canonical writes;
- model/agent handoffs;
- full-suite executions;
- retries;
- human interventions;
- blocking states;
- learning obligations.

Time and tokens may be added when complete telemetry exists. Missing measurements are UNAVAILABLE, never zero.

The 0.11.0 baseline is semantic because complete historical action/time/token telemetry does not exist. It preserves the product-outcome authority that 0.11 introduced. Numeric burden comparison begins prospectively with 0.14 traces.

No new manual manifest or approval is required to satisfy this contract. The eval is derived from code/scenario traces so measuring bureaucracy does not create more bureaucracy.
