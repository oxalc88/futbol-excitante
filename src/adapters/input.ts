import type { ActionKind, InputFrame, TeamIndex, Vec2 } from '../contracts/types';
import { ControllerMapper } from './controller';
import { KEYBOARD_MAP, KEYBOARD_MOVE, pesHeader, TACKLE_TAP_TICKS, type KeyRole } from '../browser/pad-presets';
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
export class BrowserInput {
  private keys=new Set<string>();private edges=new Set<string>();private releases=new Map<string,number>();private charges=new Map<string,number>();
  private controller=new ControllerMapper();
  // A team defends while the ball has no touch of that team. Default: attack keys.
  private defending:[boolean,boolean]=[false,false];
  // Header row: set by the match shell when the ball is at head height.
  private aerial:[boolean,boolean]=[false,false];
  // Keeper cursor: set by the match shell when the slot drives the goalkeeper.
  private keeper:[boolean,boolean]=[false,false];
  // Millisecond time of the last defending tackle key tap, or -1 when disarmed.
  private tackleTap=[-1,-1];
  private touchMove:Vec2={x:0,y:0};private touchActions:ActionKind[]=[];private touchSprint=false;private touchShield=false;private touchCharge:number|null=null;private touchPower=.55;
  private aim:Vec2[]=[{x:1,y:0},{x:-1,y:0}];
  private lastTick=-1;private directions:[number,number]=[1,-1];
  enabled=false;
  constructor(){
    window.addEventListener('keydown',e=>{if(!this.enabled||this.isEditing(e.target))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!this.keys.has(e.code)){this.edges.add(e.code);const slot=chargeSlot.get(e.code);if(slot===undefined||!this.aerial[slot])this.charges.set(e.code,performance.now());}this.keys.add(e.code);});
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);const start=this.charges.get(e.code);if(start!==undefined){this.releases.set(e.code,clamp((performance.now()-start)/850,.15,1));this.charges.delete(e.code);}});
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
  clear(){this.keys.clear();this.edges.clear();this.charges.clear();this.releases.clear();this.tackleTap=[-1,-1];this.aerial=[false,false];this.keeper=[false,false];this.controller.reset();this.touchMove={x:0,y:0};this.touchActions=[];this.touchSprint=false;this.touchShield=false;this.touchCharge=null;this.lastTick=-1;}
  setTouchMove(move:Vec2){this.touchMove=move;}
  setTouchSprint(pressed:boolean){this.touchSprint=pressed;}
  setTouchShield(pressed:boolean){this.touchShield=pressed;}
  startTouchShot(){if(this.enabled)this.touchCharge=performance.now();}
  endTouchShot(cancel=false){if(this.touchCharge!==null&&!cancel){this.touchPower=clamp((performance.now()-this.touchCharge)/850,.15,1);this.touchActions.push('shoot');}this.touchCharge=null;}
  pauseRequested(){return this.controller.pauseRequested(this.gamepads);}
  cameraRequested(){return this.controller.cameraRequested(this.gamepads);}
  touchAction(action:ActionKind){this.touchActions.push(action);}
  get charging(){const start=this.touchCharge??this.charges.get(firstCharge('p1'));return start===undefined?0:clamp((performance.now()-start)/850,0,1);}
  get gamepads(){return Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p&&p.connected);}
  sample(tick:number,slot:TeamIndex):InputFrame {
    if(!this.enabled)return{tick,slot,move:{x:0,y:0},aim:this.aim[slot],sprint:false,shield:false};
    this.lastTick=tick;
    const player: 'p1'|'p2' = slot===0?'p1':'p2';
    const move=KEYBOARD_MOVE[player],roles=KEYBOARD_MAP[player],defending=this.defending[slot],aerial=this.aerial[slot],keeper=this.keeper[slot];
    // A stale tap never survives into the header row, and at head height □ skips
    // its shot charge, so the hold queues no release.
    if(aerial){this.tackleTap[slot]=-1;for(const code of Object.keys(roles))if(chargeCodes.has(code)){this.charges.delete(code);this.releases.delete(code);}}
    // The attack context disarms the armed tap too, as the pad path does.
    if(!defending)this.tackleTap[slot]=-1;
    let movement={x:Number(this.keys.has(move[3]))-Number(this.keys.has(move[2])),y:Number(this.keys.has(move[1]))-Number(this.keys.has(move[0]))};
    let sprint=false,shield=false,action:ActionKind|undefined,power=.55,switchPlayer=false;
    // The keeper row wins over the header row: with the cursor on the keeper the
    // defense keys stay live at head height, so one press of the tackle key dives.
    const dive=keeper&&(defending||aerial);
    for(const [code,role] of Object.entries(roles)){
      if(role.sprint&&this.keys.has(code))sprint=true;
      // At head height the key plays the header with or without the ball, except
      // for the keeper, that keeps its own row.
      const kind=dive?role.defense:aerial?(role.attack??role.defense):(defending?role.defense:role.attack);
      const edge=this.edges.delete(code);
      if(role.charge&&kind==='shoot'&&!aerial){
        // Hold to charge power. The release fires the shot or the clearance.
        const release=this.releases.get(code);
        if(release!==undefined){action='shoot';power=release;this.releases.delete(code);}
        continue;
      }
      if(!edge)continue;
      // L1 (switch key) + ○ (cross key) plays the lob, as in the PES table.
      if(role.switchPlayer&&!passOrCrossHeld(roles,this.keys))switchPlayer=true;
      // The keeper □ key stays a clearance key: at head height it charges nothing
      // and never heads.
      if(dive&&kind==='shoot')continue;
      // Header row: □, ✕, △ and ○ head the ball, so □ skips its shot charge.
      // The keeper row wins over it, so no key of the keeper heads the ball.
      if(aerial&&kind&&!dive){action='header';continue;}
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
      if(kind)action=(kind==='cross'&&switchHeld(roles,this.keys))?'lob':kind;
    }
    let switchKeeper=this.edges.delete(KEEPER_KEYS[slot]);
    if(slot===0){if(length(this.touchMove)>.1)movement=this.touchMove;sprint||=this.touchSprint;shield||=this.touchShield;const touched=this.touchActions.shift();if(!action&&touched){action=touched;power=touched==='shoot'?this.touchPower:.55;}switchPlayer||=this.edges.delete('touch-switch');switchKeeper||=this.edges.delete('touch-keeper');}
    const pad=this.controller.sample(this.gamepads,tick,slot,defending,aerial,keeper);
    if(length(pad.move)>.1)movement=pad.move;
    sprint||=pad.sprint;shield||=pad.shield;switchPlayer||=pad.switchPlayer;switchKeeper||=pad.switchKeeper;
    if(pad.action){action=pad.action;power=pad.power;}
    // Header row: at head height □ or a pass button heads the ball.
    if(action)action=pesHeader(action,aerial);
    if(length(movement)>1)movement=unit(movement);if(length(movement)>.1)this.aim[slot]=unit(movement);if(pad.aim)this.aim[slot]=pad.aim;
    return{tick,slot,move:movement,aim:this.aim[slot],sprint,shield,action,power,switchPlayer,switchKeeper};
  }
  switchTouch(){this.edges.add('touch-switch');}
  switchKeeperTouch(){this.edges.add('touch-keeper');}
}
