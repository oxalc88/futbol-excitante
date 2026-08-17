# Evidence classes

The orchestrator classifies each objective from its acceptance criteria before review. Use the strictest applicable class.

| Class | Required deterministic evidence |
|---|---|
| `HEADLESS` | executed tests |
| `BROWSER_VISIBLE` | executed tests + objective screenshot |
| `MULTI_TICK` | executed tests + relevant integration test + structured trajectory |
| `DYNAMIC_VISUAL` | executed tests + relevant integration test + structured trajectory + 3–5 semantic frames + `sequence.json` |
| `PRESENTATION` | executed tests + objective screenshot; duplicate bytes require semantic review |
| `BOOKKEEPING` | deterministic state/tooling audit; no perceptual artifact by default |

If an acceptance criterion is both **temporal** and **browser-visible**, `DYNAMIC_VISUAL` is mandatory. `MULTI_TICK` is sufficient only when state/trajectory demonstrates the temporal claim without a required visual judgment.

When a `DYNAMIC_VISUAL` claim depends on a named gameplay event or transition, the semantic sequence must be event-centered. Capture meaningful state around the event and consequence (`before → event → transition → result`, or an objective-appropriate equivalent), not merely frames selected because N ticks elapsed.

Not every dynamic visual objective is event-driven. Camera sweeps or other continuous presentation claims may use an objective-appropriate semantic order, but the labels and capture points still have to demonstrate the named criterion.

If acceptance explicitly depends on slot/player ownership or routing, add the slot-wiring invariant check regardless of class.

A duplicate screenshot SHA is a fact, not automatically a failure. It yields `REVIEW_REQUIRED`; the cheap semantic audit decides only whether reuse can prove the named criterion. The mandatory critic still judges quality afterward.
