import type { Config, CpuDifficulty, TeamIndex } from '../contracts/types';
export const engineVersion = 'engine-v4';
// Fictional design values, VERSIONED_PROVISIONAL. No PES reference calibration.

/** Multipliers of existing CPU parameters. `normal` is 1 in every field. */
export interface CpuTuning { reaction: number; accuracy: number; pressing: number }

// Difficulty tunes only these three CPU parameters. No new AI logic.
export const cpuTunings: Record<CpuDifficulty, CpuTuning> = {
  easy: { reaction: 2, accuracy: 1.5, pressing: .6 },
  normal: { reaction: 1, accuracy: 1, pressing: 1 },
  hard: { reaction: .5, accuracy: .6, pressing: 1.4 },
};

export function isCpuDifficulty(value: unknown): value is CpuDifficulty {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

/** Tuning of a level. A missing or unknown level gives Normal. */
export function cpuTuning(difficulty?: CpuDifficulty): CpuTuning {
  return isCpuDifficulty(difficulty) && difficulty !== 'normal' ? cpuTunings[difficulty] : cpuTunings.normal;
}

/** CPU decision delay in ticks. Normal returns `ai.cadence` unchanged. */
export function cpuReactionTicks(config: Config): number {
  const scale = cpuTuning(config.difficulty).reaction;
  if (scale === 1) return config.ai.cadence;
  return Math.max(1, Math.round(config.ai.cadence * scale));
}

/** Scale of `actions.error`, the pass and shot error. Human teams always keep 1. */
export function cpuErrorScale(config: Config, team: TeamIndex): number {
  return config.human[team] ? 1 : cpuTuning(config.difficulty).accuracy;
}

/** Scale of team pressing. Human teams always keep 1. */
export function cpuPressingScale(config: Config, team: TeamIndex): number {
  return config.human[team] ? 1 : cpuTuning(config.difficulty).pressing;
}

export function createConfig(options: Partial<Pick<Config, 'seed' | 'halfSeconds' | 'teamSize' | 'human' | 'difficulty'>> = {}): Config {
  const config: Config = {
    version: 'vision-rebuild-config-v2', dt: 1/60, halfSeconds: 180, teamSize: 11, seed: 2017, human: [true, false],
    pitch: { length: 105, width: 68, goalWidth: 7.32, goalHeight: 2.44 },
    physics: { radius: .11, gravity: 9.81, rolling: 1.35, drag: .015, restitution: .48, spinDecay: .8, magnus: .0018, substeps: 4 },
    movement: { radius: .38, jog: .67, turnLoss: .46, recoverySeconds: .65, sprintDrain: .012, recoveryRate: .007 },
    actions: { reach: .95, preparationTicks: 7, recoveryTicks: 20, touchTicks: 10, tackleReach: 1.4, headerHeight: 2.25, error: .075 },
    ai: { cadence: 6, transitionTicks: 120, passDistance: 29, shotDistance: 26, hysteresis: 1.4 },
    rules: { restartTicks: 60, celebrationTicks: 90, halftimeTicks: 120, offside: true, fouls: true, advantageTicks: 120, humanRestartTicks: 360, cards: true },
    goalkeeper: { radius: (options.teamSize??11)<11?4:16, lateral: (options.teamSize??11)<11?2.5:15, speed: (options.teamSize??11)<11?2:5.2, reach: 1.2, reactionTicks: 12, releaseTicks: 45, highReach: 2.8, recoveryTicks: 42 },
    ...options,
  };
  // A Normal config carries no difficulty key, so its hash matches the config before difficulty existed.
  if (!isCpuDifficulty(options.difficulty) || options.difficulty === 'normal') delete config.difficulty;
  return config;
}
