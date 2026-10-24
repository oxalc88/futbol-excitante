# PES 2017 — campaign 001

**The transfer received in `d8547e0` works.** The full training MP4 is available and its SHA-256, 1,725 decoded RGB hashes and PTS all match. Both match sources have complete supplied frame timelines and 181 sparse JPEGs each. Their full MP4s remain on the acquisition machine.

Current result: **two camera/annotation pilots, one provisional displacement observation, zero accepted gameplay targets and zero imported references**. The first camera model drifts. A later endpoint pilot now quantifies sensitivity, but its uncertainty exceeds the estimated displacement and is not a validated total-error bound. Secondary provenance and unknown game settings also prevent export under the unchanged `DIRECT_CAPTURE` contract. The 54-event campaign is not complete.

Latest continuation: [endpoint pilot](raw/pilot-002/README.md) and [reproducible observation](raw/pilot-002/results/observation.json). The provisional displacement remains withheld; it does not fill a campaign slot.

## Current evidence

- [Transfer review and source decisions](source-audits/TRANSFER-REVIEW.md): timing, content limits, actual first clip set, camera QC and remaining work.
- [Machine verification](source-audits/transfer-review/verification.json): source/timeline/JPEG hashes and 123,311 supplied timeline rows checked.
- [Transfer package](transfer/README.md): full training video, frame audits and visual strips.
- [Located review windows](located-review-windows.csv): five initial training windows, two match windows and two training backups, all with real PTS. These are not accepted events.
- [Raw pilot annotations](raw/pilot-001/annotations.json): 14 calibration clicks in two passes, 11 held-out checks and three player support observations.
- [Pilot diagnostics](raw/pilot-001/results/diagnostics.json): candidate camera/world reconstruction withheld after QC; raw feature matches and QC images are alongside it.
- [Evidence register](raw/annotations.json), [source register](source-audits/sources.json), [54 planning slots](planned-clips.csv).
- [Import log](logs/reference-import.json): zero invocations, successes or rejects because no target is eligible.
- [Evaluation by ID](evaluation-status.md): unchanged, with 42 missing-reference criteria and 18 perceptual-review criteria. These counts overlap by ID.

## Next measurement work

Refit the moving camera against pitch markings, bound reconstruction and support-point uncertainty, and review dense frame cadence before estimating locomotion. Acquire dense original-cadence match excerpts through the producer's machine export for pass/contact and turn annotation. The sparse JPEGs locate promising footage but do not contain the missing intermediate pixels. No manual delivery from the user is assumed.

Only measured, compatible A/B targets may proceed to `npm run reference:import -- <file.json>`. See [contract notes](contract-notes.md): public inputs remain unknown, configuration stays null unless evidenced, and secondary delivery must not be labelled `DIRECT_CAPTURE`. No reference or scenario ID is assigned merely to change evaluation coverage.

## Previous acquisition attempts

Earlier failures are retained as history: [initial acquisition review](raw/media/ACQUISITION-REVIEW.md), [downloader retry](raw/media/ACQUISITION-RUN-ea1c074.md), and [acquisition recipe](raw/media/ACQUISITION.md). Statements in those historical reports saying that no training video or annotations are local have been superseded by this transfer review.

## Scope

The motor, oracles, baseline, reference contract and evaluation behavior remain unchanged. Speed/Explosive Power curves, input→output transfer functions, class-C `LOC-ACC-002`, a single feel score, online and publishing remain out of scope.
