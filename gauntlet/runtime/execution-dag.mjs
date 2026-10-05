import { ownershipOverlaps } from '../../scripts/gauntlet/parallel-policy.mjs';
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
export function validateExecutionPlan(plan) {
  if(plan?.schema_version!==1 || !id(plan.objective_id) || !Number.isSafeInteger(plan.issue_number) || plan.issue_number<1 || !Array.isArray(plan.units) || !plan.units.length)throw new Error('one product issue and execution DAG required');
  const ids=new Set();
  for(const u of plan.units){
    if(!id(u.id)||ids.has(u.id)||!u.purpose?.trim()||!['builder-gameplay','builder-structured'].includes(u.builder_role)||!Array.isArray(u.dependencies)||!Array.isArray(u.expected_file_ownership)||!u.expected_file_ownership.length||u.expected_file_ownership.some(p=>typeof p!=='string'||p.startsWith('/')||p.includes('..')||p.includes('\\')||/^gauntlet\/(?:state|incidents|certification|execution)\//.test(p))||!Array.isArray(u.local_checks)||!u.local_checks.length||new Set(u.dependencies).size!==u.dependencies.length||new Set(u.local_checks.map(c=>c.id)).size!==u.local_checks.length||u.local_checks.some(c=>!id(c.id)||!Array.isArray(c.command)||!c.command.length||c.command.some(a=>typeof a!=='string'||!a.length))||!u.handoff_contract?.trim())throw new Error('invalid execution unit');
    ids.add(u.id);
  }
  const sorted=[],visiting=new Set(),done=new Set();
  const visit=u=>{if(done.has(u.id))return;if(visiting.has(u.id))throw new Error('execution DAG cycle');visiting.add(u.id);for(const d of u.dependencies){const dependency=plan.units.find(v=>v.id===d);if(!dependency)throw new Error('unknown execution dependency');visit(dependency);}visiting.delete(u.id);done.add(u.id);sorted.push(u.id);};
  plan.units.forEach(visit);return sorted;
}
/** Determine readiness/ownership only. Harness owns worker start, settlement, worktrees and retries. */
export function executableUnits(plan, completed=[], running=[]) {
  const order=validateExecutionPlan(plan),ids=new Set(order);
  if([...completed,...running].some(i=>!ids.has(i))||new Set([...completed,...running]).size!==completed.length+running.length)throw new Error('invalid execution settlement');
  const occupied=running.map(i=>plan.units.find(u=>u.id===i)),ready=[];
  for(const i of order){const u=plan.units.find(v=>v.id===i);if(completed.includes(i)||running.includes(i)||u.dependencies.some(d=>!completed.includes(d))||u.interfaces_known!==true)continue;
    if(occupied.some(v=>u.expected_file_ownership.some(a=>v.expected_file_ownership.some(b=>ownershipOverlaps(a,b)))))continue;
    ready.push(i);occupied.push(u); // Conflicts serialize deterministically in topological plan order.
  }
  return {ready,integration_order:order,all_complete:completed.length===plan.units.length};
}
export function validateUnitBatch(plan, tasks, completed=[], running=[]) {
  const ready=executableUnits(plan,completed,running).ready,seen=new Set();
  for(const task of tasks){const unit=plan.units.find(u=>u.id===task.unit_id);
    if(!unit||seen.has(task.unit_id)||!ready.includes(task.unit_id)||task.objective_id!==plan.objective_id||task.agent!==unit.builder_role||task.isolated!==true)throw new Error('DAG task requires ready unit, correct parent/role and isolated workspace');seen.add(task.unit_id);
  }
  return true;
}
