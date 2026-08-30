/**
 * @module tests/unit/cpu-adapter/cpu-defensive-tackle.test.ts
 *
 * CPU defensive tackle decision — CPU-DEFENSIVE-TACKLE.
 *
 * Covers the team-decision authorisation (who may commit, and only when the
 * observed geometry and the action's own declared windows justify it) and the
 * adapter side (the tick-indexed press, its reaction latency, its self-imposed
 * commitment gap, and the fact that nothing happens at all until the slot's
 * controller actually has the tackle buttons).
 *
 * The commit is checked against the versioned action geometry rather than
 * hand-written numbers, so these tests cannot drift away from the tackle
 * system the CPU is asking to use.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCpuAdapter,
  getCpuTackleCommitActivations,
  resetMechanismCounters,
  type CpuObservation,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import {
  computeTeamDecision,
  evaluateCpuTackleCommit,
} from "../../../src/adapters/input-browser/team-decision-profile.js";
import {
  FOUNDATION_CPU_TACKLE_V1,
  FOUNDATION_TACKLE_V1,
} from "../../../src/simulation/config/foundation.js";
import {
  STANDING_TACKLE_BIT,
  SLIDE_TACKLE_BIT,
  FIRST_TOUCH_BIT,
} from "../../../src/contracts/input.js";
import type { InputFrame } from "../../../src/contracts/input.js";

const TACKLE_BITS = STANDING_TACKLE_BIT | SLIDE_TACKLE_BIT;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Geometry {
  /** Position of the CPU defender that the team nominates as presser. */
  defender: { x: number; y: number };
  defenderVelocity?: { x: number; y: number };
  defenderRole?: "defender" | "midfielder" | "attacker";
  /** The ball. Horizontal speed above the touch threshold keeps the CPU in its
   * defensive branch instead of gathering the ball. */
  ball: { x: number; y: number };
  ballVelocity?: { x: number; y: number };
  /** Opposing carrier. Null omits opponents entirely (loose ball). */
  carrier?: { x: number; y: number } | null;
  /** Extra same-team players, further from the ball than the presser. */
  teammates?: Array<{ id: string; x: number; y: number; role?: "defender" }>;
  defenderId?: string;
  carrierId?: string;
}

function makeObservation(geo: Geometry): CpuObservation {
  const defenderId = geo.defenderId ?? "d1";
  const carrierId = geo.carrierId ?? "o1";
  const dv = geo.defenderVelocity ?? { x: 0, y: 0 };
  const bv = geo.ballVelocity ?? { x: 0, y: 0 };
  const players: CpuObservation["players"] = [
    {
      playerId: defenderId,
      teamId: "team-a",
      groundPosition: { ...geo.defender },
      linearVelocity: { ...dv },
      bodyHeading: Math.atan2(dv.y, dv.x),
      formationRole: geo.defenderRole ?? "defender",
    },
  ];
  for (const tm of geo.teammates ?? []) {
    players.push({
      playerId: tm.id,
      teamId: "team-a",
      groundPosition: { x: tm.x, y: tm.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
      formationRole: tm.role ?? "defender",
    });
  }
  if (geo.carrier) {
    players.push({
      playerId: carrierId,
      teamId: "team-b",
      groundPosition: { ...geo.carrier },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: Math.PI,
      formationRole: "attacker",
    });
  }
  return {
    players,
    ball: {
      position: { x: geo.ball.x, y: geo.ball.y, z: 0.11 },
      linearVelocity: { x: bv.x, y: bv.y, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: "team-a",
    controlledPlayerId: defenderId,
  };
}

/** Evaluation of the shared team signal for one geometry. */
function evaluate(geo: Geometry) {
  const observation = makeObservation(geo);
  return evaluateCpuTackleCommit(observation, "team-a", basisFor(observation));
}

function basisFor(observation: CpuObservation) {
  const decision = computeTeamDecision(observation, "team-a");
  return {
    strategy: decision.strategy,
    nearestToBallPlayerId: decision.nearestToBallPlayerId,
    nearestToBallDistance: decision.nearestToBallDistance,
    hasPossession: decision.hasPossession,
    ballZone: decision.ballZone,
  };
}

/** A presser 0.9 m off a driven ball whose owner is on the far side of it. */
function standingGeometry(): Geometry {
  return {
    defender: { x: -30, y: 0 },
    defenderVelocity: { x: 6, y: 0 },
    ball: { x: -29.1, y: 0 },
    ballVelocity: { x: 5, y: 0 },
    carrier: { x: -28.8, y: 0.4 },
  };
}

beforeEach(() => {
  resetMechanismCounters();
});

// ---------------------------------------------------------------------------
// 1. Authorisation is earned, not assumed
// ---------------------------------------------------------------------------

describe("CPU-DEFENSIVE-TACKLE: commit justification", () => {
  it("authorises a standing tackle against a contested carrier in reach", () => {
    const { commit, withheld } = evaluate(standingGeometry());
    expect(withheld).toBe("COMMITTED");
    expect(commit?.kind).toBe("standing");
    expect(commit?.playerId).toBe("d1");
    // The reach the commit claims is the action system's own number.
    expect(commit?.reach).toBe(FOUNDATION_TACKLE_V1.standingReach.value);
    expect(commit!.predictedDistance).toBeLessThanOrEqual(
      FOUNDATION_TACKLE_V1.standingReach.value -
        FOUNDATION_CPU_TACKLE_V1.commitMargin.value,
    );
  });

  it("withholds when the target is beyond every declared reach", () => {
    const { commit, withheld } = evaluate({
      ...standingGeometry(),
      ball: { x: -20, y: 0 },
      carrier: { x: -19.7, y: 0.3 },
    });
    expect(commit).toBeNull();
    expect(withheld).toBe("OUT_OF_REACH");
  });

  it("withholds on a loose ball with no opposing carrier to contest", () => {
    const { commit, withheld } = evaluate({
      ...standingGeometry(),
      carrier: null,
    });
    expect(commit).toBeNull();
    expect(withheld).toBe("NO_CONTEST");
  });

  it("withholds when the carrier is not the player nearest the ball", () => {
    // Our own presser is the closest body: challenging would only knock the
    // ball away from the team, so no commit is authorised.
    const { commit, withheld } = evaluate({
      ...standingGeometry(),
      carrier: { x: -26, y: 0.4 },
    });
    expect(commit).toBeNull();
    expect(withheld).toBe("NO_CONTEST");
  });

  it("withholds when the defender is travelling away from the target", () => {
    const { commit, withheld } = evaluate({
      ...standingGeometry(),
      defenderVelocity: { x: -6, y: 0 },
    });
    expect(commit).toBeNull();
    expect(withheld).toBe("MISALIGNED");
  });

  it("withholds while the team is the one attacking with the ball", () => {
    // Ball at the defender's feet and slow: the profile reads that as our own
    // possession, so a defensive commit is not on the table.
    const { commit, withheld } = evaluate({
      ...standingGeometry(),
      ball: { x: -29.5, y: 0 },
      ballVelocity: { x: 0.2, y: 0 },
      carrier: { x: -28.9, y: 0.2 },
    });
    expect(commit).toBeNull();
    expect(withheld).toBe("NOT_DEFENDING");
  });

  it("does not let an attacker be the tackler", () => {
    const { commit, withheld } = evaluate({
      ...standingGeometry(),
      defenderRole: "attacker",
    });
    expect(commit).toBeNull();
    expect(withheld).toBe("ROLE_EXCLUDED");
  });

  it("prefers the cheaper standing commitment when both actions reach", () => {
    // Deep in the own third with the target barely opening a gap: the slide is
    // allowed by the risk gate, but standing must win while it also reaches.
    const { commit } = evaluate({
      defender: { x: -30.4, y: 0 },
      defenderVelocity: { x: 6, y: 0 },
      ball: { x: -29.4, y: 0 },
      ballVelocity: { x: 6.5, y: 0 },
      carrier: { x: -29.2, y: 0.3 },
    });
    expect(commit?.kind).toBe("standing");
  });

  it("authorises a slide only as a last resort, for an escaping target", () => {
    const escaping = evaluate({
      defender: { x: -33, y: 0 },
      defenderVelocity: { x: 6, y: 0 },
      ball: { x: -31.2, y: 0 },
      ballVelocity: { x: 6.6, y: 0 },
      carrier: { x: -31.5, y: 0.5 },
    });
    expect(escaping.commit?.kind).toBe("slide");
    expect(escaping.commit!.reach).toBe(FOUNDATION_TACKLE_V1.slideReach.value);
    expect(escaping.commit!.contactHorizonTicks).toBe(
      FOUNDATION_TACKLE_V1.slidePrepareTicks.value +
        FOUNDATION_TACKLE_V1.slideActiveTicks.value -
        1,
    );

    // Same geometry with the ball outside the team's own third: the long
    // recovery is not worth the risk, so nothing is authorised.
    const elsewhere = evaluate({
      defender: { x: 17, y: 0 },
      defenderVelocity: { x: 6, y: 0 },
      ball: { x: 18.8, y: 0 },
      ballVelocity: { x: 6.6, y: 0 },
      carrier: { x: 18.5, y: 0.5 },
    });
    expect(elsewhere.commit).toBeNull();

    // Same own-third geometry with the target not escaping: running on and
    // standing-tackling later is the justified choice, so no slide.
    const notEscaping = evaluate({
      defender: { x: -33, y: 0 },
      defenderVelocity: { x: 6, y: 0 },
      ball: { x: -31.2, y: 0 },
      ballVelocity: { x: 5, y: 0 },
      carrier: { x: -31.5, y: 0.5 },
    });
    expect(notEscaping.commit).toBeNull();
  });

  it("names at most one tackler per team per tick", () => {
    const observation = makeObservation({
      ...standingGeometry(),
      teammates: [
        { id: "d2", x: -20, y: 2 },
        { id: "d3", x: -20, y: -2 },
      ],
    });
    const decision = computeTeamDecision(observation, "team-a");
    expect(decision.tackleCommit?.playerId).toBe("d1");
    // The commit is the designated presser, never a second name.
    expect(decision.tackleCommit?.playerId).toBe(decision.nearestToBallPlayerId);
  });

  it("is a pure function of the observation it is given", () => {
    const observation = makeObservation(standingGeometry());
    const basis = basisFor(observation);
    const first = evaluateCpuTackleCommit(observation, "team-a", basis);
    const second = evaluateCpuTackleCommit(observation, "team-a", basis);
    expect(second).toEqual(first);

    // Unobserved extras added to the world view change nothing: the decision
    // consumes observable geometry only, never privileged state.
    const polluted = {
      ...makeObservation(standingGeometry()),
      possessionOwner: "team-b",
      expectedOutcome: "turnover",
      tackleStates: new Map(),
    } as CpuObservation;
    const third = evaluateCpuTackleCommit(polluted, "team-a", basisFor(polluted));
    expect(third.commit).toEqual(first.commit);
  });
});

// ---------------------------------------------------------------------------
// 2. Adapter: the press only exists when the controller has the buttons
// ---------------------------------------------------------------------------

describe("CPU-DEFENSIVE-TACKLE: adapter press", () => {
  function sampleSeries(
    observation: CpuObservation,
    ticks: number,
    authority: boolean,
  ): InputFrame[] {
    const adapter = createCpuAdapter();
    const decision = computeTeamDecision(observation, "team-a");
    const frames: InputFrame[] = [];
    for (let tick = 0; tick < ticks; tick++) {
      const obs: CpuObservation = { ...observation, teamDecision: decision };
      if (authority) obs.cpuDefensiveTackle = true;
      frames.push(adapter.sample(tick, obs));
    }
    adapter.reset();
    return frames;
  }

  function tacklePressTicks(frames: InputFrame[]): number[] {
    return frames
      .filter((f) => (f.pressedButtons & TACKLE_BITS) !== 0)
      .map((f) => f.tick);
  }

  it("presses nothing when the slot has no defensive tackle buttons", () => {
    const frames = sampleSeries(makeObservation(standingGeometry()), 60, false);
    expect(tacklePressTicks(frames)).toEqual([]);
    expect(getCpuTackleCommitActivations()).toBe(0);
  });

  it("presses the standing tackle once the reaction latency has elapsed", () => {
    const frames = sampleSeries(makeObservation(standingGeometry()), 10, true);
    const presses = tacklePressTicks(frames);
    expect(presses).toEqual([FOUNDATION_CPU_TACKLE_V1.reactionTicks.value - 1]);

    const press = frames[presses[0]];
    expect(press.pressedButtons & STANDING_TACKLE_BIT).toBe(STANDING_TACKLE_BIT);
    expect(press.pressedButtons & SLIDE_TACKLE_BIT).toBe(0);
    // A single-tick tap: the bit is not held on the following ticks.
    expect(frames[presses[0] + 1].pressedButtons & TACKLE_BITS).toBe(0);
    expect(getCpuTackleCommitActivations()).toBe(1);
  });

  it("never re-presses inside its own commitment window", () => {
    const frames = sampleSeries(makeObservation(standingGeometry()), 120, true);
    const presses = tacklePressTicks(frames);
    expect(presses.length).toBeGreaterThan(2);

    const commitmentTicks =
      FOUNDATION_TACKLE_V1.standingPrepareTicks.value +
      FOUNDATION_TACKLE_V1.standingActiveTicks.value +
      FOUNDATION_TACKLE_V1.standingRecoverTicks.value;
    // The next press only becomes legal strictly after the release tick, so a
    // re-commit is never closer than the whole commitment plus one tick.
    for (let i = 1; i < presses.length; i++) {
      expect(presses[i] - presses[i - 1]).toBeGreaterThan(commitmentTicks);
    }
  });

  it("presses the slide bit when the team authorises a slide", () => {
    const observation = makeObservation({
      defender: { x: -33, y: 0 },
      defenderVelocity: { x: 6, y: 0 },
      ball: { x: -31.2, y: 0 },
      ballVelocity: { x: 6.6, y: 0 },
      carrier: { x: -31.5, y: 0.5 },
    });
    expect(computeTeamDecision(observation, "team-a").tackleCommit?.kind).toBe(
      "slide",
    );
    const frames = sampleSeries(observation, 10, true);
    const press = frames[tacklePressTicks(frames)[0]];
    expect(press.pressedButtons & SLIDE_TACKLE_BIT).toBe(SLIDE_TACKLE_BIT);
    expect(press.pressedButtons & STANDING_TACKLE_BIT).toBe(0);
  });

  it("leaves a teammate that is not the nominated tackler alone", () => {
    const observation = makeObservation({
      ...standingGeometry(),
      teammates: [{ id: "d2", x: -27, y: 3 }],
    });
    // d2 is a defender on the same team but not the designated presser.
    const teammateObs: CpuObservation = {
      ...observation,
      controlledPlayerId: "d2",
      teamDecision: computeTeamDecision(observation, "team-a"),
      cpuDefensiveTackle: true,
    };
    const adapter = createCpuAdapter();
    for (let tick = 0; tick < 20; tick++) {
      const frame = adapter.sample(tick, teammateObs);
      expect(frame.pressedButtons & TACKLE_BITS).toBe(0);
    }
    adapter.reset();
    expect(getCpuTackleCommitActivations()).toBe(0);
  });

  it("takes the touch instead of lunging when a first touch is on offer", () => {
    // Ball slow and inside touch range: the first-tick edge press of FIRST_TOUCH
    // outranks the tackle press.
    const observation = makeObservation({
      ...standingGeometry(),
      ball: { x: -29.3, y: 0 },
      ballVelocity: { x: 1.5, y: 0 },
    });
    const decision = computeTeamDecision(observation, "team-a");
    const adapter = createCpuAdapter();
    let pressedTackle = 0;
    let touched = false;
    for (let tick = 0; tick < 6; tick++) {
      const frame = adapter.sample(tick, {
        ...observation,
        teamDecision: decision,
        cpuDefensiveTackle: true,
      });
      if ((frame.pressedButtons & TACKLE_BITS) !== 0) pressedTackle++;
      if ((frame.pressedButtons & FIRST_TOUCH_BIT) !== 0) touched = true;
    }
    adapter.reset();
    expect(touched).toBe(true);
    expect(pressedTackle).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. No privileged access, no invented constants
// ---------------------------------------------------------------------------

describe("CPU-DEFENSIVE-TACKLE: decision inputs stay provisional and observed", () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const profilePath = join(
    __dirname,
    "../../../src/adapters/input-browser/team-decision-profile.ts",
  );

  it("the CPU decision module uses no clock, randomness, DOM or Node I/O", () => {
    const source = readFileSync(profilePath, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      /Math\.random/,
      /Date\./,
      /new\s+Date/,
      /performance\./,
      /window\./,
      /document\./,
      /process\./,
      /require\(/,
      /from\s+"node:/,
    ]) {
      expect(forbidden.source, `forbidden ${forbidden} in team-decision-profile.ts`).toBeTruthy();
      expect(source).not.toMatch(forbidden);
    }
  });

  it("the CPU decision reads versioned config, never simulation world state", () => {
    const source = readFileSync(profilePath, "utf-8");
    const configImports = source.match(/from "\.\.\/\.\.\/simulation\/[^"]+"/g) ?? [];
    expect(configImports.length).toBeGreaterThan(0);
    for (const specifier of configImports) {
      expect(specifier).toContain("simulation/config/foundation.js");
    }
    // No contracts/state or simulation loop import: no PlayerState/BallState,
    // no possession or tackle bookkeeping, only what CpuObservation exposes.
    expect(source).not.toMatch(/contracts\/state/);
    expect(source).not.toMatch(/simulation\/loop/);
    expect(source).not.toMatch(/contacts\/tackle-system/);
  });

  it("every CPU tackle threshold is labelled provisional and versioned", () => {
    expect(FOUNDATION_CPU_TACKLE_V1.id).toBe("foundation-cpu-tackle-v1");
    expect(FOUNDATION_CPU_TACKLE_V1.label).toBe("provisional");
    for (const [key, entry] of Object.entries(FOUNDATION_CPU_TACKLE_V1)) {
      if (key === "id" || key === "label") continue;
      expect(entry, `${key} must be a versioned { value, note } entry`).toHaveProperty("note");
      expect(String(entry.note)).toMatch(/provisional/);
    }
  });

  it("reuses the action system's own geometry instead of duplicating it", () => {
    const source = readFileSync(profilePath, "utf-8");
    // Reach, windows and the contact cone come from FOUNDATION_TACKLE_V1.
    expect(source).toMatch(/FOUNDATION_TACKLE_V1/);
    expect(source).toMatch(/contactConeMinCos/);
    expect(source).toMatch(/slideLungeSpeed/);
  });
});
