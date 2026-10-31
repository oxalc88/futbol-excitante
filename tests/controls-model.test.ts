import test from 'node:test';
import assert from 'node:assert/strict';
import { controlsTab, keyLabel, glyphLabel, defaultControlsTab, ROW_TEXT, SOUND_KEY } from '../src/browser/controls-model';
import { PES_2017_PS4_ROWS, KEEPER_SWITCH } from '../src/browser/pad-presets';
import { TOUCH_GLYPHS, TOUCH_KEEPER_COMBO } from '../src/adapters/touch-pad';

const entries=(tab:'keyboard'|'pad'|'touch')=>controlsTab(tab).flatMap(s=>s.entries);
const find=(tab:'keyboard'|'pad'|'touch',id:string)=>entries(tab).find(e=>e.id===id)!;

test('every preset row has a model entry and every rendered row has a code source',()=>{
  assert.equal(PES_2017_PS4_ROWS.length,46);
  assert.deepEqual(Object.keys(ROW_TEXT).sort(),PES_2017_PS4_ROWS.map(r=>r.id).sort());
  const allowed=new Set([...PES_2017_PS4_ROWS.map(r=>r.id),'cornerAttack','cornerDefence','keeperSwitch','keeperDive','sound','touchSecondTaker','touchPause']);
  for(const tab of ['keyboard','pad','touch'] as const)for(const e of entries(tab))assert.ok(allowed.has(e.id),`${tab}: ${e.id}`);
  const used=new Set(PES_2017_PS4_ROWS.map(row=>row.id));for(const id of Object.keys(ROW_TEXT))assert.ok(used.has(id),`unused gesture/model row: ${id}`);
  for(const row of Object.values(ROW_TEXT))if(row.gesture)assert.ok(PES_2017_PS4_ROWS.some(preset=>preset.id in ROW_TEXT&&ROW_TEXT[preset.id]===row),`gesture has no preset row: ${row.label}`);
});

test('keyboard rows show each preset key in its player cell',()=>{
  const hidden=new Set(['crossHigh','manualSwitch','cornerStrategy']);
  for(const row of PES_2017_PS4_ROWS){
    if(hidden.has(row.id))continue;
    const entry=find('keyboard',row.id);assert.ok(entry,`${row.id} missing from keyboard`);
    const source=row.keys;
    for(const code of source.p1)assert.ok(entry.cells[0].includes(keyLabel(code)),`${row.id} J1 missing ${code}`);
    for(const code of source.p2)assert.ok(entry.cells[1].includes(keyLabel(code)),`${row.id} J2 missing ${code}`);
  }
  for(const row of PES_2017_PS4_ROWS)for(const code of [...row.keys.p1,...row.keys.p2])assert.ok(keyLabel(code));
  for(const code of [...KEEPER_SWITCH.keys.p1,...KEEPER_SWITCH.keys.p2])assert.ok(keyLabel(code));
  assert.equal(find('keyboard','switchPlay').cells[0],'W A S D a la otra banda + I');
  assert.equal(find('keyboard','switchPlay').cells[1],'↑ ↓ ← → a la otra banda + Num 5');
  assert.equal(find('keyboard','sound').cells[0],'M');
});

test('pad rows include each preset glyph and show the PES gestures',()=>{
  for(const row of PES_2017_PS4_ROWS){
    if(row.id==='crossHigh'||row.id==='cornerStrategy')continue;
    const entry=find('pad',row.id);assert.ok(entry,`${row.id} missing from pad`);
    for(const glyph of row.glyphs)assert.ok(entry.cells[0].includes(glyphLabel(glyph)),`${row.id} missing ${glyph}`);
  }
  assert.equal(find('pad','standingTackle').cells[0],'✕ ×2');
  assert.equal(find('pad','keeperDive').cells[0],'✕');
  assert.equal(find('pad','switchPlay').cells[0],'Stick izq. a la otra banda + ○');
});

test('touch tab shows only supported controls and both touch-only actions',()=>{
  const all=entries('touch');
  assert.ok(find('touch','keeperSwitch').cells[0].includes(TOUCH_KEEPER_COMBO.join(' + ')));
  assert.ok(find('touch','touchSecondTaker').cells[0].includes('L2'));
  assert.ok(find('touch','touchPause').cells[0].includes('Ⅱ'));
  assert.ok(find('touch','keeperDive').cells[0].includes('✕'));
  const text=all.flatMap(e=>[e.label,...e.cells]).join(' ');
  assert.doesNotMatch(text,/L3|R3|OPTIONS|Stick der\.|[↑↓←→]/);
  assert.ok(all.every(e=>e.cells.every(c=>!c.match(/(?:✕|○|□|△|R1|R2|L1|L2)/g)||[...c.matchAll(/✕|○|□|△|R1|R2|L1|L2/g)].every(m=>(TOUCH_GLYPHS as readonly string[]).includes(m[0])))));
});

test('corner strategies use the direction rules and omit the unused defending down key',()=>{
  const attack=find('pad','cornerAttack').cells[0],defence=find('pad','cornerDefence').cells[0];
  assert.match(attack,/↑.*↓.*←.*→/);assert.doesNotMatch(defence,/↓/);
  assert.equal(find('keyboard','cornerAttack').cells[0],'1 rápido\n2 1.er palo\n3 en línea\n4 2.º palo');
  assert.equal(find('keyboard','cornerDefence').cells[0],'1 mixta\n3 al hombre\n4 zonal');
  assert.equal(find('keyboard','cornerDefence').cells[1],'Num / mixta\nNum - al hombre\nNum + zonal');
  assert.equal(entries('touch').some(e=>e.id.startsWith('corner')),false);
});

test('key labels, group names, and selected tab follow the device',()=>{
  assert.equal(keyLabel('Digit1'),'1');assert.equal(keyLabel('Numpad1'),'Num 1');assert.equal(keyLabel('NumpadDivide'),'Num /');
  assert.equal(keyLabel('NumpadMultiply'),'Num *');assert.equal(keyLabel('NumpadSubtract'),'Num -');assert.equal(keyLabel('NumpadAdd'),'Num +');
  assert.equal(keyLabel('ShiftLeft'),'Shift izq.');assert.equal(keyLabel('ShiftRight'),'Shift der.');assert.equal(keyLabel('ArrowDown'),'↓');assert.equal(keyLabel('Escape'),'Esc');
  assert.throws(()=>keyLabel('Unknown'),/unknown key code/);assert.equal(SOUND_KEY,'KeyM');
  assert.equal(defaultControlsTab(true,0),'touch');assert.equal(defaultControlsTab(false,1),'pad');assert.equal(defaultControlsTab(false,0),'keyboard');
  assert.equal(find('keyboard','shoulderCharge').cells[0],'Automático');
  assert.equal(ROW_TEXT.simulateDive.label,'Simular falta');
  const labels=Object.values(ROW_TEXT).map(row=>row.label).join(' ');
  assert.doesNotMatch(labels,/Portero|Penalti/);
});
