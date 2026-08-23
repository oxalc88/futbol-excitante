/**
 * Quick test: verify that the extended situation fixture produces the
 * expected event kinds (pass, player-ball-contact, second-touch, shot).
 *
 * Run with: `tsx eval/test-extended-fixture.ts`
 */

import { evaluate } from "./runners/evaluate.js";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(
  readFileSync("eval/scenarios/3v3-situation-driven-extended.v1.json", "utf-8"),
);
const result = evaluate({ scenario: fixture });

const eventKinds = new Set(result.events.map((e) => e.kind));

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

console.log("=== EXTENDED FIXTURE EVENT ASSERTIONS ===\n");

// 1. Pass event exists
assert(
  eventKinds.has("pass"),
  "Pass event kind present",
);

// 2. Player-ball-contact event exists (first-touch)
assert(
  eventKinds.has("player-ball-contact"),
  "Player-ball-contact (first-touch) event kind present",
);

// 3. Second-touch event exists
assert(
  eventKinds.has("second-touch"),
  "Second-touch event kind present",
);

// 4. Shot event exists
assert(
  eventKinds.has("shot"),
  "Shot event kind present",
);

// 5. At least 5 unique event kinds total (pass, player-ball-contact, second-touch, shot, plus scheduler/player-player-contact)
assert(
  eventKinds.size >= 5,
  `At least 5 unique event kinds present (got ${eventKinds.size}: ${[...eventKinds].join(", ")})`,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}