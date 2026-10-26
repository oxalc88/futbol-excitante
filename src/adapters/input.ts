import type { ActionKind, InputFrame, TeamIndex, Vec2 } from '../contracts/types';
import { ControllerMapper } from './controller';
import { TouchPad, type TouchContext } from './touch-pad';
import { KEYBOARD_MAP, KEYBOARD_MOVE, PES_2017_PS4_ROWS, pesHeader, TACKLE_TAP_TICKS, type KeyRole } from '../browser/pad-presets';
import { clamp, length, unit } from '../simulation/math';
// The keeper switch has no preset row. Keep the FE keys.
const KEEPER_KEYS=['KeyR','Numpad8'] as const;
// Keyboard window of the ✕ ×2 tackle tap: the same time as on the pad.
const TAP_MS=TACKLE_TAP_TICKS*1000/60;
// Charge key per slot: player 1 owns slot 0 and player 2 owns slot 1.
const chargeSlot=new Map<string,0|1>();
for(const [slot,player] of [[0,'p1'],[1,'p2']] as const)for(const [code,role] of Object.entries(KEYBOARD_MAP[player]))if(role.charge)chargeSlot.set(code,slot);
const chargeCodes=new Set(chargeSlot.keys());
const firstCharge=(player:'p1'|'p2')=>Object.keys(KEYBOARD_MAP[player]).find(code=>KEYBOARD_MAP[player][code].charge)??'';
/** Codes that hold the switch key (L1 on the pad). */
const switchHeld=(roles:Readonly<Record<string,KeyRole>>,keys:Set<string>)=>Object.entries(roles).some(([code,role])=>role.switchPlayer&&keys.has(code));
/** Codes that play pass or cross (✕ and ○ on the pad). */
const passOrCrossHeld=(roles:Readonly<Record<string,KeyRole>>,keys:Set<string>)=>Object.entries(roles).some(([code,role])=>(role.attack==='pass'||role.attack==='cross')&&keys.has(code));
/** Keyboard keys of a preset row for one player, read by row id. */
const presetKeys=(id:string,player:'p1'|'p2'):readonly string[]=>PES_2017_PS4_ROWS.find(row=>row.id===id)?.keys[player]??[];
/** State of the ball and of the cursor that the match shell reads each frame. */
export interface DefendingState{ball:{lastTouch:{team:TeamIndex}|null};selected:[string|null,string|null];carrier:string|null}
/**
 * A team defends while the ball has no touch of that team. A restart resets the
 * last touch, so the taker uses the attack keys. With no touch both teams attack.
 * The selected keeper with the ball at his feet is the carrier of his team, so his
 * team attacks as well: after a put-down the pass key gives a normal pass.
 */
export function defendingFlags(s:DefendingState):[boolean,boolean]{
  const owner=s.ball.lastTouch?s.ball.lastTouch.team:null;
  const carries=(slot:0|1)=>s.carrier!==null&&s.selected[slot]===s.carrier;
  return [(owner!==null&&owner!==0)&&!carries(0),(owner!==null&&owner!==1)&&!carries(1)];
}
export class BrowserInput {
  private keys=new Set<string>();private edges=new Set<string>();private releases=new Map<string,number>();private charges=new Map<string,number>();
  private controller=new ControllerMapper();
  // A team defends while the ball has no touch of that team. Default: attack keys.
  private defending:[boolean,boolean]=[false,false];
  // Header row: set by the match shell when the ball is at head height.
  private aerial:[boolean,boolean]=[false,false];
  // Keeper cursor: set by the match shell when the slot drives the goalkeeper.
  private keeper:[boolean,boolean]=[false,false];
  // Keeper hold: set by the match shell when the keeper of the slot holds the ball.
  private keeperHold:[boolean,boolean]=[false,false];
  // Set piece of the slot: kind, attacking or defending, or null when in play.
  private restart:[{kind:string,attacking:boolean}|null,{kind:string,attacking:boolean}|null]=[null,null];
  private setSpent=new Set<string>();private setPanenka=new Set<string>();private setRoll=new Set<string>();private fixedAim:[Vec2|null,Vec2|null]=[null,null];
  // Charge start of the keyboard volley punt (kick key) per code, -1 when the feint spent it.
  private punt=new Map<string,number>();
  // Millisecond time of the last defending tackle key tap, or -1 when disarmed.
  private tackleTap=[-1,-1];
  // On-screen PS-style touch pad: one virtual gamepad reading for slot 0.
  readonly touch=new TouchPad();
  private touchOn=false;
  private aim:Vec2[]=[{x:1,y:0},{x:-1,y:0}];
  private lastTick=-1;private directions:[number,number]=[1,-1];
  enabled=false;
  constructor(){
    // The keeper hold wins over the header row. With the ball in the hands the
    // □ key charges at head height too, as the charge of the pad does.
    window.addEventListener('keydown',e=>{if(!this.enabled||this.isEditing(e.target))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!this.keys.has(e.code)){this.edges.add(e.code);const slot=chargeSlot.get(e.code);const setSlot=([0,1] as const).find(i=>this.restart[i]?.attacking&&this.restart[i]?.kind!=='kickoff'&&['setPower','setFeint','shortRoll'].some(id=>presetKeys(id,i===0?'p1':'p2').includes(e.code)));if(setSlot!==undefined||slot===undefined||!this.aerial[slot]||this.keeper[slot]&&this.keeperHold[slot])this.charges.set(e.code,performance.now());if(setSlot!==undefined){const player=setSlot===0?'p1':'p2',second=presetKeys('secondTaker',player)[0];if(this.restart[setSlot]?.kind==='penalty'&&this.keys.has(second)&&presetKeys('panenka',player).includes(e.code))this.setPanenka.add(e.code);if(this.keys.has(second)&&presetKeys('shortRoll',player).includes(e.code))this.setRoll.add(e.code);}}this.keys.add(e.code);});
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);const start=this.charges.get(e.code);if(start!==undefined){if(!this.setSpent.has(e.code))this.releases.set(e.code,clamp((performance.now()-start)/850,.15,1));this.charges.delete(e.code);}else this.setSpent.delete(e.code);});
    window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  }
  private isEditing(target:EventTarget|null){return target instanceof HTMLElement && (['INPUT','SELECT','TEXTAREA'].includes(target.tagName)||target.isContentEditable);}
  setDirections(d:[number,number]){if(d[0]!==this.directions[0]){this.aim=[{x:d[0],y:0},{x:d[1],y:0}];}this.directions=d;}
  /** The match shell sets the state of both teams from the ball. */
  setDefending(flags:[boolean,boolean]){this.defending=[...flags];
    // The attack context disarms the armed tackle tap, as the pad path does.
    for(const slot of [0,1] as const)if(!flags[slot])this.tackleTap[slot]=-1;}
  /** The match shell sets the head-height band of the ball for both teams. */
  setAerial(flags:[boolean,boolean]){this.aerial=[...flags];}
  /** The match shell sets the goalkeeper cursor of both teams. */
  setKeeper(flags:[boolean,boolean]){this.keeper=[...flags];}
  /** The match shell sets the ball-in-hands state of both keepers. */
  setKeeperHold(flags:[boolean,boolean]){this.keeperHold=[...flags];}
  /** The match shell sets the set piece of both slots, or null when in play. */
  setRestart(r:[{kind:string,attacking:boolean}|null,{kind:string,attacking:boolean}|null]){for(const slot of [0,1] as const)if(this.restart[slot]?.kind!==r[slot]?.kind||this.restart[slot]?.attacking!==r[slot]?.attacking)this.fixedAim[slot]=null;this.restart=[...r];}
  /** Drops every held key, edge, charge and release, every set-piece flag and
   * the whole touch pad, so no pending state can fire after a reset. */
  clear(){this.keys.clear();this.edges.clear();this.charges.clear();this.releases.clear();this.setSpent.clear();this.setPanenka.clear();this.setRoll.clear();this.fixedAim=[null,null];this.punt.clear();this.tackleTap=[-1,-1];this.aerial=[false,false];this.keeper=[false,false];this.keeperHold=[false,false];this.restart=[null,null];this.controller.reset();this.touch.clear();this.lastTick=-1;}
  /** Shows or hides the on-screen touch pad. A change drops every held touch.
   * The physical pads keep their slots: the touch reading takes slot 0 only. */
  setTouchActive(on:boolean){if(on===this.touchOn)return;this.touchOn=on;this.touch.clear();if(on)this.controller.stashSlots();else this.controller.restoreSlots();}
  get touchActive(){return this.touchOn;}
  /** Pad readings of this sample. The touch reading comes first, so it owns slot 0. */
  private pads(){return this.touchOn?[this.touch.reading(true),...this.gamepads]:this.gamepads;}
  /** Label row of the touch buttons for the game state of one slot. */
  context(slot:TeamIndex):TouchContext{const keeper=this.keeper[slot],hold=keeper&&this.keeperHold[slot];return{defending:this.defending[slot],aerial:this.aerial[slot],keeper,hold};}
  pauseRequested(){return this.controller.pauseRequested(this.pads());}
  cameraRequested(){return this.controller.cameraRequested(this.pads());}
  // Keyboard charge first: the set-piece keys of an attack restart, else the shot
  // key. With no key held the touch pad reads the mapper charge of slot 0.
  get charging(){const codes=this.restart[0]?.attacking?[...presetKeys('setPower','p1'),...presetKeys('setFeint','p1'),...presetKeys('shortRoll','p1')]:[firstCharge('p1')];const starts=codes.map(c=>this.charges.get(c)).filter((v):v is number=>v!==undefined);if(starts.length)return clamp((performance.now()-Math.min(...starts))/850,0,1);return this.touchOn?this.controller.chargeLevel(0):0;}
  get gamepads(){return Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p&&p.connected);}
  /** Set-piece chords of the keyboard rows, read by the set-piece row ids of the preset. */
  private setPieceFlags(slot:TeamIndex,player:'p1'|'p2',movement:Vec2,moveActive:boolean):Partial<InputFrame>{
    const sp=this.restart[slot];if(!sp)return{};
    const keys=(id:string)=>presetKeys(id,player);
    const held=(id:string)=>keys(id).some(c=>this.keys.has(c));
    const edge=(id:string)=>keys(id).some(c=>this.edges.has(c));
    const second=keys('secondTaker')[0]??'',cross=keys('shortRoll')[0]??'',move=keys('move'),f:Partial<InputFrame>={};
    if(sp.attacking){
      if([...keys('setPower'),...keys('setFeint'),...keys('shortRoll')].some(c=>this.releases.has(c)))f.setKick=true;
      if(this.keys.has(second)){
        if(move[0]&&this.edges.has(move[0]))f.secondTaker='side';
        else if(move[1]&&this.edges.has(move[1]))f.secondTaker='behind';
      }
      if(held('secondTakerKick'))f.secondKick=true;
      if((sp.kind==='free-kick'||sp.kind==='indirect')&&held('setFeint')&&cross&&this.edges.has(cross)){f.setFeint=true;f.setKick=undefined;for(const code of [...keys('setFeint'),...keys('shortRoll')]){if(this.keys.has(code))this.setSpent.add(code);this.charges.delete(code);this.releases.delete(code);}}
      if(this.keys.has(second)&&cross&&this.edges.has(cross))this.setRoll.add(cross);
      if(sp.kind==='penalty'&&this.keys.has(second)&&edge('panenka'))for(const code of keys('panenka'))if(this.keys.has(code))this.setPanenka.add(code);
      if(cross&&this.releases.has(cross)&&this.setRoll.has(cross))f.shortRoll=true;
      if(sp.kind==='penalty'&&[...keys('panenka')].some(c=>this.releases.has(c)&&this.setPanenka.has(c)))f.panenka=true;
    }else{
      const wallHold=keys('wallHold')[0]??'';
      if(edge('wallJump')&&!(wallHold&&this.keys.has(wallHold)))f.wallJump=true;
      const chargeCode=keys('wallCharge').find(c=>this.keys.has(c));
      if(chargeCode!==undefined){const start=this.charges.get(chargeCode);if(start!==undefined)f.wallCharge=clamp((performance.now()-start)/850,0,1);}
      if((held('setKeeperMove')||sp.kind==='penalty')&&moveActive)f.keeperMove={...movement};
    }
    if(sp.kind==='corner')for(const [code,dir] of [[move[0],'up'],[move[1],'down'],[move[2],'left'],[move[3],'right']] as const)if(code&&this.edges.has(code)){f.cornerSide=dir;break;}
    return f;
  }
  sample(tick:number,slot:TeamIndex):InputFrame {
    if(!this.enabled)return{tick,slot,move:{x:0,y:0},aim:this.aim[slot],sprint:false,shield:false};
    this.lastTick=tick;
    const player: 'p1'|'p2' = slot===0?'p1':'p2';
    const move=KEYBOARD_MOVE[player],roles=KEYBOARD_MAP[player],restart=this.restart[slot]?.kind==='kickoff'?null:this.restart[slot],defending=restart?false:this.defending[slot],aerial=restart?false:this.aerial[slot],keeper=this.keeper[slot],keeperHold=this.keeperHold[slot];
    // The ball is in the keeper hands: the keeper row uses the throw and kick
    // gestures in every context instead of the dive and the header row.
    const hold=keeper&&keeperHold;
    // A stale tap never survives into the header row, and, at head height without
    // the hold, □ skips its shot charge, so the hold queues no release.
    if(aerial){this.tackleTap[slot]=-1;if(!hold)for(const code of Object.keys(roles))if(chargeCodes.has(code)){this.charges.delete(code);this.releases.delete(code);}}
    // The attack context disarms the armed tap too, as the pad path does.
    if(!defending)this.tackleTap[slot]=-1;
    let movement={x:Number(this.keys.has(move[3]))-Number(this.keys.has(move[2])),y:Number(this.keys.has(move[1]))-Number(this.keys.has(move[0]))};
    const moveActive=length(movement)>.1;
    // Set-piece chords read before the main loop consumes the key edges.
    const setPiece=this.setPieceFlags(slot,player,movement,moveActive);
    let sprint=false,shield=false,action:ActionKind|undefined,power=.55,switchPlayer=false;
    let keeperRush=false,keeperDrop=false,keeperFeint=false,simulateDive=false,keeperKick:'punt'|'high'|undefined;
    const highHeld=Object.entries(roles).some(([code,role])=>role.keeperHigh&&this.keys.has(code));
    // Keeper volley punt: hold the kick key with the ball in the hands to charge
    // power, release to kick. The pass feint spends the charge (value -1).
    for(const [code,role] of Object.entries(roles)){
      if(!role.keeperKick)continue;
      const start=this.punt.get(code);
      if(this.keys.has(code)){
        if(hold&&start===undefined)this.punt.set(code,performance.now());
        else if(!hold&&start!==undefined)this.punt.delete(code);
      }else if(start!==undefined){
        this.punt.delete(code);
        if(start>=0&&hold){keeperKick=highHeld?'high':'punt';power=clamp((performance.now()-start)/850,.15,1);}
      }
    }
    // The release that a ✕ press can feint: the ○ punt charge, the □ charge, or
    // any other pass button held down (△ throw into space and the ○ high pass).
    // The ✕ key is the feint key itself, so its own hold never counts: the edge
    // of ✕ while ✕ is held cannot exist, and counting it would stop every throw.
    const passHeld=Object.entries(roles).some(([code,role])=>(role.attack==='through'||role.attack==='cross'||role.keeperKick)&&this.keys.has(code));
    const kickChargeHeld=hold&&(passHeld
      ||Object.entries(roles).some(([code,role])=>role.keeperKick&&this.punt.has(code)&&this.punt.get(code)!==-1)
      ||Object.entries(roles).some(([code,role])=>role.charge&&this.keys.has(code)&&this.charges.has(code)));
    // The run-out key held: its chord with R1 is the sprint rush, never a drop.
    const rushKeyHeld=Object.entries(roles).some(([code,role])=>role.keeperRush&&this.keys.has(code));
    // The keeper row wins over the header row: with the cursor on the keeper the
    // defense keys stay live at head height, so one press of the tackle key dives.
    const dive=keeper&&(defending||aerial)&&!hold;
    for(const [code,role] of Object.entries(roles)){
      if(role.sprint&&this.keys.has(code))sprint=true;
      // At head height the key plays the header with or without the ball, except
      // for the keeper, that keeps its own row. The holder keeps the attack keys.
      const kind=restart?.attacking?role.attack:dive?role.defense:hold?role.attack:aerial?(role.attack??role.defense):(defending?role.defense:role.attack);
      const edge=this.edges.delete(code);
      // R1 with the stick released puts the held ball down or picks a low ball up.
      if(role.sprint&&edge&&keeper&&!moveActive&&!rushKeyHeld)keeperDrop=true;
      // Hold △ without the ball: the run-out to the ball.
      if(role.keeperRush&&keeper&&!hold&&this.keys.has(code))keeperRush=true;
      // Foul dive: one press of its own key, for the selected player.
      if(role.simulateDive&&edge)simulateDive=true;
      if(role.charge&&kind==='shoot'&&(!aerial||hold)){
        // Hold to charge power. The release fires the shot or the clearance.
        const release=this.releases.get(code);
        if(release!==undefined){action='shoot';power=release;this.releases.delete(code);}
        continue;
      }
      if(restart?.attacking&&(kind==='pass'||kind==='cross')){
        const release=this.releases.get(code);
        if(release!==undefined){action=kind;power=release;this.releases.delete(code);}
        continue;
      }
      if(!edge)continue;
      // L1 (switch key) + ○ (cross key) plays the lob, as in the PES table.
      if(role.switchPlayer&&!restart&&!passOrCrossHeld(roles,this.keys))switchPlayer=true;
      // The keeper □ key stays a clearance key: at head height it charges nothing
      // and never heads.
      if(dive&&kind==='shoot')continue;
      // Header row: □, ✕, △ and ○ head the ball, so □ skips its shot charge.
      // The keeper row wins over it, so no key of the keeper heads the ball.
      if(aerial&&kind&&!dive&&!hold){action='header';continue;}
      // Pressure is a missing mechanic (phase 2), so the first tap arms the
      // tackle and the second tap inside the window fires it. The goalkeeper
      // dives on one press of the same key, as before the preset.
      if(kind==='tackle'){
        if(keeper){this.tackleTap[slot]=-1;action='tackle';continue;}
        const now=performance.now();
        if(this.tackleTap[slot]>=0&&now-this.tackleTap[slot]<=TAP_MS){action='tackle';this.tackleTap[slot]=-1;}
        else this.tackleTap[slot]=now;
        continue;
      }
      // Pass feint: press ✕ while a throw or kick charge is held, before release.
      // The charge is spent, so no ball leaves the hands.
      if(kind==='pass'&&hold&&kickChargeHeld){
        keeperFeint=true;
        for(const [chargeCode,role2] of Object.entries(roles))if(role2.charge){this.charges.delete(chargeCode);this.releases.delete(chargeCode);}
        for(const [chargeCode] of Object.entries(roles))if(this.punt.has(chargeCode))this.punt.set(chargeCode,-1);
        continue;
      }
      // While the ball is in the hands ○ charges the punt, never a cross.
      // A feint in this sample wins over the pass edge of the same sample.
      if(kind&&!keeperFeint&&!(hold&&role.keeperKick))action=(kind==='cross'&&switchHeld(roles,this.keys))?'lob':kind;
    }
    let switchKeeper=this.edges.delete(KEEPER_KEYS[slot]);
    // A cancelled touch pointer must not fire its pending release: drop the
    // charge, the set-piece state and the previous state of slot 0 before the
    // mapper samples.
    if(this.touch.takeCancelled())this.controller.discardCharge();
    const pad=this.controller.sample(this.pads(),tick,slot,defending,aerial,keeper,hold,restart);
    if(length(pad.move)>.1)movement=pad.move;
    sprint||=pad.sprint;shield||=pad.shield;switchPlayer||=pad.switchPlayer;switchKeeper||=pad.switchKeeper;
    if(pad.action){action=pad.action;power=pad.power;}
    if(pad.keeperRush)keeperRush=true;
    if(pad.keeperDrop)keeperDrop=true;
    if(pad.keeperFeint)keeperFeint=true;
    if(pad.simulateDive)simulateDive=true;
    if(pad.keeperKick){keeperKick=pad.keeperKick;power=pad.power;}
    // Header row: at head height □ or a pass button heads the ball. The holder
    // of the ball keeps its own row.
    if(action)action=pesHeader(action,aerial&&!hold);
    if(length(movement)>1)movement=unit(movement);
    const fixed=restart&&(presetKeys('setFix',player).some(c=>this.keys.has(c))||pad.setFix);
    if(!fixed){this.fixedAim[slot]=null;if(length(movement)>.1)this.aim[slot]=unit(movement);if(pad.aim)this.aim[slot]=pad.aim;}
    else if(!this.fixedAim[slot])this.fixedAim[slot]={...this.aim[slot]};
    const frame:InputFrame={tick,slot,move:movement,aim:{...(this.fixedAim[slot]??this.aim[slot])},sprint,shield,action,power,switchPlayer,switchKeeper,...setPiece};
    for(const name of ['setKick','secondTaker','secondKick','setFeint','shortRoll','panenka','wallJump','wallCharge','keeperMove','cornerSide'] as const)if(pad[name]!==undefined)(frame as any)[name]=pad[name];
    for(const code of [...presetKeys('panenka',player),...presetKeys('shortRoll',player)])if(!this.keys.has(code)&&!this.releases.has(code)){this.setPanenka.delete(code);this.setRoll.delete(code);}
    if(keeperRush)frame.keeperRush=true;
    if(keeperKick)frame.keeperKick=keeperKick;
    if(keeperDrop)frame.keeperDrop=true;
    if(keeperFeint)frame.keeperFeint=true;
    if(simulateDive)frame.simulateDive=true;
    return frame;
  }
}
