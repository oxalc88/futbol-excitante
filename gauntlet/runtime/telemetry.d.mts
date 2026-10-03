export interface TelemetryIdentity { sessionId: string; role: string; model: string; objectiveId: string | null; profile: string }
export interface TelemetryEvent extends TelemetryIdentity { id: string; at: number; type: string; data: Record<string, any> }
export function appendTelemetry(root: string, identity: TelemetryIdentity, type: string, data?: Record<string, any>, now?: number): TelemetryEvent;
export function readTelemetry(root: string): TelemetryEvent[];
export function summarizeTelemetry(events: TelemetryEvent[]): any;
