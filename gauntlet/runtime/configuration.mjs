import { readFileSync } from 'node:fs';
import path from 'node:path';
export const CAPABILITIES = ['memory', 'context', 'checkpoints', 'rotation', 'verification'];
export function readRuntimeConfiguration(root) {
  const file = path.join(root,'.delivery-local','efficiency.json');
  let config;
  try { config = JSON.parse(readFileSync(file,'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {profile:'baseline',enabled:[]}; throw error; }
  if (config.profile !== 'optimized' || !Array.isArray(config.enabled) ||
      config.enabled.some(flag => !CAPABILITIES.includes(flag))) throw new Error('Invalid efficiency configuration');
  if (typeof config.baseline_report !== 'string' || path.isAbsolute(config.baseline_report) || config.baseline_report.split(/[\\/]/).includes('..')) {
    throw new Error('A repository-relative baseline_report is required before enabling optimizations');
  }
  const baseline = JSON.parse(readFileSync(path.join(root,config.baseline_report),'utf8'));
  const measured = baseline.profiles?.find(profile => profile.profile === 'baseline');
  if (baseline.schema !== 'gauntlet-telemetry-v1' || !measured?.coverageComplete ||
      !measured.acceptedObjectives?.length || !(measured.processedInputTokensPerAcceptedObjective > 0)) {
    throw new Error('Optimizations require a complete measured baseline with a remotely accepted objective');
  }
  if (config.enabled.includes('rotation') && !['context','checkpoints'].every(flag => config.enabled.includes(flag))) {
    throw new Error('Rotation requires context and checkpoints');
  }
  return {profile:'optimized',enabled:[...new Set(config.enabled)],baseline_report:config.baseline_report};
}
