import { continuationDecision, type ContinuationFacts } from '../../runtime/continuation.js';
export const GAUNTLET_STOP_REASONS = ['human_needed_spec','human_needed_legal','verification_blocked','credentials_resources','perceptual_route','explicit_external_decision'] as const;
export type GauntletStopReason = (typeof GAUNTLET_STOP_REASONS)[number];
export interface StopEvidence {
  verification_blocked?:boolean; safe_objective_available?:boolean; environment_decision_required?:boolean;
  exact_decision_required?:string; incident_id?:string; autonomous_actions_attempted?:string[]; evidence?:ContinuationFacts['evidence'];
}
/** Scenario compatibility adapter. All stop eligibility lives in continuation.ts. */
export function isAllowedStopReason(value:unknown,e:StopEvidence={}):value is GauntletStopReason {
  const kind=value==='human_needed_spec'?'specification':value==='human_needed_legal'?'legal':value==='verification_blocked'?'environment_execution_policy':value;
  if(!['specification','legal','environment_execution_policy','credentials_resources','perceptual_route','explicit_external_decision'].includes(String(kind)))return false;
  if(kind==='environment_execution_policy'&&(!e.verification_blocked||e.safe_objective_available!==false||!e.environment_decision_required))return false;
  try {return continuationDecision({blocked_boundary:e.verification_blocked?'verification':null,failure_class:'UNKNOWN',incident_id:e.incident_id??null,preserved_progress:[],certification_debt:0,safe_work_considered:e.safe_objective_available?[{id:'safe',executable:true,reason:'scenario'}]:[],routine_action:null,autonomous_actions_attempted:e.autonomous_actions_attempted??[],repair_available:false,engineering_escalation_available:false,engineering_escalation_attempted:true,evidence:e.evidence??[],external_decision:{kind:kind as NonNullable<ContinuationFacts['external_decision']>['kind'],exact_decision_required:e.exact_decision_required??''}}).stop;}catch{return false;}
}
