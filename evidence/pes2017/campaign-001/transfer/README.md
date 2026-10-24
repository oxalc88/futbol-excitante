# Transfer package — campaign-001

Codex/Astra could not pull googlevideo CDN bytes (read timeout). This folder is the **machine-side export** so measurement can continue without re-downloading full match MP4s.

## Contents

| Path | What it is |
| --- | --- |
| `C4-W1u8w-yE/C4-W1u8w-yE.mp4` | Full training source (9.4 MB), SHA-256 matches `INDEX.csv` |
| `C4-W1u8w-yE/frames.jsonl` | Full decode audit: every frame PTS + RGB24 hash (1725 rows) |
| `C4-W1u8w-yE/audit.json` | Training audit summary |
| `C4-W1u8w-yE/frames_1fps_jpg/` | ~1 JPEG/sec named by `pts_*` + `MANIFEST.json` (join key = `pts`) |
| `8afTHuMZxbI/frames.jsonl.gz` | Full match PTS timeline (gunzip → jsonl) |
| `8afTHuMZxbI/frames_sparse_jpg/` | First 90s @ 0.5s step JPEGs + `MANIFEST.json` |
| `LFvEnk0mcLI/...` | Same layout for held-out match |

Full match MP4s (508 MB / 287 MB) stay on the producer machine under `raw/media/` (gitignored). Re-fetch with `fetch_media.py` when CDN works; otherwise use this package.

## How to use (Codex)

1. Verify training: `sha256sum C4-W1u8w-yE/C4-W1u8w-yE.mp4` == `7c2d52bf91bd89315f352bf641c8f065c957c7bdb2d2e7166dfbc0eb8204f1fb`
2. Authoritative timing = `frames.jsonl` / `.gz` (`pts`, `time_base_*`). JPEGs are visual aids keyed by the same `pts`.
3. Still missing for speeds/turns/ball: player/ball tracks + pitch homography. Annotate from the training MP4 / sparse match strips; do not invent tracks.
4. Duplicates: use `exact_repeat_previous` / RGB hashes in jsonl — not JPEG sampling — to separate static menus from live play.

## Reproduce exports

Producer machine with local MP4s + completed `raw/audit-*/frames.jsonl` ran the export described in the parent campaign README commit message for this tree. JPEG extraction used ffmpeg `-ss <pts_time> -frames:v 1`.

## Not in this package

- Player/ball annotations (still empty by design until labeled)
- Pitch calibration solutions
- Class-C input logs
