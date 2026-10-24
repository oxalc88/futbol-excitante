# Execution of the new acquisition instructions

Instructions tested: commit `ea1c074a862bd4b222e9f7a27adbc3294ad88c74`.

**Result: zero usable PES video files. No new measurements or reference imports.** The new script was executed, followed by independent attempts for all three sources. Manual delivery by the user is not an available dependency.

## Executed attempts

| Attempt | Actual result |
| --- | --- |
| Unmodified `fetch_media.py`, yt-dlp 2026.08.19, prescribed 20 retries / 120-second socket timeout | Selected training streams `136+251`. Both downloads were 195-byte HTML pages saying `Site Unavailable`. FFmpeg rejected the inputs; script exit 1. It did not reach the other two sources. |
| Official default dependencies plus Node, format inspection | Certificate verification failed because this environment uses its system trust store. No video download occurred. |
| Same supported setup using system certificates (`--compat-options no-certifi`) | Certificate verification succeeded and format metadata was retrieved. Manifest download timed out. Format-list command exit 0 does **not** mean media acquisition succeeded. |
| Independent development-match download, system certificates and Node | Selected `298+251-17`; media requests timed out despite one retry per stream. Exit 1. |
| Independent held-out-match download, same setup | Selected `298+251`; media requests timed out despite one retry per stream. Exit 1. |
| Independent training download, same setup, 1 MiB HTTP chunks | Selected `136+251`; media requests timed out. Exit 1. |

The certificate adjustment uses the environment's trusted CA configuration; TLS verification remained enabled. The official setup documentation is [yt-dlp EJS](https://github.com/yt-dlp/yt-dlp/wiki/EJS). No authentication cookies, proxy substitutions or alternate execution hosts were used.

The failed HTML payload is preserved as `../../logs/fetch-ea1c074-site-unavailable.txt`. Its SHA-256 is `5b131ca14aa96311d3432b0062c7443d3b0e6346ec279bd376a75f0a76bcd5d7`. **This is a response-body hash, not a PES media hash.** Misnamed `.mp4` / `.webm` responses were removed from the media directory into temporary quarantine, without replacing any real capture.

The logs identify individual results and versions. They do not establish whether the remote failures are temporary or caused by an upstream access policy. They establish that no decodable video reached this environment.

## Existing artifact check

The Actions runs for the acquisition, review and downloader commits were inspected: `34043056490`, `34043553656`, `34043923615`. Their artifacts are `local-build` and `simulation-evidence`. The workflow uploads `dist` and `artifacts/`; it does not upload acquired PES media. No existing video artifact was found in those runs. The earlier Releases lookup was empty.

## State and automatic continuation

- Expected video hashes in `INDEX.csv` are unchanged and have not been verified against local media.
- The 54 planned slots remain unannotated. Reported acquisition on `gauntlet-observer-box` is retained; it is not treated as local file availability.
- No engine, oracle, baseline, reference schema or existing reference ID changed.
- Public secondary provenance still cannot be exported as `DIRECT_CAPTURE`. Class C, attribute curves and input transfer functions remain out of scope.

The acquisition machine must either make its **already downloaded files** available as retrievable evidence artifacts, or execute the measurement pipeline where those files exist. A producer-side transfer should publish a stable artifact locator, filenames, byte sizes and SHA-256 values; temporary private paths or another YouTube retry recipe do not transfer the evidence. Credentials or signed bearer URLs should not be committed.

This session can retrieve an accessible artifact and verify it automatically, but it has no callable connection to execute commands on `gauntlet-observer-box`. No transfer job, remote measurement job or background retry has been started. The user is not being asked to access this machine or manually handle the videos.
