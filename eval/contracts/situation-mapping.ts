/**
 * @module @pes/eval/contracts/situation-mapping
 *
 * Situation ↔ Simulation event / telemetry observation mappings.
 *
 * Each situation from `gauntlet/gameplay-situations.json` maps to the
 * simulation events and telemetry fields that can evidence its
 * occurrence during a run of a scenario fixture.
 *
 * This module is imported by evaluator objectives to select
 * evidence from run data (events + telemetry observations).
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Event filter predicates
// ---------------------------------------------------------------------------

/**
 * Check if a simulation event is relevant to a situation.
 *
 * Returns true when the event kind matches an indicator event for
 * the given situation.  This is a necessary-but-not-sufficient check:
 * the full situation requires context (multiple events, position data).
 *
 * @param event - The simulation event to classify.
 * @param situationId - The situation identifier.
 * @returns true if this event is an indicator event for the situation.
 */
export function isRelevantEvent(
  event: SimulationEvent,
  situationId: string,
): boolean {
  switch (situationId) {
    case "PASS_RECEPTION": {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
      return event.kind === "pass" || event.kind === "player-ball-contact" || req.indicative_event_kinds.includes(event.kind);
    }

    case "SHOT_TO_RESULT": {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
      return event.kind === "shot" || event.kind === "goal" || event.kind === "ball-out-of-play" || req.indicative_event_kinds.includes(event.kind);
    }

    case "PHYSICAL_DUEL": {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
      return event.kind === "player-player-contact" || req.indicative_event_kinds.includes(event.kind);
    }

    case "SUPPORT_AND_PASSING_LANES": {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
      return event.kind === "pass" || event.kind === "player-ball-contact" || req.indicative_event_kinds.includes(event.kind);
    }

    case "SETTLED_ATTACK_VS_DEFENCE": {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
      return (
        event.kind === "pass" ||
        event.kind === "shot" ||
        event.kind === "player-ball-contact" ||
        event.kind === "player-player-contact" ||
        req.indicative_event_kinds.includes(event.kind)
      );
    }

    case "ATTACK_TO_DEFENCE_TRANSITION": {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
      return (
        event.kind === "ball-out-of-play" ||
        event.kind === "pass" ||
        event.kind === "shot" ||
        event.kind === "goal" ||
        req.indicative_event_kinds.includes(event.kind)
      );
    }

    case "DEFENCE_TO_ATTACK_TRANSITION": {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
      return (
        event.kind === "player-ball-contact" ||
        event.kind === "pass" ||
        event.kind === "shot" ||
        event.kind === "goal" ||
        req.indicative_event_kinds.includes(event.kind)
      );
    }

    case "COORDINATED_PRESS": {
      const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
      return (
        event.kind === "player-player-contact" ||
        event.kind === "pass" ||
        event.kind === "shot" ||
        event.kind === "input-rejection" ||
        req.indicative_event_kinds.includes(event.kind)
      );
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Evidence requirement per situation
// ---------------------------------------------------------------------------

/**
 * Describes what evidence a situation expects from a scenario run.
 */
export interface SituationEvidenceRequirement {
  /** Situation ID from gameplay-situations.json */
  situation_id: string;
  /** Required simulation event kinds (at least one must appear) */
  required_event_kinds: string[];
  /** Optional additional event kinds that strengthen evidence */
  indicative_event_kinds: string[];
  /** Whether telemetry position data is needed to validate */
  requires_position_data: boolean;
  /** Whether team geometry trajectory is needed */
  requires_team_geometry: boolean;
  /**
   * Mapping status:
   *  - READY      → event kinds map to known indicators, evaluator can use.
   *  - NOT_EVALUATED → situation exists but no executable verdict claim is
   *                     made by this objective.  Mappings are structural only.
   */
  mapping_status: "READY" | "NOT_EVALUATED";
  /** Description of the evidence chain. */
  evidence_chain: string;
}

/**
 * Full evidence requirement record for all SMALL_SIDED_SHAPE situations.
 */
export const SITUATION_EVIDENCE_REQUIREMENTS: Record<
  string,
  SituationEvidenceRequirement
> = {
  PASS_RECEPTION: {
    situation_id: "PASS_RECEPTION",
    required_event_kinds: ["pass", "player-ball-contact"],
    indicative_event_kinds: ["second-touch"],
    requires_position_data: true,
    requires_team_geometry: false,
    mapping_status: "NOT_EVALUATED",
    evidence_chain:
      "pass event (tick, from_player, to_player) → player-ball-contact at receiver " +
      "tick (first touch) → verify ball trajectory between events",
  },
  SHOT_TO_RESULT: {
    situation_id: "SHOT_TO_RESULT",
    required_event_kinds: ["shot", "goal", "ball-out-of-play"],
    indicative_event_kinds: ["pitch-contact"],
    requires_position_data: true,
    requires_team_geometry: false,
    mapping_status: "NOT_EVALUATED",
    evidence_chain:
      "shot event → ball trajectory (telemetry) → goal or ball-out-of-play event " +
      "within finite ticks",
  },
  PHYSICAL_DUEL: {
    situation_id: "PHYSICAL_DUEL",
    required_event_kinds: ["player-player-contact"],
    indicative_event_kinds: ["input-rejection"],
    requires_position_data: true,
    requires_team_geometry: false,
    mapping_status: "NOT_EVALUATED",
    evidence_chain:
      "player-player-contact event (two opposing players) → verify " +
      "displacement via telemetry positions before/after contact",
  },
  SUPPORT_AND_PASSING_LANES: {
    situation_id: "SUPPORT_AND_PASSING_LANES",
    required_event_kinds: ["pass", "player-ball-contact"],
    indicative_event_kinds: ["second-touch"],
    requires_position_data: true,
    requires_team_geometry: true,
    mapping_status: "NOT_EVALUATED",
    evidence_chain:
      "pass event → receiver position → teammate positions at pass time " +
      "→ verify teammate was in support position without breaking formation",
  },
  SETTLED_ATTACK_VS_DEFENCE: {
    situation_id: "SETTLED_ATTACK_VS_DEFENCE",
    required_event_kinds: [
      "pass",
      "player-ball-contact",
      "player-player-contact",
    ],
    indicative_event_kinds: ["shot"],
    requires_position_data: true,
    requires_team_geometry: true,
    mapping_status: "NOT_EVALUATED",
    evidence_chain:
      "Telemetry positions of all 6 players → extract team geometry " +
      "(defensive line, spacing) → verify attacking progression against " +
      "preserved defensive shape",
  },
  ATTACK_TO_DEFENCE_TRANSITION: {
    situation_id: "ATTACK_TO_DEFENCE_TRANSITION",
    required_event_kinds: [
      "ball-out-of-play",
      "pass",
      "shot",
      "goal",
    ],
    indicative_event_kinds: [
      "player-player-contact",
      "player-ball-contact",
    ],
    requires_position_data: true,
    requires_team_geometry: true,
    mapping_status: "NOT_EVALUATED",
    evidence_chain:
      "Possession loss event (ball-out-of-play or opponent gain) → " +
      "telemetry position trajectory → verify team-a (attacking team) " +
      "transitions to defensive formation",
  },
  DEFENCE_TO_ATTACK_TRANSITION: {
    situation_id: "DEFENCE_TO_ATTACK_TRANSITION",
    required_event_kinds: [
      "player-ball-contact",
      "pass",
      "shot",
      "goal",
    ],
    indicative_event_kinds: [
      "player-player-contact",
      "ball-out-of-play",
    ],
    requires_position_data: true,
    requires_team_geometry: true,
    mapping_status: "NOT_EVALUATED",
    evidence_chain:
      "Recovery event (team-b gains possession via player-ball-contact) → " +
      "telemetry position trajectory → verify differentiated attacking roles",
  },
  COORDINATED_PRESS: {
    situation_id: "COORDINATED_PRESS",
    required_event_kinds: [
      "player-player-contact",
      "input-rejection",
      "pass",
      "shot",
    ],
    indicative_event_kinds: ["player-ball-contact"],
    requires_position_data: true,
    requires_team_geometry: true,
    mapping_status: "NOT_EVALUATED",
    evidence_chain:
      "Player-player contact near opponent with ball → verify multiple " +
      "team members press (not just one) → ball possession changes " +
      "indicate successful or failed press",
  },
};

/**
 * All situation IDs that have evidence mappings.
 */
export const MAPPED_SITUATION_IDS: string[] = Object.keys(
  SITUATION_EVIDENCE_REQUIREMENTS,
);

/**
 * Get evidence requirements for a situation.
 *
 * @param situationId - The situation identifier.
 * @returns The evidence requirement record, or undefined if unmapped.
 */
export function getSituationEvidence(
  situationId: string,
): SituationEvidenceRequirement | undefined {
  return SITUATION_EVIDENCE_REQUIREMENTS[situationId];
}

/**
 * Filter events from a run to those relevant for a situation.
 *
 * @param events - All simulation events from a run.
 * @param situationId - The situation to filter for.
 * @returns Events where isRelevantEvent returns true.
 */
export function filterEventsForSituation(
  events: SimulationEvent[],
  situationId: string,
): SimulationEvent[] {
  return events.filter((e) => isRelevantEvent(e, situationId));
}

/**
 * Filter observations from a run to those relevant for a situation.
 *
 * @param observations - All telemetry observations from a run.
 * @param situationId - The situation to filter for.
 * @returns Observations where at least one event is relevant to the situation.
 */
export function filterObservationsForSituation(
  observations: TelemetryObservation[],
  situationId: string,
): TelemetryObservation[] {
  return observations.filter((obs) =>
    obs.events.some((evt) => isRelevantEvent(evt as unknown as SimulationEvent, situationId)),
  );
}