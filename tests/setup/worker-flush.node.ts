/**
 * Node-project vitest setup: keep the worker's event loop reaching the
 * macrotask (poll) phase between tests.
 *
 * Why: vitest 3.2.7 workers send birpc `onTaskUpdate` calls to the main
 * process with a hardcoded 60 s timeout (dist/chunks/index.B521nVV-.js,
 * DEFAULT_TIMEOUT = 6e4). The runner only awaits microtasks between tests,
 * so a file whose tests run back-to-back can keep the worker out of the
 * poll phase long enough for the timer to expire; the queued RPC response
 * then arrives after rejection and the run fails with
 * "[vitest-worker]: Timeout calling onTaskUpdate" as an unhandled error
 * even though every test passed. Flushing macrotasks after each test (and
 * after each suite) bounds the starvation window to the longest single
 * synchronous test body. setImmediate is not faked by vi.useFakeTimers
 * (this suite never enables it anyway), and the flush runs outside test
 * bodies, so no assertion, hash or observation is affected.
 */
import { afterAll, afterEach } from "vitest";

afterEach(async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
});

afterAll(async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
});
