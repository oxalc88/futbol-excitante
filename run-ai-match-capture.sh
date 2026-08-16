#!/bin/bash
set -e
cd /home/ubuntu/projects/oxDeveloop/pes-simulator

echo "=== Capturing AI-vs-AI screenshot ==="
export CI=1

# Run the capture test
pnpm vitest run tests/browser/ai-match-screenshot.browser.test.ts --project browser
CAPTURE_EXIT=$?
echo "---CAPTURE_EXIT:$CAPTURE_EXIT"

# Verify screenshot exists
ls -la docs/screenshots/BROWSER-MATCH-START-URL/
echo "---DONE---"
exit $CAPTURE_EXIT
