export interface RuntimeConfiguration { profile: string; enabled: string[]; baseline_report?: string }
export function readRuntimeConfiguration(root: string): RuntimeConfiguration;
