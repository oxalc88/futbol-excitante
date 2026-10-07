import { describe, expect, it } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { admitsCurrentVerification, evaluateBureaucracy, verificationMaterial, ZERO_BURDEN } from '../../../gauntlet/runtime/bureaucracy.js';
import { fixture } from '../../helpers/gauntlet-quality.js';

describe('Gauntlet 0.14 bureaucracy regression invariants', () => {
  it('does not let bookkeeping manufacture another verification execution', () => {
    expect(verificationMaterial(['gauntlet/incidents/x/000001.json','gauntlet/certification/1.json']).administrative_only).toBe(true);
    expect(admitsCurrentVerification('UNKNOWN',['gauntlet/incidents/x/000001.json'])).toBe(false);
  });

  it('permits a materially changed current state without resetting history', () => {
    expect(admitsCurrentVerification('PRODUCT_FAILURE',['src/simulation/loop.ts'])).toBe(true);
    expect(admitsCurrentVerification('PRODUCT_FAILURE',['tests/unit/example.test.ts'])).toBe(true);
    expect(admitsCurrentVerification('HARNESS_ENVIRONMENT',['gauntlet/runtime/scoped-quality-command.ts'])).toBe(true);
    expect(admitsCurrentVerification('UNKNOWN',['eval/oracles/example.ts'])).toBe(true);
  });

  it('allows one verification per materially changed state without resetting incident history', async () => {
    const { IncidentRecovery }=await import('../../../gauntlet/runtime/incident-recovery.js');
    const { incidentEvents }=await import('../../../gauntlet/runtime/incidents.js');
    const f=fixture(true);try{
      f.write('.delivery-local/quality/OLD/recovery.json',readFileSync(join(process.cwd(),'gauntlet/incidents/legacy-f960b92b26aa53f48ebce68fe6c70896270d1e5f75d051fc9b5fd2a31f4756fc.json'),'utf8'));
      new IncidentRecovery(f.root,'repository/full');
      f.git('add','gauntlet/incidents');f.git('commit','-m','publish imported history');

      f.write('docs/player-controls.md','material player-facing input');
      f.git('add','docs/player-controls.md');f.git('commit','-m','material product input');
      const first=new IncidentRecovery(f.root,'repository/full');
      first.beforeRun(true);
      f.git('add','gauntlet/incidents');f.git('commit','-m','publish first observation');

      f.write('gauntlet/runtime/continuation.ts','material verification input');
      f.git('add','gauntlet/runtime/continuation.ts');f.git('commit','-m','material verification change');
      const second=new IncidentRecovery(f.root,'repository/full');
      expect(()=>second.beforeRun(true)).not.toThrow();
      expect(incidentEvents(f.root).filter(e=>e.kind==='OBSERVE')).toHaveLength(2);
      expect(incidentEvents(f.root).at(-1)?.current_policy).toBe('current-verification-v2');

      f.git('add','gauntlet/incidents');f.git('commit','-m','publish second observation');
      f.write('gauntlet/state/CURRENT.md','bookkeeping only');
      f.git('add','gauntlet/state/CURRENT.md');f.git('commit','-m','bookkeeping only');
      const third=new IncidentRecovery(f.root,'repository/full');
      expect(()=>third.beforeRun(true)).toThrow('RECOVERY_BLOCKED');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);

  it('fails any policy that stops a current green product because of history', () => {
    const result=evaluateBureaucracy({
      current_verification:'PASS',
      historical_incident:true,
      continuation_stop:true,
      deterministic_action_available:false,
      safe_product_work_available:false,
      change_kind:'product',
      product_progress_delta:1,
      candidate:ZERO_BURDEN,
    });
    expect(result.pass).toBe(false);
    expect(result.hard_failures).toContain('GREEN_CURRENT_STATE_MUST_NOT_STOP');
    expect(result.hard_failures).toContain('HISTORY_CANNOT_OVERRIDE_CURRENT_PASS');
  });

  it('forbids human stop while safe deterministic work exists', () => {
    const result=evaluateBureaucracy({
      current_verification:'NOT_RUN',
      historical_incident:true,
      continuation_stop:true,
      deterministic_action_available:true,
      safe_product_work_available:false,
      change_kind:'verification',
      product_progress_delta:0,
      candidate:ZERO_BURDEN,
    });
    expect(result.hard_failures).toContain('SAFE_ACTION_FORBIDS_HUMAN_STOP');
  });

  it('does not count machinery work as product progress and reports burden deltas separately', () => {
    const result=evaluateBureaucracy({
      current_verification:'PASS',
      historical_incident:false,
      continuation_stop:false,
      deterministic_action_available:false,
      safe_product_work_available:true,
      change_kind:'verification',
      product_progress_delta:1,
      baseline:ZERO_BURDEN,
      candidate:{...ZERO_BURDEN,mandatory_commands:2,canonical_writes:1},
    });
    expect(result.hard_failures).toContain('MACHINERY_IS_NOT_PRODUCT_PROGRESS');
    expect(result.burden_delta).toMatchObject({mandatory_commands:2,canonical_writes:1});
  });
});
