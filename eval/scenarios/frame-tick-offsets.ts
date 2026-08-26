/**
 * Shared frame-tick formula constants for SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY.
 *
 * These constants define the tick offset for each DYNAMIC_VISUAL frame
 * relative to the event tick.  Both the browser capture test
 * (tests/browser/human-action-screenshot-capture.browser.test.ts) and
 * the headless evidence producer (scripts/capture-human-action-readability-evidence.ts)
 * MUST use these exact offsets so that:
 *   - sequence.json frame ticks == actual capture ticks
 *   - PNG byte content == what the metadata claims
 *
 * Convention: every capture happens AFTER stepping to the target tick.
 * All captures use AFTER semantics: step to target tick, then render + capture.
 *
 * Frame tick formula (5 frames — shot-before omitted per 3-5 frame audit limit):
 *   pass-before  = passEventTick + PASS_BEFORE_OFFSET   (= passEventTick - 10)
 *   pass-event   = passEventTick
 *   pass-after   = passEventTick + PASS_AFTER_OFFSET    (= passEventTick + 12)
 *   shot-event   = shotEventTick
 *   shot-after   = shotEventTick + SHOT_AFTER_OFFSET    (= shotEventTick + 12)
 */
export const PASS_BEFORE_OFFSET = -10;
export const PASS_AFTER_OFFSET = 12;
export const SHOT_AFTER_OFFSET = 12;
