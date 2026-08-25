/**
 * @module eval/runners/small-sided-match-situation-scanner
 *
 * SMALL-SIDED-MATCH-SITUATION-SCANNER: scans a single continuous
 * small-sided match (ai-vs-ai 3v3 / 5v5) event + telemetry stream
 * and outputs per-situation localizations — the tick windows and
 * event clusters where each of the 8 milestone situations occurs.
 *
 * This extends the small-sided situation evaluator machinery from
 * purpose-built driven fixtures to the organic event stream of a
 * continuous match.
 *
 * Design:
 *   1. Filter events per situation using existing `isRelevantEvent`.
 *   2. Group relevant events into tick-windows (configurable size).
 *   3. Group adjacent windows into clusters (gap threshold).
 *   4. Compute verdict per cluster via existing `computeSituationVerdict`.
 *   5. Return per-situation localization with candidate presence.
 *
 * Honest assessment:
 *   - "present"     = at least one cluster with PASS verdict and sufficient
 *                     event density (≥2 required event kinds OR ≥1 event kind
 *                     with indicative kind present).
 *   - "not_observed" = no relevant events for this situation at all.
 *   - "insufficient_context" = relevant events exist but fall below the
 *                     density/threshold for a confident verdict.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in the core logic.
 * Node I/O is allowed in the eval layer.
 */

import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

import {
  filterEventsForSituation,
  MAPPED_SITUATION_IDS,
  SITUATION_EVIDENCE_REQUIREMENTS,
  getSituationEvidence,
  type SituationEvidenceRequirement,
} from "../contracts/situation-mapping.js";

import { computeSituationVerdict } from "./small-sided-situation-evaluator.js";

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

/** Default tick-window size (in ticks).  30 ticks ≈ 0.5 s at 60 Hz. */
const DEFAULT_WINDOW_TICKS = 30;

/** Default cluster gap threshold (in ticks).  60 ticks ≈ 1 s. */
const DEFAULT_CLUSTER_GAP = 60;

/** Minimum events per cluster for "sufficient_context". */
const MIN_EVENTS_FOR_CONTEXT = 2;

/** Minimum distinct event kinds per cluster to be "present". */
const MIN_KINDS_FOR_PRESENCE = 2;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A contiguous tick window of events for a situation.
 */
export interface MatchSituationWindow {
  /** First tick in the window (inclusive). */
  startTick: number;
  /** Last tick in the window (inclusive). */
  endTick: number;
  /** Events in this window relevant to the situation. */
  events: SimulationEvent[];
  /** Number of distinct event kinds in the window. */
  kindCount: number;
}

/**
 * A cluster of adjacent windows where a situation may be active.
 */
export interface MatchSituationCluster {
  /** First tick of the cluster (inclusive). */
  startTick: number;
  /** Last tick of the cluster (inclusive). */
  endTick: number;
  /** Constituent windows (ordered by startTick). */
  windows: MatchSituationWindow[];
  /** Total events across all windows. */
  totalEvents: number;
  /** Distinct event kinds in the cluster. */
  kindSet: Set<string>;
  /** Verdict for the cluster. */
  verdict: "PASS" | "FAIL" | "NOT_EVALUATED";
  /** Verdict reason. */
  verdictReason: string;
}

/**
 * Candidate presence assessment for a situation in a continuous match.
 */
export type CandidatePresence = "present" | "not_observed" | "insufficient_context";

/**
 * Per-situation localization output.
 */
export interface MatchSituationLocalization {
  /** Situation ID. */
  situation_id: string;
  /** Evidence requirement for this situation. */
  evidence_requirement: SituationEvidenceRequirement;
  /** Candidate presence assessment. */
  presence: CandidatePresence;
  /** Verdict for each cluster. */
  clusters: MatchSituationCluster[];
  /** Total events relevant to this situation in the match. */
  totalRelevantEvents: number;
  /** Tick range of all relevant events (undefined if none). */
  tickRange: { startTick: number; endTick: number } | undefined;
  /** Distinct event kinds observed for this situation. */
  observedKinds: string[];
  /** Whether the situation's position data is required and observations were provided. */
  hasPositionData: boolean;
}

/**
 * Full scan result: one localization per situation.
 */
export interface MatchSituationScanResult {
  /** All situation localizations, one per MAPPED_SITUATION_IDS. */
  localizations: MatchSituationLocalization[];
  /** Total ticks spanned by the match (max tick across all events). */
  totalTicks: number;
  /** Number of observations collected. */
  observationCount: number;
  /** Total events across all situations (deduplicated by event id). */
  totalUniqueEvents: number;
  /** Summary of presence counts. */
  summary: {
    present: number;
    notObserved: number;
    insufficientContext: number;
  };
}

/**
 * Configuration options for the scanner.
 */
export interface MatchSituationScannerOptions {
  /** Window size in ticks (default: 30). */
  windowTicks?: number;
  /** Cluster gap threshold in ticks (default: 60). */
  clusterGapTicks?: number;
  /** Minimum events for context (default: 2). */
  minEventsForContext?: number;
  /** Minimum distinct kinds for presence (default: 2). */
  minKindsForPresence?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find the min and max tick across a set of events.
 * Returns undefined if the set is empty.
 */
function tickRange(events: SimulationEvent[]): { startTick: number; endTick: number } | undefined {
  if (events.length === 0) return undefined;
  let min = Infinity;
  let max = -Infinity;
  for (const e of events) {
    if (e.tick < min) min = e.tick;
    if (e.tick > max) max = e.tick;
  }
  return { startTick: min, endTick: max };
}

/**
 * Group events into tick-windows by splitting on tick boundaries.
 * Events within `windowTicks` ticks of each other go in the same window.
 */
function groupIntoWindows(
  events: SimulationEvent[],
  windowTicks: number,
): MatchSituationWindow[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.sequence - b.sequence);
  const windows: MatchSituationWindow[] = [];
  let currentEvents: SimulationEvent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.tick - prev.tick <= windowTicks) {
      currentEvents.push(curr);
    } else {
      windows.push(makeWindow(currentEvents));
      currentEvents = [curr];
    }
  }
  windows.push(makeWindow(currentEvents));
  return windows;
}

/**
 * Build a window from a sorted array of events.
 */
function makeWindow(events: SimulationEvent[]): MatchSituationWindow {
  return {
    startTick: events[0].tick,
    endTick: events[events.length - 1].tick,
    events,
    kindCount: new Set(events.map((e) => e.kind)).size,
  };
}

/**
 * Merge adjacent windows into clusters when the gap between them is
 * within the cluster gap threshold.
 */
function groupIntoClusters(
  windows: MatchSituationWindow[],
  clusterGap: number,
): MatchSituationCluster[] {
  if (windows.length === 0) return [];

  const sorted = [...windows].sort((a, b) => a.startTick - b.startTick);
  const clusters: MatchSituationCluster[] = [];
  let currentWindows: MatchSituationWindow[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.startTick - prev.endTick <= clusterGap) {
      currentWindows.push(curr);
    } else {
      clusters.push(makeCluster(currentWindows));
      currentWindows = [curr];
    }
  }
  clusters.push(makeCluster(currentWindows));
  return clusters;
}

/**
 * Build a cluster from a list of windows.
 */
function makeCluster(windows: MatchSituationWindow[]): MatchSituationCluster {
  const allEvents = windows.flatMap((w) => w.events);
  const kindSet = new Set(allEvents.map((e) => e.kind));
  return {
    startTick: windows[0].startTick,
    endTick: windows[windows.length - 1].endTick,
    windows,
    totalEvents: allEvents.length,
    kindSet,
    verdict: "NOT_EVALUATED",
    verdictReason: "",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan a continuous small-sided match event + telemetry stream and
 * produce per-situation localizations.
 *
 * @param events - All simulation events from the match.
 * @param observations - Telemetry observations (for position data check).
 * @param options - Optional scanner configuration.
 * @returns MatchSituationScanResult with per-situation localization.
 */
export function scanMatch(
  events: SimulationEvent[],
  observations: TelemetryObservation[],
  options?: MatchSituationScannerOptions,
): MatchSituationScanResult {
  const {
    windowTicks = DEFAULT_WINDOW_TICKS,
    clusterGap = DEFAULT_CLUSTER_GAP,
    minEventsForContext = MIN_EVENTS_FOR_CONTEXT,
    minKindsForPresence = MIN_KINDS_FOR_PRESENCE,
  } = options ?? {};

  const localizations: MatchSituationLocalization[] = [];
  let totalUniqueEvents = new Set<string>();

  // Track max tick across all events AND observations for totalTicks.
  let maxTick = 0;
  for (const e of events) {
    if (e.tick > maxTick) maxTick = e.tick;
    totalUniqueEvents.add(e.id);
  }
  // Also check observation ticks in case simulation ran but no events were emitted.
  for (const obs of observations) {
    if (obs.tick > maxTick) maxTick = obs.tick;
  }

  for (const situationId of MAPPED_SITUATION_IDS) {
    const req = getSituationEvidence(situationId);
    if (!req) continue;

    // Filter events for this situation using existing mapping.
    const relevantEvents = filterEventsForSituation(events, situationId);

    if (relevantEvents.length === 0) {
      localizations.push({
        situation_id: situationId,
        evidence_requirement: req,
        presence: "not_observed",
        clusters: [],
        totalRelevantEvents: 0,
        tickRange: undefined,
        observedKinds: [],
        hasPositionData: false,
      });
      continue;
    }

    // Group into windows.
    const windows = groupIntoWindows(relevantEvents, windowTicks);

    // Group windows into clusters.
    const clusters = groupIntoClusters(windows, clusterGap);

    // Compute verdict per cluster using existing logic.
    for (const cluster of clusters) {
      const { verdict, reason } = computeSituationVerdict(
        situationId,
        cluster.windows.flatMap((w) => w.events),
        req,
      );
      cluster.verdict = verdict;
      cluster.verdictReason = reason;
    }

    // Determine candidate presence.
    let presence: CandidatePresence;

    const passClusters = clusters.filter((c) => c.verdict === "PASS");
    const failClusters = clusters.filter((c) => c.verdict === "FAIL");

    // Check if any cluster has a required event kind present.
    // A situation should not be "present" if only indicative kinds fire.
    const hasRequiredKindInCluster = (cluster: MatchSituationCluster): boolean =>
      cluster.kindSet.size > 0 &&
      req.required_event_kinds.some((k) => cluster.kindSet.has(k));

    if (passClusters.length === 0) {
      // No PASS verdicts → insufficient_context.
      presence = "insufficient_context";
    } else {
      // Check if any PASS cluster has sufficient density AND has at least one required kind.
      const densePass = passClusters.some(
        (c) =>
          hasRequiredKindInCluster(c) &&
          (c.kindSet.size >= minKindsForPresence || c.totalEvents >= minEventsForContext),
      );

      if (densePass) {
        presence = "present";
      } else {
        presence = "insufficient_context";
      }
    }

    const observedKinds = [...new Set(relevantEvents.map((e) => e.kind))].sort();
    const hasPositionData = req.requires_position_data && observations.length > 0;

    localizations.push({
      situation_id: situationId,
      evidence_requirement: req,
      presence,
      clusters,
      totalRelevantEvents: relevantEvents.length,
      tickRange: tickRange(relevantEvents),
      observedKinds,
      hasPositionData,
    });
  }

  // Count presence summary.
  const summary = {
    present: localizations.filter((l) => l.presence === "present").length,
    notObserved: localizations.filter((l) => l.presence === "not_observed").length,
    insufficientContext: localizations.filter((l) => l.presence === "insufficient_context").length,
  };

  return {
    localizations,
    totalTicks: maxTick,
    observationCount: observations.length,
    totalUniqueEvents: totalUniqueEvents.size,
    summary,
  };
}

/**
 * Convenience function: scan a match result object from runHeadlessMatch.
 *
 * @param matchEvents - Events from a headless match.
 * @param observations - Telemetry observations from a headless match.
 * @param options - Optional scanner configuration.
 * @returns MatchSituationScanResult.
 */
export function scanMatchResult(
  matchEvents: SimulationEvent[],
  observations: TelemetryObservation[],
  options?: MatchSituationScannerOptions,
): MatchSituationScanResult {
  return scanMatch(matchEvents, observations, options);
}

/**
 * Convenience function: scan an evaluation result (from evaluate()).
 *
 * The evaluation result events are a stripped shape ({ tick, id, kind, label })
 * which we lift to SimulationEvent-compatible shape before scanning.
 *
 * @param events - Stripped events from EvaluationResult.
 * @param observations - Telemetry observations.
 * @param options - Optional scanner configuration.
 * @returns MatchSituationScanResult.
 */
export function scanEvaluationEvents(
  events: Array<{ tick: number; id: string; kind: string; label: string }>,
  observations: TelemetryObservation[],
  options?: MatchSituationScannerOptions,
): MatchSituationScanResult {
  const liftedEvents = events.map(
    (e) =>
      ({
        ...e,
        payload: {},
        sequence: 0,
      }) as unknown as SimulationEvent,
  );
  return scanMatch(liftedEvents, observations, options);
}