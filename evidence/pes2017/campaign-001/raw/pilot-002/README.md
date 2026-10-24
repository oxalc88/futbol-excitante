# Endpoint displacement pilot — 2026-09-07

This continues the training-video analysis using a later window with more visible ground landmarks. It is a **research diagnostic, not an importable PES reference or a completed campaign event**.

The two original frames are PTS 270270 and 300300 at timebase 1/30000 (9.009–10.010 s). Their decoded RGB24 hashes are verified against the transferred full-frame audit. Both show the same blue player after the shot. The visible ground support is annotated; the player's centre of mass, stick state, sprint input, exact movement onset and intent remain unknown.

`annotations.json` retains two same-operator passes over six landmarks per endpoint: three penalty markings, two goalpost ground contacts and one goal-area corner. Three additional goal-area corners at each endpoint are held out. Each endpoint gets its own homography; this does not propagate the earlier drifting camera across the run. Support regions record visible foot-contact ambiguity. They are not invented Gaussian pixel sigmas.

`results/observation.json` contains the matrices, raw-label provenance, world-support points, 28 calibration variants, held-out residuals and the complete sensitivity point clouds. It records one fixed-window displacement with units from `METRIC_UNITS`, a method, two PTS-linked samples, observable=true and explicit uncertainty. **Two endpoints are one trajectory, not two independent gameplay trials.**

The nominal displacement is **2.252 m**. The tested annotation/calibration/residual modes produce **0.595–4.634 m**, or a symmetric maximum deviation of **2.382 m** around the nominal estimate. The envelope includes both annotation passes, leave-one-landmark-out fits, observed support-region corners and signed held-out discrepancy vectors. No engine values were read or used to choose the envelope.

**The uncertainty exceeds the estimate. This result is withheld from gameplay evaluation.** This is a discrete, conditional sensitivity envelope, not a confidence interval or a validated total-error bound. Transporting landmark residual vectors does not prove that true camera error is uniform across the pitch. Shadowed goal-area corners remain ambiguous; a held-out error reaches 14.774 pixels. The regulation internal-marking template is still a stated modelling assumption. No speed, acceleration, maximum-speed plateau or complete stopping event is inferred from this window.

The wider earlier refit experiments also showed why small arc-fitting residuals alone are inadequate: fitting the visible penalty arc while using only collinear penalty-line anchors moved unseen goal landmarks substantially. Adding one goal-area point improved local constraint but did not establish a sufficient independent geometric check. The recorded earlier pilot remains available without replacement.

No catalog test, evaluator scenario or minimum-campaign slot is assigned to this post-shot support displacement. Secondary provenance, unknown required settings and unvalidated total uncertainty independently prevent `reference-target-v1` export. Import-ready remains empty.

Reproduce from the repository root with NumPy, OpenCV and FFmpeg:

```bash
python scripts/measure-pes2017-endpoint-pilot.py --out /tmp/pes-endpoint-recheck
```

The destination must be new. The script verifies the original video SHA and both original decoded-frame hashes before estimating anything. It writes no references and changes no engine/evaluator files.
