# Media acquisition — campaign-001 (PES 2017 YouTube secondary sources)

**MP4s are not in Git.** Every developer obtains them locally with `fetch_media.py` below. Paths on one agent machine are not shared evidence.

**Provenance:** secondary YouTube delivery, not player DIRECT_CAPTURE. Do not label imports as DIRECT_CAPTURE. Unknown settings stay null.

## Targets (locked for this campaign)

| Role | YouTube id | Local filename | Expected SHA-256 | Duration | Approx size | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| training | C4-W1u8w-yE | C4-W1u8w-yE.mp4 | 7c2d52bf91bd89315f352bf641c8f065c957c7bdb2d2e7166dfbc0eb8204f1fb | 57.6 s | ~9.4 MB | Tajae Lawrence; 1280x720 ~29.97 fps |
| match-development | 8afTHuMZxbI | 8afTHuMZxbI.mp4 | 510ca9f1d74454fc71a4b94c2e8de435d3f0d65b651b3d2fc0c37b647f56c081 | 1333.0 s | ~508 MB | Throneful Arsenal vs Barcelona PC; 1280x720 60 fps |
| match-held-out | LFvEnk0mcLI | LFvEnk0mcLI.mp4 | 7af3f258ceed67a9ae8499c6d02c30e90afad714547bd257ce8a6eb47c445024 | 693.5 s | ~287 MB | LioN KoLLA PC 60FPS; replaces WeirdFifa 7daF_qg6B8s |

Canonical table: INDEX.csv in this directory.

URLs:
- https://www.youtube.com/watch?v=C4-W1u8w-yE
- https://www.youtube.com/watch?v=8afTHuMZxbI
- https://www.youtube.com/watch?v=LFvEnk0mcLI

## How to get local evidence (any machine)

### Prerequisites

- yt-dlp on PATH (https://github.com/yt-dlp/yt-dlp#installation)
- ffmpeg / ffprobe for merges and later audit

### One command (preferred)

From the repository root:

```bash
python3 evidence/pes2017/campaign-001/raw/media/fetch_media.py
```

Writes the three MP4s into this directory with the locked 720p merge recipe, then verifies SHA-256 against INDEX.csv.

### Manual equivalent

```bash
cd evidence/pes2017/campaign-001/raw/media
FMT='bv*[height<=720]+ba/b[height<=720]/best'
yt-dlp --no-playlist --retries 20 --fragment-retries 20 --socket-timeout 120 --concurrent-fragments 4 -f "$FMT" --merge-output-format mp4 -o "C4-W1u8w-yE.%(ext)s" "https://www.youtube.com/watch?v=C4-W1u8w-yE"
yt-dlp --no-playlist --retries 20 --fragment-retries 20 --socket-timeout 120 --concurrent-fragments 4 -f "$FMT" --merge-output-format mp4 -o "8afTHuMZxbI.%(ext)s" "https://www.youtube.com/watch?v=8afTHuMZxbI"
yt-dlp --no-playlist --retries 20 --fragment-retries 20 --socket-timeout 120 --concurrent-fragments 4 -f "$FMT" --merge-output-format mp4 -o "LFvEnk0mcLI.%(ext)s" "https://www.youtube.com/watch?v=LFvEnk0mcLI"
sha256sum C4-W1u8w-yE.mp4 8afTHuMZxbI.mp4 LFvEnk0mcLI.mp4
```

### If SHA-256 does not match

YouTube formats drift. Do not invent measurements. Record yt-dlp version, format id, new hash; update INDEX.csv and this file in a new commit; re-run audits.

## After the MP4s exist locally

```bash
python scripts/audit-reference-video.py \
  evidence/pes2017/campaign-001/raw/media/C4-W1u8w-yE.mp4 \
  --out evidence/pes2017/campaign-001/raw/audit-C4-W1u8w-yE \
  --source-id C4-W1u8w-yE \
  --uri 'https://www.youtube.com/watch?v=C4-W1u8w-yE' \
  --operator 'YOUR_NAME'
```

Repeat for 8afTHuMZxbI and LFvEnk0mcLI. Other developers re-fetch with fetch_media.py; they do not need private agent paths.

## What this unblocks vs not

Unblocks: local decode, PTS audit, camera/pitch review, annotation, tracking, A/B envelopes.

Does not unblock alone: reference:import as DIRECT_CAPTURE with accredited platform/build/mode/difficulty/gameSpeed/controller/camera. Leave unknowns null.

## Git policy

- Committed: this file, INDEX.csv, fetch_media.py, small ffprobe summaries, download logs.
- Ignored: *.mp4 under this tree (see .gitignore).

Acquisition recipe locked 2026-09-06 with yt-dlp 2026.08.19, 720p merge, no cookies.
