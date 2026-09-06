"""Download campaign-001 PES 2017 YouTube MP4s into this directory and verify SHA-256.

MP4s are gitignored. From repo root:

  python3 evidence/pes2017/campaign-001/raw/media/fetch_media.py

Requires: yt-dlp on PATH, ffmpeg for merges.
"""
from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Locked 2026-09-06: yt-dlp 2026.08.19, 720p merge, no cookies.
SOURCES = [
    ("C4-W1u8w-yE", "7c2d52bf91bd89315f352bf641c8f065c957c7bdb2d2e7166dfbc0eb8204f1fb"),
    ("8afTHuMZxbI", "510ca9f1d74454fc71a4b94c2e8de435d3f0d65b651b3d2fc0c37b647f56c081"),
    ("LFvEnk0mcLI", "7af3f258ceed67a9ae8499c6d02c30e90afad714547bd257ce8a6eb47c445024"),
]

YTDLP_FORMAT = "bv*[height<=720]+ba/b[height<=720]/best"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    if shutil.which("yt-dlp") is None:
        print(
            "yt-dlp is required: https://github.com/yt-dlp/yt-dlp#installation",
            file=sys.stderr,
        )
        return 1
    ROOT.mkdir(parents=True, exist_ok=True)
    for video_id, expected in SOURCES:
        out = ROOT / f"{video_id}.mp4"
        print(f"==> {video_id}")
        if out.is_file() and sha256_file(out) == expected:
            print("    already present, SHA-256 OK")
            continue
        if out.is_file():
            print("    present but hash mismatch; re-downloading")
            out.unlink()
        cmd = [
            "yt-dlp",
            "--no-playlist",
            "--retries",
            "30",
            "--fragment-retries",
            "30",
            "--retry-sleep",
            "linear=1::5",
            "--socket-timeout",
            "300",
            "--concurrent-fragments",
            "1",
            "--downloader-args",
            "http:-timeout 300",
            "-f",
            YTDLP_FORMAT,
            "--merge-output-format",
            "mp4",
            "-o",
            str(ROOT / f"{video_id}.%(ext)s"),
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        subprocess.run(cmd, check=True)
        got = sha256_file(out)
        if got != expected:
            print(f"FAIL {video_id}: expected {expected}, got {got}", file=sys.stderr)
            print(
                "YouTube/format drift is possible; update INDEX.csv + ACQUISITION.md "
                "with the new hash and yt-dlp version rather than inventing measurements.",
                file=sys.stderr,
            )
            return 2
        print(f"    SHA-256 OK ({got})")
    print(f"\nAll three MP4s are in: {ROOT}")
    print(
        "Next: python scripts/audit-reference-video.py "
        "<file.mp4> --out evidence/pes2017/campaign-001/raw/audit-<id> "
        "--source-id <id> --uri 'https://www.youtube.com/watch?v=<id>' "
        "--operator '<your-name>'"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
