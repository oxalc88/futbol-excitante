#!/bin/bash
cd /home/ubuntu/projects/oxDeveloop/pes-simulator
CI=1 pnpm run test 2>&1 | grep -E "(FAIL|Tests|test suites|✓|✗)" | tail -20
echo "---"
CI=1 pnpm run test 2>&1 | tail -10
