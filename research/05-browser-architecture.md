# Architecture Overview  
To satisfy **“gameplay first, rendering second”**, we decouple simulation (physics, AI, game state) from rendering.  The **main thread** handles only UI and input; heavy computation runs in Web Worker(s).  We use **OffscreenCanvas** (Web Workers) so rendering can also run off-main-thread.  In a typical flow: the main thread posts the game canvas to a worker via `transferControlToOffscreen()`.  Input events (keyboard/gamepad) are read on main and sent (via message or shared memory) to the simulation worker.  The **simulation worker** runs a fixed-step loop (physics, AI, tactics) producing an updated game state (positions, velocities, etc).  That state is sent to the **renderer worker**, which updates the 3D scene and draws via the OffscreenCanvas. This splits the work: input/UI on main, simulation in one thread, rendering in another.  

```plaintext
Main Thread (UI & Input)
    │           
    │ (offscreen canvas)           
    ▼                             
Renderer Worker (WebGL draw) ←─── Simulation Worker (Physics & AI)  
    ▲                    update state via SharedArrayBuffer      
    │                                    ▲                   
    └─── user inputs ────────────────────┘                    
```

**Key points:**  
- **Fixed-timestep simulation:** The simulation uses a constant time step (e.g. 1/60s) each update.  This ensures stability and reproducibility. (Following “fix your timestep”, we accumulate real time and perform 0, 1 or multiple constant steps as needed.)  
- **Rendering loop decoupled:** Rendering runs independently at the display frame rate.  We use interpolation of physics states to smooth the visuals.  For example, any leftover fraction in the accumulator is used to interpolate between the last two simulation states for rendering.  
- **Determinism:** Using a fixed step and a deterministic physics engine ensures replayability.  Avoid **variable timesteps** which change simulation outcome.  In practice, we seed any RNG and avoid non-deterministic math (e.g. JS’s `Math.sin`/`cos`).  In fact, the Rapier physics engine (WASM) claims cross-platform determinism when used with fixed steps.  

## Thread/Worker Model  
We adopt a multi-thread model using Web Workers:  
- **Single-worker (MVP):** For a moderate load, one worker can handle both simulation and rendering.  The main thread simply offloads input and passes the OffscreenCanvas; the worker runs the game loop and draws.  This eliminates main-thread bottlenecks (see discussions of OffscreenCanvas).  
- **Two-worker (optimized):** For heavy simulations, use two dedicated workers. One **Simulation Worker** runs the fixed-step loop (physics, AI) and writes state into shared memory. A separate **Render Worker** reads the latest state and draws at the display rate. SharedArrayBuffers (SAB) can transmit state and input efficiently.  This fully decouples simulation timing from rendering.  [57] specifically advises: “Physics-heavy titles want a second split. Run a fixed-timestep simulation worker at a stable rate (e.g. 60–120 Hz) and a separate render worker that interpolates between the two most recent states.”  In summary, single-worker or dual-worker are options; dual workers with SAB gives lower jitter and better determinism.  

**OffscreenCanvas & RAF:** In any case, the renderer worker obtains the OffscreenCanvas and calls `requestAnimationFrame()` inside the worker.  (RAF in worker is supported when the worker owns a canvas.)  That worker’s loop then just draws each frame using the latest simulation state.  Note that input still originates on the main thread; to avoid latency we should write inputs into a SAB ring buffer rather than post individual messages.  

## Simulation vs. Presentation Boundary  
The **simulation core** handles all gameplay logic (player positions, ball physics, collisions, AI decisions, tactics) without any knowledge of rendering.  This core should be written in portable TypeScript/JavaScript so it can run equally in the browser or in Node.js for headless tests. After each simulation tick, only the minimal state (entity transforms, animation states, ball position, etc.) is exposed for rendering. The **renderer** (in the separate thread) takes this state to update the 3D scene graph. In practice, the worker-to-worker communication can use SAB or structured messages carrying flat state arrays. This clean separation (no renderer calls inside simulation code) ensures we can reuse the same simulation core in automated tests or server-side if needed.  

## Headless/Server Execution  
The simulation core is independent of the browser DOM, so it can run under Node.js. Rapier’s WASM physics works in Node as well. For headless scenarios (automated Gauntlet, replay, testing), we can run the TS code in Node (e.g. via `ts-node` or a built bundle). A Node version would skip rendering entirely: it simply steps the simulation loop on a timer or driven by `setInterval`, logs results, etc. Alternatively, we could run a headless Chromium via Puppeteer if we need actual browser environment (for example, to test browser-specific behavior). But ideally, design the core so browser APIs (window, document) aren’t needed at all. Node’s `worker_threads` could even mimic the web worker model if parallelism is needed offline.  

## Renderer Recommendation  
We must choose a WebGL framework that supports stylized 3D. Two top candidates: **Three.js** and **Babylon.js**. Both are mature and capable, so the choice can hinge on art and feature needs. 

- **Three.js:** A lightweight, flexible 3D library with a huge community. It has built-in toon-shading support (`MeshToonMaterial` with gradient maps) and an example `OutlineEffect` for cartoon outlines. However, Three.js lacks a built-in physics or scene system (you wire things yourself). For UI or physics you’d plug in separate libraries. On the plus side, it’s widely used and versatile. 

- **Babylon.js:** A full-featured engine with PBR, GUI, physics integration, etc. Babylon 9.x (April 2026) even adds a **built-in Outline Renderer** for cartoon outlines. It also has improvements in nav-mesh pathfinding (useful for AI). Babylon includes high-level scene graph, cameras, and has native support for physics engines (Cannon, Ammo, Oimo). For our game, stylized graphics can be done in either: Three.js with `MeshToonMaterial` vs. Babylon’s outline/PBR tools. **Three.js** has the advantage of flexibility and community, while **Babylon.js** offers more out-of-the-box support (including stylization and GUI). In summary: both are feasible. If minimal dependencies are desired, Three.js with custom shaders is simple; if we want built-in tooling (outlines, physics, navmesh), Babylon is attractive.  

## Stylized Rendering Feasibility  
Our art goal (Mark of the Ninja style) demands *toon/cel shading*, clear silhouettes, and controlled lighting. Both Three.js and Babylon can achieve this: use a *limited color palette*, strong directional lighting, and cartoon shaders. For example, use a two-tone ramp texture on `MeshToonMaterial` for cel shading. Add a black outline (Three.js `OutlineEffect` or Babylon’s OutlineRenderer). Shadow rendering can be simplified (e.g. blob or soft shadows) to keep performance. With 22 animated characters, GPU skinning is required (both libraries support skinned meshes). Performance is a concern but manageable: 22 rigs at 60 fps is within modern GPUs. We would use frustum culling and possibly level-of-detail (LODs) if needed. Overall, stylized rendering is definitely feasible on WebGL; neither high-end photorealism nor expensive shaders are needed.  

## Physics and Collision  
We recommend using **Rapier** (a Rust-based physics engine with WASM/JS bindings). Rapier is fast and, crucially, *deterministic* across platforms. It can simulate 3D rigid bodies (the soccer ball, perhaps players as kinematic bodies, goalposts, etc.). For example, the ball would be a dynamic rigid body with restitution, and players might be represented by capsule colliders in kinematic mode (controlled by animations/tactics rather than physics forces). Using Rapier for the ball/environment ensures realistic bounces and collisions. If more performance or control is needed, one could implement *custom physics* for players (e.g. raycasting for ground, simple collision response) and use Rapier only for the ball. But Rapier’s WASM port makes it easy to use and yields reproducible results (just avoid non-deterministic math as noted).  

## Entity/State Architecture  
An **Entity-Component-System (ECS)** or data-oriented design is recommended. For example, use a library like **bitECS** to store component arrays in contiguous memory. In ECS, each player and ball is an entity (just an integer ID) with components like `Position`, `Velocity`, `Team`, `Stamina`, etc. Systems operate on entities with specific components. ECS excels at structuring game logic and scales well as the number of entities grows. It also pairs with multithreading: bitECS encourages using typed arrays (SoA layout) for components, which can be shared between threads via `SharedArrayBuffer`. This means the simulation worker can write new positions into a shared array that the render worker reads. We could also use a simpler data-oriented approach without a formal ECS: e.g. arrays of floats for positions, animations states, etc. Either way, separating data (game state) from logic (systems) is key.  

### Input Abstraction and Replay  
All input (local or network) should be funneled into a common interface. *Local input* uses the Web APIs: keyboard events and the Gamepad API. (The Gamepad API is widely supported and can be polled each frame.) *AI input* is just computed commands (e.g. “player 7 move forward”), which can be written into the same buffer or queued the same way. For future networking, remote inputs or state snapshots can be injected via the same channel. The main thread writes inputs into a *SharedArrayBuffer* in a ring buffer fashion so the simulation worker reads them without messaging overhead. 

For **replay**, record the sequence of all control inputs (and the initial seed/state). Because the simulation is deterministic (fixed-step + Rapier’s determinism), feeding the same inputs back yields the same game. This is more efficient than recording full state each frame. Telemetry data (scores, events, etc.) can be logged alongside.  

## Telemetry & Debugging  
We should instrument the simulation to emit metrics (FPS, tick time, collisions count, etc.) and log key events (goals, injuries). A simple approach is to use `console.log` or a web socket to a server for headless runs. In a debug build, overlay text (HTML or in-canvas) showing state variables can help. For performance debugging, use Chrome DevTools Performance: the **95th percentile frame time and dropped-frame count** are better indicators than average FPS.  (As [57] notes, after moving work off main, the DevTools trace should show the main thread mostly idle.) In addition, integrate tools like Spector.js for WebGL inspection if needed.  

Automation interfaces can include: a JavaScript console API in the browser to trigger scenarios, and Node scripts to run batches of matches (headless via Puppeteer or direct Node runs). In headless mode, reports (telemetry) can be written to files for analysis.  

## Performance Strategy  
Key risks are the CPU load (physics, AI) and GPU load (22 skinned characters with shading). Mitigations: 
- **Profiling:** Start by measuring with DevTools. Use **requestAnimationFrame** and performance.now() to time simulation vs render costs. Profile both CPU and GPU.  
- **Minimize GC:** Avoid allocating per-frame objects. Use object pools or typed arrays (as in bitECS) to hold state.  
- **Parallelism:** As described, offload to workers. If still CPU-bound, consider compiling hotspot code to WebAssembly (besides Rapier) – for example complex AI heuristics or pathfinding. However, only pursue WASM if profiling justifies it, since it complicates development.  
- **Graphics:** Use instancing or merging for identical geometry (e.g. goal posts, audience props). Limit lights and shadow casters. Stylized shading often uses flat colors and simple lights, which is fast.  
- **WebGPU Consideration:** WebGPU is now widely available in modern browsers. Both Three.js and Babylon support WebGPU renderers. WebGPU could dramatically speed up draw calls (and offers compute shaders), but it adds complexity. For an MVP, WebGL2 is sufficient; we can plan to evaluate WebGPU later if GPU becomes a bottleneck.  

## WASM / WebGPU / SharedArrayBuffer Conclusions  
- **WASM:** Use it where available: Rapier’s core is WASM (good). Additional compute (neural nets, complex AI) could be ported to WASM in future if needed. Otherwise, JS/TS should suffice.  
- **WebGPU:** Not required now. It’s an emerging standard (stable in major browsers) and libraries support it, but the tech matures. We can defer adopting WebGPU until after initial prototype.  
- **SharedArrayBuffer:** SAB is very useful for low-latency communication between threads (input, state). However, it requires cross-origin isolation headers. We should design with SAB in mind (especially for input and sim/render state), but if COOP/COEP setup is complicated, we can fall back to postMessage (with some performance cost).  

## Repository and Package Organization  
We recommend separating the **simulation core** from the **presentation layer**. For example:  
- A **core** package/module (`game-core`) containing all game logic (simulation loop, physics integration, rules, AI). This can be a pure TS library (no DOM references).  
- A **web app** or **demo** (`game-app`) that depends on `game-core`, handles browser UI, spawns workers, and includes the renderer (Three.js/Babylon).  
- A **worker script** bundle if using multiple workers (or one that does both sim+render).  
- A **headless runner** (Node.js CLI) that also uses `game-core` to run simulations without any graphics.  
Using a monorepo (yarn/npm workspaces) can manage these. Clear boundaries ensure we don’t accidentally import browser APIs into the core.  

## Architecture Decision Matrix (Summary)

| Architecture Choice                 | Pros                                                | Cons                                        | Best Use Case                    |
|-------------------------------------|-----------------------------------------------------|---------------------------------------------|----------------------------------|
| **Main-thread only**                | Simplest, no messaging                             | Blocks UI, low max performance              | Prototypes, very light loads     |
| **Single Worker + OffscreenCanvas** | Low main-thread load; input latency low if SAB used | Simulation and rendering compete for one core | Typical action games, mobile-like loads |
| **Two Workers + SharedArrayBuffer** | Decoupled sim/render; physics deterministic; very low main load | More complex (SAB, thread sync)            | Physics-heavy, deterministic sims |

## MVP → 11v11 Evolution  
- **MVP:** Start small (e.g. 4v4) to validate core systems and data flow. Focus on single-thread architecture initially, and ensure gameplay mechanics work.  
- **Scale Up:** Gradually increase team sizes. Monitor performance; if needed, split into two workers for full 22×2 players.  
- **Add Features:** Once core is stable, add full rules (offside, fouls), better AI tactics, multiplayer netcode, etc. Because we built with determinism, we can later implement lockstep networking or state-sync multiplayer.  
- **Art polish:** Iterate on shaders and models. Stylized assets are generally less heavy, so ramping polygon counts a bit is fine. Always profile GPU load as more characters are added.  

## Decisions – Now vs Later (DECIDE/DEFER)  
- **Decide Now:** Use fixed timestep (60 Hz) and accumulation loop. Use Rapier for physics. Architect with Web Workers and OffscreenCanvas. Adopt a component-based state model (ECS/data-oriented).  
- **Defer:** WebGPU rendering (wait and test later). Full multiplayer networking design (only ensure compatibility by using lockstep-friendly sim). Sophisticated graphics like volumetric effects.  
- **Open Questions:** Precise performance of 22 skinned, cel-shaded characters on target hardware (test on mid-range GPU). Input buffering latency: verify that SAB input truly stays under one frame. Trade-offs between single vs double-worker in practice: prototype both to measure gains.  

## References  
- Web Workers and OffscreenCanvas; worker-based game loop architecture.  
- Fixed-step game loop (“Fix Your Timestep”) and interpolation.  
- Rapier physics determinism.  
- Three.js vs Babylon.js comparison; stylized shaders (MeshToonMaterial, Babylon OutlineRenderer).  
- ECS/data-oriented design (e.g. bitECS).  
- Input API availability; SharedArrayBuffer isolation requirements.  
- Performance profiling guidance.  

