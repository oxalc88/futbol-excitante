# Objective evidence manifest contract

Gauntlet 0.8.0 adds one durable evidence manifest for every newly accepted objective. The manifest is the compact, machine-readable index of what proved the objective; `HISTORY.md` remains narrative history, not the only reconstruction source.

## Location and immutability

`docs/evidence/<objective-id>/manifest.json`

- Created only when an objective reaches the final acceptance transition.
- Existing manifests are never silently overwritten. A different candidate for the same objective must fail persistence and be investigated.
- Pre-0.8 evidence is historical and is not backfilled, rewritten, renamed, or replaced automatically.
- Old screenshots or imperfect evidence remain intact so progress can be reconstructed as problem → detection → system improvement → later evidence.

## Required manifest fields

```json
{
  "schema_version": 1,
  "gauntlet_version": "0.8.0",
  "objective_id": "OBJECTIVE-ID",
  "accepted_at": "ISO-8601",
  "candidate_commit": "git commit sha",
  "evidence_class": "DYNAMIC_VISUAL",
  "evidence": {
    "screenshots": [],
    "semantic_sequence": null,
    "trajectory": null,
    "video": null,
    "metrics": []
  },
  "reviews": {
    "deterministic_audit": {},
    "semantic_audit": null,
    "critic": {},
    "integration": {}
  },
  "acceptance_record": "gauntlet/evals/results/...-acceptance.json"
}
```

Every local evidence artifact entry records at least `path`, `sha256`, and `candidate_commit`. This provides artifact ↔ code provenance.

## Semantic visual sequences

Dynamic visual behavior must use 3–5 semantic frames instead of relying on one screenshot. Examples include formation recovery, passing, goal sequences, first touch, transitions, tackles, and other temporal behavior.

The sequence metadata lives at `docs/screenshots/<objective-id>/sequence.json` and contains ordered frames with semantic labels and simulation ticks where known, for example:

```json
{
  "schema_version": 1,
  "objective_id": "CPU-TEAM-FORMATION",
  "frames": [
    { "label": "before", "path": "frame-000.png", "tick": 30 },
    { "label": "event", "path": "frame-001.png", "tick": 60 },
    { "label": "transition", "path": "frame-002.png", "tick": 90 },
    { "label": "result", "path": "frame-003.png", "tick": 120 }
  ]
}
```

Static `BROWSER_VISIBLE` and `PRESENTATION` objectives may continue to use a single screenshot.

## Audit/review provenance

The accepted manifest snapshots the final deterministic audit result plus semantic audit (when invoked), critic verdict, and integration verdict. This is intentionally structured outcome metadata, not chain-of-thought.

`gauntlet:audit` also writes the latest deterministic result to `docs/evidence/<objective-id>/audit.json`; the accepted manifest is the immutable final index.

## Video metadata

Video remains optional and may be external or ephemeral. When a video exists, `docs/evidence/<objective-id>/video-reference.json` must record:

- `objective_id`
- `artifact_id`
- `artifact_name`
- `provider`
- `created_at`
- `expires_at` (or `null` only when the provider states it does not expire)
- `candidate_commit`

The manifest includes the metadata-file SHA. Binary video does not need to be committed.

## Milestone evidence bundles

Important milestones such as playable 2v2, 5v5, and 11v11 may generate a summary bundle under:

`docs/evidence/milestones/<milestone-id>/`

The bundle contains `manifest.json` and references/copies only already-existing accepted evidence: primary screenshot, semantic sequence, trajectory, metrics, and video reference where available. Creating a milestone bundle must never mutate the source objective evidence.
