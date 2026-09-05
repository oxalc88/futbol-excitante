import type { Config } from '../contracts/types';
// Fictional design values, VERSIONED_PROVISIONAL. No PES reference calibration.
export function createConfig(options: Partial<Pick<Config, 'seed' | 'halfSeconds' | 'teamSize' | 'human'>> = {}): Config {
  return {
    version: 'vision-rebuild-config-v1', dt: 1/60, halfSeconds: 180, teamSize: 11, seed: 2017, human: [true, false],
    pitch: { length: 105, width: 68, goalWidth: 7.32, goalHeight: 2.44 },
    physics: { radius: .11, gravity: 9.81, rolling: 1.35, drag: .015, restitution: .48, spinDecay: .8, magnus: .0018, substeps: 4 },
    movement: { radius: .38, jog: .67, turnLoss: .46, recoverySeconds: .65, sprintDrain: .012, recoveryRate: .007 },
    actions: { reach: .95, preparationTicks: 7, recoveryTicks: 20, touchTicks: 10, tackleReach: 1.4, headerHeight: 2.25, error: .075 },
    ai: { cadence: 6, transitionTicks: 120, passDistance: 29, shotDistance: 26, hysteresis: 1.4 },
    rules: { restartTicks: 60, celebrationTicks: 90, halftimeTicks: 120, offside: true, fouls: true },
    goalkeeper: { radius: 4, lateral: 2.5, speed: 2, reach: 1.2, reactionTicks: 12, releaseTicks: 10 },
    ...options,
  };
}
