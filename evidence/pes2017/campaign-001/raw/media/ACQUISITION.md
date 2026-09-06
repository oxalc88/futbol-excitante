# Media acquisition (2026-09-06) — Gauntlet Observer box

## Status
Downloaded three PES 2017 YouTube gameplays that previously timed out for Astra.
Files are on disk under this folder. **This is secondary YouTube media, not a player’s DIRECT_CAPTURE from PES.**

| Role | YouTube id | File | SHA-256 | Duration | Size | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| training | C4-W1u8w-yE | `C4-W1u8w-yE.mp4` | `7c2d52bf91bd89315f352bf641c8f065c957c7bdb2d2e7166dfbc0eb8204f1fb` | 57.6 s | 9.4 MB | Tajae Lawrence; 1280×720 ~29.97 fps |
| match-development | 8afTHuMZxbI | `8afTHuMZxbI.mp4` | `510ca9f1d74454fc71a4b94c2e8de435d3f0d65b651b3d2fc0c37b647f56c081` | 1333.0 s | 508 MB | Throneful Arsenal vs Barcelona PC; 1280×720 60 fps |
| match-held-out | LFvEnk0mcLI | `LFvEnk0mcLI.mp4` | `7af3f258ceed67a9ae8499c6d02c30e90afad714547bd257ce8a6eb47c445024` | 693.5 s | 287 MB | LioN KoLLA PC 60FPS; **replaces** WeirdFifa `7daF_qg6B8s` (IGN/Gamescom reuse) |

URIs:
- https://www.youtube.com/watch?v=C4-W1u8w-yE
- https://www.youtube.com/watch?v=8afTHuMZxbI
- https://www.youtube.com/watch?v=LFvEnk0mcLI

## What this unblocks
- Local decode, PTS audit, camera/pitch review, annotation, tracking.
- Training file already ran `scripts/audit-reference-video.py` → `raw/audit-C4-W1u8w-yE/` status `PENDING_CONTENT_AND_CAMERA_REVIEW`.

## What this does NOT unblock by itself
- `reference:import` requires `provenance: DIRECT_CAPTURE` and non-empty accredited `platform/build/mode/difficulty/gameSpeed/controller/camera`.
- YouTube re-encodes must **not** be labeled `DIRECT_CAPTURE`.
- Do not invent stick/power/settings from the footage.
- No ReferenceTarget JSON or measurements were fabricated here.

## Next for Astra / measurement
1. Audit the two long matches with `scripts/audit-reference-video.py` (long runtime).
2. Content/camera review; assign planned-clips PTS only after observation.
3. Measure A/B envelopes; leave unknown settings as null in primary records.
4. For importable class A/B targets, either extend the contract for documented public secondary media **or** obtain true local PES captures with accredited settings.

Operator: gauntlet-observer-box. Tool: yt-dlp 2026.08.19, 720p merge, no cookies.
