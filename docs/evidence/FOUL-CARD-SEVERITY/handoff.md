# FOUL-CARD-SEVERITY — Unit A handoff

## Output
- src/simulation/card-policy.ts — resolveDirectRedForFoul: normalized [0,1] contact severity from committed tackle facts only; exported FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD (0.85, fouls-v1 §9.1 VERSIONED_PROVISIONAL).
- src/simulation/loop/simulation.ts — the two existing card sites issue a DIRECT expulsion when resolveDirectRedForFoul(p) === "expulsion", behind the same default-OFF issueCards gate; takes precedence over the accumulation card for the same foul.
- eval/contracts/** + eval/oracles/fouls.ts + eval/oracles/wire.ts — additive CARD-DIRECT-RED registration (criterion record, protected oracle checkFoulCardDirectRed with power guards, invariant definition, binding FOULS-CARD-DIRECT-RED-001, suite row, scenario); ALL_TEST_IDS additive.
- specs/FOULS_CARDS_SPEC.md — §5.3/§7/§9.1 status: the contact-severity direct-red path is implemented behind the default-OFF card gate.
- eval/runners/** — driven crossing fixture wiring (deep-slide shape, commitDistance 4.0, earliestTick 48) + two-run byte-identity capture.
- tests/unit/loop/card-machinery-sim.test.ts + tests/unit/eval/* — threshold pins, gate-off default, driven crossing/standing streams, oracle PASS/NOT_EVALUATED honesty, gate-off byte-identity.

## Provenance
- Every fact traces to: specs/FOULS_CARDS_SPEC.md §7/§9.1, src/simulation/card-policy.ts, src/simulation/loop/simulation.ts, eval/oracles/fouls.ts, eval/runners/defensive-duel-driver.ts.

## Local checks
- pnpm run typecheck — exit 0; fouls/eval unit tests green (204/204 at candidate time; re-verified 16/16 card-machinery+advantage on the current tree).
