/**
 * @module tests/unit/eval/foul-detection-machinery-binding.test.ts
 *
 * Evidence-binding test for FOUL-DETECTION-MACHINERY.
 *
 * Pins the engine-grounded foul definition of FOULS_CARDS_SPEC §5.1 to the
 * observation-level detection machinery:
 *
 *  1. A man-not-ball tackle contact (`player-player-contact` with
 *     `contactType` ∈ {`standing-tackle`, `slide-tackle`},
 *     `tacklePhase === "active"`, `duelWon === false`) is recognized as a
 *     `foul` event carrying exactly the spec §4.2 / §5.1 fields.
 *  2. A clean tackle (`duelWon === true`) and a symmetric shoulder-to-shoulder
 *     contact (`contactType === "player-player"`) are NOT fouls.
 *  3. The runner gate `detectFouls` (default false) injects the `foul` events
 *     post-loop, and `detectFouls:false` is byte-identical to the pre-change
 *     baseline (state-hash chain identical to the gated run AND to the accepted
 *     baseline), with 0 injected `foul` events.
 *  4. Cards / advantage / free-kicks stay spec-only: no card, advantage or
 *     free-kick event is emitted, and no suite verdict is reported for the
 *     named-but-unregistered criteria (FOUL-DETECT / FOUL-CLEAN-TACKLE).
 *
 * Node I/O is allowed for scenario loading.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  detectFoulEvents,
  countFoulEvents,
  FOUL_CONTACT_TYPES,
} from "../../../eval/runners/foul-detection.js";
import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { makeTelemetryObservation } from "../contracts.fixture.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Build a synthetic observation with a single `player-player-contact` event. */
function observationWithContact(contact: Record<string, unknown>): TelemetryObservation {
  const obs = makeTelemetryObservation();
  obs.tick = 10;
  obs.events = [
    {
      id: "ppc-10-1",
      tick: 10,
      sequence: 1,
      kind: "player-player-contact",
      label: "tackle duel",
      payload: contact,
    },
  ];
  return obs;
}

const STANDING_CONTACT = {
  playerIdA: "def-1",
  playerIdB: "carrier-1",
  teamIdA: "team-a",
  teamIdB: "team-b",
  contactType: "standing-tackle",
  tacklePhase: "active",
  attemptStartTick: 8,
  activeWindowStartTick: 10,
  activeWindowEndTick: 13,
  reach: 1.6,
  planarDistance: 0.4,
  committedDirection: { x: 1, y: 0 },
  ballReachable: false,
  duelWon: false,
};

// ---------------------------------------------------------------------------
// 1. Foul predicate (FOULS_CARDS_SPEC §5.1)
// ---------------------------------------------------------------------------

describe("foul detection predicate", () => {
  it("recognizes a standing-tackle man-not-ball contact as a foul", () => {
    const obs = observationWithContact(STANDING_CONTACT);
    const n = detectFoulEvents([obs]);
    expect(n).toBe(1);
    const foul = obs.events.find((e) => e.kind === "foul");
    expect(foul).toBeDefined();
    const p = foul!.payload as Record<string, unknown>;
    expect(p.contactType).toBe("standing-tackle");
    expect(p.tacklePhase).toBe("active");
    expect(p.duelWon).toBe(false);
    expect(p.ballReachable).toBe(false);
    expect(p.playerIdA).toBe("def-1");
    expect(p.playerIdB).toBe("carrier-1");
    expect(p.teamIdA).toBe("team-a");
    expect(p.teamIdB).toBe("team-b");
    expect(p.sourceEventId).toBe("ppc-10-1");
    expect(p.activeWindowStartTick).toBe(10);
    expect(p.activeWindowEndTick).toBe(13);
    expect(p.reach).toBe(1.6);
    expect(typeof p.planarDistance).toBe("number");
    expect(p.committedDirection).toEqual({ x: 1, y: 0 });
  });

  it("recognizes a slide-tackle man-not-ball contact as a foul", () => {
    const obs = observationWithContact({ ...STANDING_CONTACT, contactType: "slide-tackle" });
    const n = detectFoulEvents([obs]);
    expect(n).toBe(1);
  });

  it("does NOT recognize a clean tackle (duelWon true) as a foul", () => {
    const obs = observationWithContact({ ...STANDING_CONTACT, duelWon: true, ballReachable: true });
    const n = detectFoulEvents([obs]);
    expect(n).toBe(0);
    expect(countFoulEvents([obs])).toBe(0);
  });

  it("does NOT recognize a symmetric shoulder-to-shoulder contact as a foul", () => {
    const obs = observationWithContact({ ...STANDING_CONTACT, contactType: "player-player" });
    const n = detectFoulEvents([obs]);
    expect(n).toBe(0);
  });

  it("does NOT recognize a non-active tackle contact as a foul", () => {
    const obs = observationWithContact({ ...STANDING_CONTACT, tacklePhase: "recover" });
    const n = detectFoulEvents([obs]);
    expect(n).toBe(0);
  });

  it("does NOT recognize a non-tackle player-player-contact as a foul", () => {
    const obs = observationWithContact({ ...STANDING_CONTACT, contactType: "player-player", tacklePhase: "active", duelWon: false });
    const n = detectFoulEvents([obs]);
    expect(n).toBe(0);
  });

  it("exposes the spec contact kinds as a closed set", () => {
    expect(FOUL_CONTACT_TYPES.has("standing-tackle")).toBe(true);
    expect(FOUL_CONTACT_TYPES.has("slide-tackle")).toBe(true);
    expect(FOUL_CONTACT_TYPES.has("player-player")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Runner gate `detectFouls` (post-loop, hash-neutral) + stash identity
// ---------------------------------------------------------------------------

const ORGANIC_SCENARIO = "eval/scenarios/3v3-press-scenario.v1.json";
const ORGANIC_TICKS = 600;
// Pre-change baseline (unmodified runner, identical scenario/config): the
// stash control must reproduce this hash-of-hashes byte-for-byte.
const BASELINE_HASH_OF_HASHES =
  "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a";

function loadScenario(path: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(
    readFileSync(join(__dirname, "../../../", path), "utf-8"),
  ) as ScenarioDefinition;
}

function runOrganic(detectFouls: boolean) {
  return runHeadlessMatch({
    scenario: loadScenario(ORGANIC_SCENARIO),
    maxTicks: ORGANIC_TICKS,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "legacy",
    cpuDefensiveTackle: true,
    detectFouls,
  });
}

describe("runner gate detectFouls", () => {
  let on: ReturnType<typeof runOrganic>;
  let off: ReturnType<typeof runOrganic>;

  beforeAll(() => {
    on = runOrganic(true);
    off = runOrganic(false);
  }, 240_000);

  it("detectFouls:true injects the organic foul events; detectFouls:false injects 0", () => {
    expect(countFoulEvents(on.observations)).toBeGreaterThanOrEqual(1);
    expect(countFoulEvents(off.observations)).toBe(0);
    // Same committed contacts in both streams (the injected events are additive).
    const kinds = (obs: TelemetryObservation[]) => {
      const c: Record<string, number> = {};
      for (const o of obs) for (const ev of o.events) c[ev.kind] = (c[ev.kind] ?? 0) + 1;
      return c;
    };
    const onKinds = kinds(on.observations);
    const offKinds = kinds(off.observations);
    expect(onKinds["player-player-contact"]).toBe(offKinds["player-player-contact"]);
  });

  it("detectFouls:false is byte-identical to the pre-change baseline", () => {
    const hashOfHashes = sha256(JSON.stringify(off.stateHashes));
    expect(hashOfHashes).toBe(BASELINE_HASH_OF_HASHES);
  });

  it("the gated and ungated runs share an identical state-hash chain", () => {
    expect(sha256(JSON.stringify(on.stateHashes))).toBe(sha256(JSON.stringify(off.stateHashes)));
  });

  it("the emitted organic foul event matches the spec fields", () => {
    const foul = on.observations
      .flatMap((o) => o.events)
      .find((e) => e.kind === "foul");
    expect(foul).toBeDefined();
    const p = foul!.payload as Record<string, unknown>;
    expect(p.contactType === "standing-tackle" || p.contactType === "slide-tackle").toBe(true);
    expect(p.tacklePhase).toBe("active");
    expect(p.duelWon).toBe(false);
    expect(p.ballReachable).toBe(false);
    expect(typeof p.sourceEventId).toBe("string");
  });

  it("emits no card, advantage or free-kick event (spec-only)", () => {
    for (const o of on.observations) {
      for (const ev of o.events) {
        expect(["card", "advantage", "free-kick"]).not.toContain(ev.kind);
      }
    }
  });
});
