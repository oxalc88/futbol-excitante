import { describe, expect, it } from 'vitest';
import { admitsCurrentVerification, evaluateBureaucracy, verificationMaterial, ZERO_BURDEN } from '../../../gauntlet/runtime/bureaucracy.js';

describe('Gauntlet 0.14 bureaucracy regression invariants', () => {
  it('does not let bookkeeping manufacture another verification execution', () => {
    expect(verificationMaterial(['gauntlet/incidents/x/000001.json','gauntlet/certification/1.json']).administrative_only).toBe(true);
    expect(admitsCurrentVerification('UNKNOWN',['gauntlet/incidents/x/000001.json'])).toBe(false);
  });

  it('permits a materially changed current state without resetting history', () => {
    expect(admitsCurrentVerification('PRODUCT_FAILURE',['src/simulation/loop.ts'])).toBe(true);
    expect(admitsCurrentVerification('PRODUCT_FAILURE',['tests/unit/example.test.ts'])).toBe(false);
    expect(admitsCurrentVerification('HARNESS_ENVIRONMENT',['gauntlet/runtime/scoped-quality-command.ts'])).toBe(true);
    expect(admitsCurrentVerification('UNKNOWN',['eval/oracles/example.ts'])).toBe(true);
  });

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
