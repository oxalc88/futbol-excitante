# Gauntlet 0.13.2 — published legacy deadlock correction

Corrects the execution policy demonstrated by the published stop in `a0f6161`. This is a patch candidate, not a tagged release or product acceptance.

Execution plans and settlements remain immutable. Automatic bookkeeping recovery records the original Git commit object and a reachable commit with an identical complete tree under `gauntlet/execution/provenance/`. The validator hashes the original commit object, verifies its tree pointer, and independently checks the reachable tree and ancestry. Recovered objects survive publication even when old orphan objects are unavailable. Neither similar patches nor guessed hashes qualify. Missing equivalent trees require regenerated execution evidence.

An imported repository/full UNKNOWN incident with no execution proof cannot prove failure of intervening product inputs. For that case only, a normal full certification records one `OBSERVE` reservation and an `OBSERVED` receipt. The historical state, failure signature, UNKNOWN classification, deadlines, spent diagnosis/dispatch and repair count remain intact. No repair, recovery reservation or extra recovery budget is granted. New labels, bookkeeping, policy edits or model/session changes do not authorize this observation. Failure, interruption or invalid evidence cannot retry it. The immutable `legacy-current-v1` check/command/inventory contract validates historical observations independently of later scoped-plan edits. Only a validated complete current certification PASS removes the historical import from current execution admission; it does not repair or close the historical incident. Attested failures retain the existing recovery barriers.

Continuation performs provenance recovery automatically, requires its publication, then returns `CERTIFY_CURRENT` where eligible. A stop with either routine action is refused. The old stop remains an append-only historical record; its requested incident reset/allowlist expansion is not current authorization.

The rejected `babf42c` patch is unchanged. It adds cooperative runner execution plus existing test hook/body changes, beyond the narrowly authorized spawn transport envelope. Local logs support later worker/startup symptoms, but cannot supply the missing source-bound legacy failure proof. The machinery allowlist and assurance checks remain unchanged.

No application/gameplay code, framework, timeout, retry, worker count or recovery budget is changed.
