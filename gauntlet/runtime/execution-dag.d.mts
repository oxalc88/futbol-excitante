import type { QualityCheck } from './product-quality.js';
export interface ExecutionUnit { id:string; purpose:string; dependencies:string[]; expected_file_ownership:string[]; builder_role:string; local_checks:QualityCheck[]; handoff_contract:string; interfaces_known:boolean }
export interface ExecutionPlan { schema_version:1; objective_id:string; base_commit?:string; issue_number:number; units:ExecutionUnit[] }
export function validateExecutionPlan(plan:ExecutionPlan):string[];
export function executableUnits(plan:ExecutionPlan,completed?:string[],running?:string[]):{ready:string[];integration_order:string[];all_complete:boolean};
export function validateUnitBatch(plan:ExecutionPlan,tasks:Array<{unit_id:string;objective_id:string;agent:string;isolated:boolean}>,completed?:string[],running?:string[]):boolean;
