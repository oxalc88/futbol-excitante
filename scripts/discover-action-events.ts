/**
 * Discovery script: run the press scenario and find discrete action event ticks.
 * Used to plan event-centered frame capture for SMALL-SIDED-ACTION-EVENT-OBSERVABILITY.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { scanMatchResult } from "../eval/runners/small-sided-match-situation-scanner.js";

const scenario = JSON.parse(
  readFileSync(resolve("eval/scenarios/3v3-press-scenario.v1.json"), "utf-8"),
);

// Run a 600-tick match for event discovery.
const result = runHeadlessMatch({ scenario, maxTicks: 600 });

const eventKinds: Record<string, number> = {};
for (const evt of result.events) {
  eventKinds[evt.kind] = (eventKinds[evt.kind] || 0) + 1;
}
console.log("Event kind counts:", JSON.stringify(eventKinds, null, 2));
console.log("Total events:", result.events.length);
console.log("Total observations:", result.observations.length);
console.log("Score:", JSON.stringify(result.score));

// Find discrete action events.
const actionKinds = ["pass", "shot", "goal", "player-ball-contact", "player-player-contact"];
const actionEvents = result.events.filter((e) => actionKinds.includes(e.kind));
console.log("\nAction events (first 30):");
for (const evt of actionEvents.slice(0, 30)) {
  console.log(`  tick=${evt.tick} kind=${evt.kind} label="${evt.label}"`);
}
console.log(`Total action events: ${actionEvents.length}`);

// Find the first pass, shot, and contact events.
const firstPass = result.events.find((e) => e.kind === "pass");
const firstShot = result.events.find((e) => e.kind === "shot");
const firstGoal = result.events.find((e) => e.kind === "goal");
const firstContact = result.events.find((e) => e.kind === "player-ball-contact");

console.log("\nFirst event of each kind:");
if (firstPass) console.log(`  pass: tick=${firstPass.tick}`);
if (firstShot) console.log(`  shot: tick=${firstShot.tick}`);
if (firstGoal) console.log(`  goal: tick=${firstGoal.tick}`);
if (firstContact) console.log(`  player-ball-contact: tick=${firstContact.tick}`);

const scan = scanMatchResult(result.events, result.observations);
console.log("\nSituation scan:", JSON.stringify(scan.summary, null, 2));
for (const loc of scan.localizations) {
  if (loc.totalRelevantEvents > 0) {
    console.log(`  ${loc.situation_id}: ${loc.presence} (${loc.totalRelevantEvents} events, kinds=[${loc.observedKinds}])`);
  }
}
