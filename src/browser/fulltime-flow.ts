import type { Config, TeamProfile } from '../contracts/types';

export function isFulltime(phase: string): boolean {
  return phase === 'fulltime';
}

/** Keep kickoff data detached from both form edits and the running match. */
export function rematchSetup(config: Config, teams: [TeamProfile, TeamProfile]) {
  return structuredClone({ config, teams });
}
