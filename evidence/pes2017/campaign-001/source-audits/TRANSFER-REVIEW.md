# Transfer review — 2026-09-06

Input commit: `d8547e08babbac34e26df63b26a3a7a89acf0e91`.

**Continuation on 2026-09-07:** [a second endpoint pilot](../raw/pilot-002/README.md) now has a provisional displacement and measured sensitivity modes. Its uncertainty is larger than its estimate, so it remains withheld. This does not change source admission, campaign coverage or import counts. The original transfer review below is retained.

**The transfer works.** The previous CDN timeout no longer prevents training-video inspection. There is now one complete local MP4, three complete supplied PTS timelines, and 420 JPEG aids. This supersedes earlier reports saying no video or annotations are available.

## Source decisions

| Source / role | Received and checked | Decision and limits |
| --- | --- | --- |
| `C4-W1u8w-yE`, training | 9,760,410-byte MP4; all 1,725 PTS and decoded RGB24 hashes reproduced exactly; 58 JPEG aids | Available for annotation and calibration pilots. No benchmark admission yet: camera error and content-cadence review remain incomplete; configuration/provenance also block export. |
| `8afTHuMZxbI`, development | 79,978-row PTS timeline, monotonic; 181 JPEGs with valid manifest joins | Visual reconnaissance only. Full MP4 hash remains producer-reported; dense gameplay pixels cannot be reconstructed from hashes. |
| `LFvEnk0mcLI`, held-out | 41,608-row PTS timeline, monotonic; 181 JPEGs with valid manifest joins | Visual reconnaissance only. Argentina/United States is visibly a different sequence from Arsenal/Barcelona. Exact build/configuration and original capture chain remain unverified. |
| `7daF_qg6B8s`, previous held-out candidate | Prior provenance review retained | Still excluded from the initial set because it republishes IGN/Gamescom footage without an established original capture/build. |

There are **zero admitted benchmark references**, one accessible source for a calibration pilot, and two sources restricted to sparse-image review. A camera model withheld after QC is not a rejected source or an importer rejection.

The training SHA-256 is `7c2d52bf91bd89315f352bf641c8f065c957c7bdb2d2e7166dfbc0eb8204f1fb`. Other source hashes and all JPEG artifact hashes are in [verification.json](transfer-review/verification.json). JPEG hashes identify JPEG files; they never substitute for source-video or decoded RGB hashes.

## Timing and visual review

The training timeline has timebase `1/30000`, PTS `0…1725724`, and 1,724 intervals of 1,001 ticks. This verifies the delivered container clock. Its 100 exact repeated images occur around black/reset transitions. Thirty-six successive original frames, indices 207–242, were inspected for player/ball/camera motion; none is an exact repeated RGB image. Similar limb poses and moving camera content are insufficient to assert a uniform unique-content rate. Original capture FPS and a verified whole-video content rate remain unknown.

Both match timelines use `1/15360` and increments of 256 ticks. Supplied audits record 1,610 and 752 exact repeats respectively. These are audit observations supplied by the producer, not local redecodes of the missing full matches. Half-second JPEGs cannot reveal intermediate contacts, interpolation, repeated-content runs or frame-accurate cut boundaries.

The training JPEG comparison against neighbouring exact decoded images is retained in [training-jpeg-alignment.json](transfer-review/training-jpeg-alignment.json). The declared frame has the lowest image MSE in 47 of 58 cases; the other cases include equal black images, fades and slowly changing overlays. A nearest-image comparison is not proof of exact JPEG alignment. **The pilot uses locally decoded, hash-verified original frames**, so none of these ambiguities changes its PTS.

The match strips contain long pre-match cinematics. The development image at 69.017 s is still a close-up; gameplay is visible at 70.017 s. Held-out gameplay is visible at 53.017 s. A visible main camera in sampled images does not prove uninterrupted footage between them.

## Minimum first clip set, before mass annotation

[located-review-windows.csv](../located-review-windows.csv) contains actual source PTS and frame indices for **five initial training windows, two match windows, and two backup training windows**. These are screening windows, not nine accepted events or filled campaign slots.

| Role | Initial review windows in delivered seconds |
| --- | --- |
| Training | 7.007–10.010; 12.513–15.516; 18.519–22.022; 25.025–29.530; 31.532–34.535 |
| Training backups | 37.538–41.542; 44.545–48.548 |
| Development match | 70.017–90.017, currently sparse images only |
| Held-out match | 53.017–90.017, currently sparse images only |

Seven training attempts separated by resets are visible. Running/dribbling and shots are visible, but neither the exercise title nor a reset establishes sprint input, a maximum-speed plateau, movement onset or a complete braking event. No training attempt is counted three times to satisfy the three locomotion quotas. The 54 planning slots remain unfilled until actual event criteria, reconstruction and uncertainty are established.

The smallest useful next machine export is dense, original-cadence imagery or independently audited clips covering the two match windows above, with context at their boundaries. Preserve source SHA, integer PTS/timebase and decoded-frame identity. Another sparse strip or more video metadata will not fill the missing intermediate pixels. This is a machine-to-machine continuation; no manual upload by the user is required or assumed. Those two short excerpts are a pilot and are not guaranteed to contain all 39 required turn/pass-chain events.

## Real annotation and camera pilot

[Raw annotations](../raw/pilot-001/annotations.json) contain:

- Two passes of seven visible pitch correspondences at PTS 270270. Both passes are by the same operator; they are not independent annotators.
- Eleven held-out landmark checks, including observations in three earlier camera positions and two goal-post ground points.
- Three visible ground-support observations of the blue player at PTS 210210, 225225 and 240240, with image regions marking support ambiguity.

The local template uses internal penalty/goal-area markings, with goal-line origin. It does not assume a 105×68 m pitch. Regulation marking dimensions are an explicit modelling assumption, not a surveyed fact about this PES build.

[The reproducible pilot](../../../../scripts/review-pes2017-camera-pilot.py) fits the keyframe and propagates 71 camera mappings through adjacent frames with retained feature matches. [Diagnostics](../raw/pilot-001/results/diagnostics.json) include all matrices, both annotation fits, held-out residuals and **unaccepted candidate world positions**. [The QC image](../raw/pilot-001/results/qc-n210.jpg) shows observed markings in green and predictions in red.

**QC outcome: withhold kinematics.** Held-out error reaches **17.723 image pixels**. Small feature-fit residuals do not bound pitch registration error at a player away from the fitted markings. The three earlier pitch checks are collinear and cannot independently constrain all two-dimensional extrapolation. A per-frame marking refit, stronger geometric checks and uncertainty propagation remain necessary. No arbitrary pixel sigma or enlarged target tolerance was assigned. Candidate world coordinates are not an admitted metric, and three observations of one player do not constitute three independent trials.

Consequently there is **no accepted distance, speed, acceleration, turn, pass or touch estimate yet**. The raw record is no longer empty, but the complete measurement pipeline has not passed its camera/uncertainty gate. This is deliberately recorded rather than converting a visibly drifting reconstruction into PES numbers.

## Import and evaluation

There are zero import-ready JSON files and [zero importer invocations, successes or rejects](../logs/reference-import.json). The camera pilot is evidence, not `reference-target-v1`.

Even after calibration, the unchanged contract has a separate blocker: [ACQUISITION.md](../raw/media/ACQUISITION.md) explicitly says secondary YouTube delivery, while `eval/reference.ts` requires `DIRECT_CAPTURE`. Required configuration is also partly unknown. Public evidence remains `input_known=false`; it is not relabelled as direct capture and unknown values remain null. Supporting secondary measured evidence in the importer would require a separately agreed contract change; it is not done in this campaign.

The existing evaluation report and [per-ID status list](../evaluation-status.md) are unchanged: 42 criteria remain `BLOCKED_MISSING_REFERENCE`, and 18 remain `NEEDS_PERCEPTUAL_REVIEW`. These counts can overlap by test ID. No new valid reference matches a scenario, and numerical camera work cannot complete perceptual review. The other catalog criteria are not automatically covered by the minimum campaign.

## Reproduction

Run the existing video auditor into a new directory, then validate the transfer:

```bash
python scripts/audit-reference-video.py evidence/pes2017/campaign-001/transfer/C4-W1u8w-yE/C4-W1u8w-yE.mp4 --out /tmp/pes-training-recheck --source-id C4-W1u8w-yE --uri 'https://www.youtube.com/watch?v=C4-W1u8w-yE' --operator local-review
python scripts/verify-pes2017-transfer.py --transfer evidence/pes2017/campaign-001/transfer --training-audit /tmp/pes-training-recheck --out /tmp/pes-transfer-recheck.json
python scripts/review-pes2017-camera-pilot.py --out /tmp/pes-camera-recheck
```

The camera script needs NumPy, OpenCV and FFmpeg. This run used OpenCV 5.0.0 and FFmpeg 6.1.1. Runtime versions are stored in the output. It verifies every decoded RGB hash before deriving camera diagnostics. Source files and reference IDs are never overwritten.

Out of scope remains Speed/Explosive Power curves, input→output transfer functions, class-C `LOC-ACC-002`, engine/oracle/baseline changes, a single feel score, online and publishing.
