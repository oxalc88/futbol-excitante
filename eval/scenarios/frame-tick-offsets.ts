/**
 * Shared frame-tick formula constants for DYNAMIC_VISUAL evidence capture.
 *
 * These constants define the tick offset for each semantic frame
 * relative to the named event tick.  Both browser capture tests
 * and headless evidence producers MUST use these exact offsets so that:
 *   - sequence.json frame ticks == actual capture ticks
 *   - PNG byte content == what the metadata claims
 *
 * Convention: every capture happens AFTER stepping to the target tick.
 * All captures use AFTER semantics: step to target tick, then render + capture.
 *
 * SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY frames:
 *   pass-before  = passEventTick + PASS_BEFORE_OFFSET   (= passEventTick - 10)
 *   pass-event   = passEventTick
 *   pass-after   = passEventTick + PASS_AFTER_OFFSET    (= passEventTick + 12)
 *   shot-event   = shotEventTick
 *   shot-after   = shotEventTick + SHOT_AFTER_OFFSET    (= shotEventTick + 12)
 *
 * HUMAN-DEFENSIVE-DUEL-CONTROL frames (event-centered on the tackle input tick):
 *   tack-before  = tackleInputTick + TACK_BEFORE_OFFSET  (= inputTick - 8)
 *   tack-input   = tackleInputTick
 *   tack-active  = tackleInputTick + TACK_ACTIVE_OFFSET  (= inputTick + prepareTicks + 1)
 *   tack-contact = tackleInputTick + TACK_CONTACT_OFFSET (= inputTick + prepareTicks + 2)
 *   tack-recover = tackleInputTick + TACK_RECOVERY_OFFSET(= inputTick + prepareTicks + activeTicks + recoverTicks - 1)
 */
export const PASS_BEFORE_OFFSET = -10;
export const PASS_AFTER_OFFSET = 12;
export const SHOT_AFTER_OFFSET = 12;

/** Frames before the tackle input tick (pre-commitment steering). */
export const TACK_BEFORE_OFFSET = -8;
/** The tackle input tick itself (the standing/slide bit is pressed). */
export const TACK_INPUT_OFFSET = 0;
/** First tick inside the active window (prepare completed). */
export const TACK_ACTIVE_OFFSET = 3;
/** Mid-active-window tick when contact is likely (after standing prepare+1). */
export const TACK_CONTACT_OFFSET = 4;
/** Late in the recovery window (action winding down, body capped). */
export const TACK_RECOVERY_OFFSET = 14;
