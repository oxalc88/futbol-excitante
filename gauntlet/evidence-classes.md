# Evidence classes

The orchestrator classifies each objective from its acceptance criteria before review. Use the strictest applicable class.

| Class | Required deterministic evidence |
|---|---|
| `HEADLESS` | executed tests |
| `BROWSER_VISIBLE` | executed tests + objective screenshot |
| `MULTI_TICK` | executed tests + relevant integration test + structured trajectory |
| `DYNAMIC_VISUAL` | executed tests + relevant integration test + structured trajectory + objective screenshot |
| `PRESENTATION` | executed tests + objective screenshot; duplicate bytes require semantic review |
| `BOOKKEEPING` | deterministic state/tooling audit; no perceptual artifact by default |

If acceptance explicitly depends on slot/player ownership or routing, add the slot-wiring invariant check regardless of class.

A duplicate screenshot SHA is a fact, not automatically a failure. It yields `REVIEW_REQUIRED`; the cheap semantic audit decides only whether reuse can prove the named criterion. The mandatory critic still judges quality afterward.
