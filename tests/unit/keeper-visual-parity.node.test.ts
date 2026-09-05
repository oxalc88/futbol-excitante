/**
 * KEEPER-VISUAL-MARKER contract-additivity parity guard (node).
 *
 * Verifies that the additive `PlayerPresentation.keeperRole?: boolean` change is
 * genuinely additive:
 *   - a snapshot built WITHOUT the field still satisfies the contract and is
 *     left byte-identical (the existing snapshot consumers are unaffected);
 *   - `enrichPresentationWithKeeperRoles` adds the field ONLY on the designated
 *     keepers, leaves every other player and the rest of the snapshot untouched
 *     (shallow copy, no mutation of the input);
 *   - the enrich output is exactly the input plus the keeper flag, never a
 *     semantic rewrite.
 *
 * This is the presentation-only, non-authoritative surface: the simulate core
 * and source world state are not touched here.
 */

import { describe, it, expect } from "vitest";
import type { PresentationSnapshot } from "../../src/contracts/presentation.js";
import { enrichPresentationWithKeeperRoles } from "../../src/adapters/renderer-three/renderer.js";

function baseSnapshot(): PresentationSnapshot {
  return {
    tick: 100,
    simulationTime: 100 / 60,
    players: [
      {
        playerId: "player-1",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        bodyHeading: 0,
        speed: 0,
        locomotionPhase: "idle",
        isControlled: false,
        actionState: null,
        contactState: null,
      },
      {
        playerId: "player-4",
        teamId: "team-a",
        groundPosition: { x: -30, y: -10 },
        bodyHeading: 0,
        speed: 0,
        locomotionPhase: "idle",
        isControlled: false,
        actionState: null,
        contactState: null,
      },
      {
        playerId: "player-10",
        teamId: "team-b",
        groundPosition: { x: 52.4, y: -0.3 },
        bodyHeading: 0,
        speed: 0,
        locomotionPhase: "idle",
        isControlled: false,
        actionState: null,
        contactState: null,
      },
    ],
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      speed: 0,
      regime: "ground-roll",
      isGrounded: true,
      angularVelocity: { x: 0, y: 0, z: 0 },
    },
    events: [],
    controlAssignments: { bySlot: {} },
    matchPhase: "playing",
    matchTimer: 100,
  };
}

describe("KEEPER-VISUAL-MARKER: contract additivity (node)", () => {
  it("an un-enriched snapshot satisfies the contract and carries no keeperRole (existing consumers unaffected)", () => {
    const snapshot = baseSnapshot();
    // Structurally valid, no keeperRole anywhere, and existing fields unchanged.
    for (const player of snapshot.players) {
      expect(player.keeperRole).toBeUndefined();
      // Required fields still present (contract unchanged apart from the optional flag).
      expect(player.playerId).not.toBe("");
      expect(player.teamId).not.toBe("");
      expect(player.groundPosition).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    }
  });

  it("enrichPresentationWithKeeperRoles adds keeperRole ONLY on the designated keepers", () => {
    const snapshot = baseSnapshot();
    const keeperByTeam: Record<string, string> = {
      "team-a": "player-4",
      "team-b": "player-10",
    };
    const enriched = enrichPresentationWithKeeperRoles(snapshot, keeperByTeam);

    const flagged = enriched.players.filter((player) => player.keeperRole === true);
    expect(flagged.map((player) => player.playerId).sort()).toEqual(
      ["player-10", "player-4"].sort(),
    );
    for (const player of enriched.players) {
      if (keeperByTeam[player.teamId] === player.playerId) {
        expect(player.keeperRole).toBe(true);
      } else {
        expect(player.keeperRole).toBeUndefined();
      }
    }
  });

  it("enrichment is a shallow, non-mutating post-process — the input is untouched", () => {
    const snapshot = baseSnapshot();
    const beforePlayers = snapshot.players.map((player) => ({ ...player }));
    const beforeBall = snapshot.ball;
    const enriched = enrichPresentationWithKeeperRoles(snapshot, {
      "team-a": "player-4",
      "team-b": "player-10",
    });

    // Input snapshot not mutated.
    expect(snapshot.players).toEqual(beforePlayers);
    expect(snapshot.ball).toBe(beforeBall);
    expect(snapshot.tick).toBe(100);

    // Only the presentation flag surface changed: same tick, ball, timers, count.
    expect(enriched.tick).toBe(snapshot.tick);
    expect(enriched.ball).toBe(snapshot.ball);
    expect(enriched.matchPhase).toBe(snapshot.matchPhase);
    expect(enriched.matchTimer).toBe(snapshot.matchTimer);
    expect(enriched.players.length).toBe(snapshot.players.length);
  });
});
