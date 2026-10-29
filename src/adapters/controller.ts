import type { ActionKind, TeamIndex, Vec2 } from '../contracts/types';
import { clamp, length, unit } from '../simulation/math';
import { PS_BUTTON, pesButton, TACKLE_TAP_TICKS } from '../browser/pad-presets';

export interface PadReading { index:number; id:string; mapping:string; connected:boolean; axes:readonly number[]; buttons:readonly {pressed:boolean}[] }
export interface PadFrame { move:Vec2; aim?:Vec2; action?:ActionKind; power:number; sprint:boolean; shield:boolean; switchPlayer:boolean; switchKeeper:boolean;
  keeperRush?:boolean; keeperKick?:'punt'|'high'; keeperDrop?:boolean; keeperFeint?:boolean; simulateDive?:boolean;
  setKick?:boolean; secondTaker?:'side'|'behind'; secondKick?:boolean; setFeint?:boolean; shortRoll?:boolean; panenka?:boolean;
  wallJump?:boolean; wallCharge?:number; keeperMove?:Vec2; cornerSide?:'up'|'down'|'left'|'right'; setFix?:boolean;
  press?:boolean; teamPress?:0|1|2; jockey?:boolean; switchTarget?:Vec2 }
const identity=(p:PadReading)=>`${p.index}:${p.id}`;
const neutral=():PadFrame=>({move:{x:0,y:0},power:.55,sprint:false,shield:false,switchPlayer:false,switchKeeper:false});
// Buttons of the PES 2017 PS4 preset. The preset is the default pad mapping.
const B={
  pass:pesButton('pass'),through:pesButton('through'),cross:pesButton('cross'),
  shot:pesButton('shot'),sprint:pesButton('sprint'),switchPlayer:pesButton('switchPlayer'),
  // Pressure hold and standing tackle share the ✕ button of the table.
  tackle:pesButton('standingTackle'),slide:pesButton('slide'),
  clearance:pesButton('clearance'),pause:pesButton('pause'),camera:pesButton('camera'),
  // R3 keeps the keeper switch; there is no preset row for it.
  keeper:PS_BUTTON.r3,
  // Foul-dive chord buttons (L1 + L2 + L3 + R3, R2 decides against the dive).
  l2:PS_BUTTON.l2,r2:PS_BUTTON.r2,l3:PS_BUTTON.l3,
};
export class ControllerMapper {
  private slots:(string|null)[]=[null,null];
  private previous:boolean[][]=[[],[]];
  private stash:(string|null)[]|null=null;
  private charge=[0,0];
  private armed=[false,false];
  // Charge of the keeper volley punt (○) per slot, while the ball is held.
  private punt=[0,0];
  private puntArmed=[true,true];
  private lastTick=[-1,-1];
  private cached:PadFrame[]=[neutral(),neutral()];
  private starts=new Map<string,boolean>();
  private cameraStarts=new Map<string,boolean>();
  // Tick of the last defending ✕ tap, or -1 when no tackle is armed.
  private tackleTap=[-1,-1];
  // Tick of the last defending □ tap and the double tap flag of the held □.
  private squareTap=[-1,-1];
  private squareDouble=[false,false];
  // Right stick switch, armed while the stick sits near the centre: a flick
  // gives one switch from any sample above 0.7, however fast the stick rises.
  private stickArmed=[true,true];
  // Set-piece state of a slot: charge, spend and arm flags of the three kick
  // buttons, the panenka and short-roll chords, the wall charge and the aim lock.
  private setCharge:number[][]=[[0,0,0],[0,0,0]];
  private setSpent:boolean[][]=[[false,false,false],[false,false,false]];
  private setArmed:boolean[][]=[[true,true,true],[true,true,true]];
  private setPanenka=[false,false];private setRoll=[false,false];
  private wallCharge=[0,0];
  private restartContext=[null,null] as (string|null)[];
  private setAim:Vec2[]=[{x:1,y:0},{x:-1,y:0}];private fixedAim:(Vec2|null)[]=[null,null];
  /** Clears the transient sample state only. The identity stash of an active
   * touch toggle survives: restoreSlots consumes it, so a reset while the touch
   * pad owns slot 0 keeps the reversed physical slot ids. */
  reset(){this.previous=[[],[]];this.charge=[0,0];this.armed=[false,false];this.punt=[0,0];this.puntArmed=[true,true];this.lastTick=[-1,-1];this.tackleTap=[-1,-1];this.setCharge=[[0,0,0],[0,0,0]];this.setSpent=[[false,false,false],[false,false,false]];this.setArmed=[[true,true,true],[true,true,true]];this.squareTap=[-1,-1];this.squareDouble=[false,false];this.stickArmed=[true,true];this.setPanenka=[false,false];this.setRoll=[false,false];this.wallCharge=[0,0];this.restartContext=[null,null];this.setAim=[{x:1,y:0},{x:-1,y:0}];this.fixedAim=[null,null];}
  /** Frees both slots: the next sample assigns the pads again in list order. */
  releaseSlots(){this.slots=[null,null];this.previous=[[],[]];}
  /** Drops every set-piece charge and flag of a slot: a cancelled touch or a
   * slot change must never fire a pending set kick. The restart context is
   * forgotten too, so the next sample re-arms the buttons from their state. */
  private clearSetState(slot:0|1){
    this.setCharge[slot]=[0,0,0];this.setSpent[slot]=[false,false,false];this.setArmed[slot]=[true,true,true];
    this.setPanenka[slot]=false;this.setRoll[slot]=false;this.wallCharge[slot]=0;this.fixedAim[slot]=null;this.restartContext[slot]=null;
    this.squareTap[slot]=-1;this.squareDouble[slot]=false;this.stickArmed[slot]=true;
  }
  /** The touch pad takes slot 0: stash the physical slot ids and reset only
   * slot 0. Slot 1 keeps its pad, so no physical pad swaps slots. */
  stashSlots(){
    this.stash=[...this.slots];
    this.slots[0]=null;this.previous[0]=[];this.charge[0]=0;this.armed[0]=false;
    this.punt[0]=0;this.puntArmed[0]=true;this.lastTick[0]=-1;this.tackleTap[0]=-1;
    this.clearSetState(0);
  }
  /** The touch pad leaves slot 0: put the stashed physical ids back. */
  restoreSlots(){const ids=this.stash;this.stash=null;this.releaseSlots();if(ids)this.slots=[ids[0]??null,ids[1]??null];this.clearSetState(0);}
  /** Drops the pending slot 0 releases: a cancelled touch pointer must not
   * fire the shot, the keeper kick or a set kick on lift. The next sample
   * re-seeds the previous state, so no false edge comes out either. */
  discardCharge(){this.previous[0]=[];this.charge[0]=0;this.armed[0]=false;this.punt[0]=0;this.clearSetState(0);}
  /** Charge level of a slot, for the HUD power meter. During a set piece the
   * kick charge lives in the set-piece state, so the meter reads the larger. */
  chargeLevel(slot:TeamIndex){return Math.max(this.charge[slot],...this.setCharge[slot]);}
  assignments(){return [...this.slots];}
  /** One press edge of a system button per pad. Disconnected pads forget their edge. */
  private startEdge(pads:readonly PadReading[],button:number,starts:Map<string,boolean>){
    let edge=false;
    for(const p of pads.filter(p=>p.connected&&p.mapping==='standard')){const id=identity(p),pressed=!!p.buttons[button]?.pressed;if(starts.has(id)&&pressed&&!starts.get(id))edge=true;starts.set(id,pressed);}
    for(const id of starts.keys())if(!pads.some(p=>identity(p)===id&&p.connected))starts.delete(id);
    return edge;
  }
  pauseRequested(pads:readonly PadReading[]){return this.startEdge(pads,B.pause,this.starts);}
  /** Touchpad click (standard-mapping button 17) changes the camera. */
  cameraRequested(pads:readonly PadReading[]){return this.startEdge(pads,B.camera,this.cameraStarts);}
  /** defending: the team has no ball. It defaults to false, so the pad uses
   * the attack keys when no possession state is given. input.ts passes the state.
   * aerial: the ball is at head height and the player can reach it, so the
   * header row replaces the kick buttons.
   * keeper: the slot controls the goalkeeper, so one press of the tackle button
   * dives. The outfield player keeps the double tap. The keeper row wins over
   * the header row, so a press at head height still dives.
   * hold: the keeper of the slot holds the ball in the hands, so the keeper row
   * uses the throw and kick gestures instead of the dive and the pressure. */
  sample(pads:readonly PadReading[],tick:number,slot:TeamIndex,defending=false,aerial=false,keeper=false,hold=false,restart:{kind:string;attacking:boolean}|null=null):PadFrame {
    if(restart?.kind==='kickoff')restart=null;
    const context=restart?`${restart.kind}:${restart.attacking}`:null;
    const contextChanged=context!==this.restartContext[slot];
    if(contextChanged){this.setCharge[slot]=[0,0,0];this.setSpent[slot]=[false,false,false];this.setPanenka[slot]=false;this.setRoll[slot]=false;this.wallCharge[slot]=0;this.fixedAim[slot]=null;this.restartContext[slot]=context;}
    const connected=pads.filter(p=>p.connected&&p.mapping==='standard');
    for(let i=0;i<2;i++)if(this.slots[i]&&!connected.some(p=>identity(p)===this.slots[i])){this.slots[i]=null;this.previous[i]=[];this.charge[i]=0;this.armed[i]=false;this.punt[i]=0;this.puntArmed[i]=true;this.lastTick[i]=-1;this.tackleTap[i]=-1;this.clearSetState(i as 0|1);}
    for(const p of connected){const id=identity(p);if(!this.slots.includes(id)){const i=this.slots.indexOf(null);if(i>=0){this.slots[i]=id;this.previous[i]=p.buttons.map(b=>b.pressed);this.armed[i]=!p.buttons[B.shot]?.pressed;this.setArmed[i]=[B.pass,B.cross,B.shot].map(button=>!p.buttons[button]?.pressed);}}}
    const p=connected.find(p=>identity(p)===this.slots[slot]);if(!p)return neutral();
    if(this.lastTick[slot]===tick)return structuredClone(this.cached[slot]);
    const pressed=p.buttons.map(b=>b.pressed);if(this.previous[slot].length===0){this.previous[slot]=[...pressed];this.armed[slot]=!pressed[B.shot];}
    if(contextChanged)this.setArmed[slot]=[B.pass,B.cross,B.shot].map(button=>!pressed[button]||!this.previous[slot][button]);
    const prev=this.previous[slot],f=neutral();
    const dead=(v:number)=>Number.isFinite(v)&&Math.abs(v)>.18?clamp(Math.sign(v)*(Math.abs(v)-.18)/.82,-1,1):0;
    f.move={x:dead(p.axes[0]??0),y:dead(p.axes[1]??0)};if(length(f.move)>1)f.move=unit(f.move);
    const right={x:dead(p.axes[2]??0),y:dead(p.axes[3]??0)};if(length(right)>.1)f.aim=unit(right);
    if(restart){if(!p.buttons[B.r2]?.pressed){this.fixedAim[slot]=null;this.setAim[slot]=f.aim??(length(f.move)>.1?unit(f.move):this.setAim[slot]);if(f.aim||length(f.move)>.1)f.aim={...this.setAim[slot]};}else{if(!this.fixedAim[slot])this.fixedAim[slot]={...this.setAim[slot]};f.aim={...this.fixedAim[slot]};}}
    // Right stick flick: the stick crosses from the centre to a full deflection.
    // The switch is armed near the centre and fires once above the threshold, so
    // a stick that jumps over the middle bands still gives one switch. The arm
    // state works in every context: a full deflection disarms the stick in attack
    // too, so a held stick never switches after a change of possession. Only a
    // sample near the centre arms the stick again. The flick tick keeps no aim.
    const rightLength=length(right);
    if(rightLength<.3)this.stickArmed[slot]=true;
    const flick=this.stickArmed[slot]&&rightLength>.7;
    if(flick)this.stickArmed[slot]=false;
    if(flick&&defending&&!restart&&!hold){f.switchTarget=unit(right);f.aim=undefined;}
    // Outside defense the □ double tap dies, as in the keyboard path of input.ts.
    if(!defending){this.squareTap[slot]=-1;this.squareDouble[slot]=false;}
    const edge=(i:number)=>!!pressed[i]&&!prev[i],held=(i:number)=>!!pressed[i];
    if(restart){
      const direction=([PS_BUTTON.dpadUp,PS_BUTTON.dpadDown,PS_BUTTON.dpadLeft,PS_BUTTON.dpadRight] as const).find(edge);
      if(direction!==undefined&&restart.kind==='corner')f.cornerSide=({[PS_BUTTON.dpadUp]:'up',[PS_BUTTON.dpadDown]:'down',[PS_BUTTON.dpadLeft]:'left',[PS_BUTTON.dpadRight]:'right'} as const)[direction];
      f.setFix=held(B.r2);
      if(restart.attacking){
        if(held(B.switchPlayer)&&edge(PS_BUTTON.dpadUp))f.secondTaker='side';
        if(held(B.switchPlayer)&&edge(PS_BUTTON.dpadDown))f.secondTaker='behind';
        // Touch pad: the L2 press also places the second taker beside the ball (no D-pad).
        if(p.id==='touch-pad'&&edge(B.l2))f.secondTaker='side';
        if(held(B.l2))f.secondKick=true;
        const buttons=[B.pass,B.cross,B.shot];
        if(restart.kind!=='kickoff')for(let i=0;i<buttons.length;i++){
          const button=buttons[i];
          if(held(button)&&this.setArmed[slot][i]&&!this.setSpent[slot][i])this.setCharge[slot][i]=Math.min(1,this.setCharge[slot][i]+1/51);
          if(!held(button)&&prev[button]){
            if(!this.setSpent[slot][i]&&this.setCharge[slot][i]>0){f.action=(['pass','cross','shoot'] as const)[i];f.power=Math.max(.15,this.setCharge[slot][i]);f.setKick=true;if(i===0&&this.setRoll[slot])f.shortRoll=true;if(i===2&&this.setPanenka[slot])f.panenka=true;}
            this.setCharge[slot][i]=0;this.setSpent[slot][i]=false;
            if(i===0)this.setRoll[slot]=false;if(i===2)this.setPanenka[slot]=false;
          }
          if(!held(button))this.setArmed[slot][i]=true;
        }
        if(restart.kind==='penalty'&&edge(B.shot)&&held(B.switchPlayer))this.setPanenka[slot]=true;
        if(edge(B.pass)&&held(B.switchPlayer))this.setRoll[slot]=true;
        if((restart.kind==='free-kick'||restart.kind==='indirect')&&held(B.cross)&&edge(B.pass)){
          f.setFeint=true;this.setSpent[slot][0]=true;this.setSpent[slot][1]=true;f.action=undefined;f.setKick=undefined;
        }
        if(!held(B.shot)&&!prev[B.shot])this.setPanenka[slot]=false;
        if(!held(B.pass)&&!prev[B.pass])this.setRoll[slot]=false;
      }else{
        if((restart.kind==='free-kick'||restart.kind==='indirect')&&edge(B.shot)&&!held(B.pass))f.wallJump=true;
        if((restart.kind==='free-kick'||restart.kind==='indirect')&&held(B.cross)){this.wallCharge[slot]=Math.min(1,this.wallCharge[slot]+1/51);f.wallCharge=this.wallCharge[slot];}else this.wallCharge[slot]=0;
        if((restart.kind==='free-kick'||restart.kind==='indirect')&&held(B.through)&&length(f.move)>.1)f.keeperMove=f.move;
        if(restart.kind==='penalty'&&length(f.move)>.1)f.keeperMove=f.move;
      }
    }
    // Foul dive: all four chord buttons held in this sample and R2 not held, on the edge.
    const chordCore=held(B.switchPlayer)&&held(B.l2)&&held(B.l3)&&held(B.keeper);
    const chord=chordCore&&!held(B.r2);
    const prevChord=!!prev[B.switchPlayer]&&!!prev[B.l2]&&!!prev[B.l3]&&!!prev[B.keeper]&&!prev[B.r2];
    if(chord&&!prevChord)f.simulateDive=true;
    // The keeper volley punt charges on a held ○ while the ball is held. The pass
    // feint spends the charge, so the release gives no kick.
    if(hold&&keeper&&held(B.cross)&&this.puntArmed[slot])this.punt[slot]=Math.min(1,this.punt[slot]+1/51);
    else if(!held(B.cross)){if(prev[B.cross]&&this.puntArmed[slot]&&this.punt[slot]>0&&hold&&keeper){f.keeperKick=held(B.r2)?'high':'punt';f.power=Math.max(.15,this.punt[slot]);}this.punt[slot]=0;this.puntArmed[slot]=true;}
    // The kick or throw charge that a ✕ press can feint: the ○ punt charge, the
    // □ kick charge, or any other pass button held down (△ throw into space and
    // the ○ high pass). The ✕ button is the feint key itself, so its own hold
    // never counts: an edge of ✕ while ✕ is held cannot exist, and counting it
    // would stop every hand throw.
    const passHeld=held(B.through)||held(B.cross);
    const kickChargeHeld=hold&&keeper&&(passHeld||this.punt[slot]>0||(held(B.shot)&&this.armed[slot]&&this.charge[slot]>0));
    if(hold&&keeper&&kickChargeHeld&&edge(B.pass)){
      f.keeperFeint=true;
      // Drop both charges: the pending ○ and □ releases give no ball release.
      this.charge[slot]=0;this.armed[slot]=false;this.punt[slot]=0;this.puntArmed[slot]=false;
    }
    // With the ball: ✕ pass, ○ cross (L1 + ○ lob), △ through, □ shot charge.
    // Without the ball: hold ✕ is pressure, ✕ ×2 is the tackle, ○ is the slide
    // and □ charges the clearance.
    // The goalkeeper row wins over the header row: with the cursor on the keeper
    // one ✕ press dives even at head height. Outside defense and the aerial band
    // the keeper keeps the attack keys, as before. The holder of the ball uses
    // the attack keys in every context: ✕ throws, △ throws into space.
    const dive=!restart&&keeper&&(defending||aerial)&&!hold;
    if(dive){
      this.tackleTap[slot]=-1;
      if(edge(B.tackle))f.action='tackle';
      if(edge(B.cross))f.action='slide';
      // A □ press spent at head height never becomes a shot release.
      if(aerial&&edge(B.shot))this.armed[slot]=false;
    }else if(aerial&&!hold&&!restart){
      // Header row: □, ✕, △ and ○ head the ball instead of their kick.
      // The double tap never arms in the air and □ skips its shot charge.
      this.tackleTap[slot]=-1;
      if(edge(B.pass)||edge(B.through)||edge(B.cross)||edge(B.shot))f.action='header';
      // The header spends the □ press: disarm the shot until □ is up, so the
      // release never fires a shot.
      if(edge(B.shot))this.armed[slot]=false;
    }else if(defending&&!hold&&!restart){
      // The first ✕ tap arms the tackle and the second tap inside the window
      // fires it. ✕ held is the pressure hold of the selected player.
      if(edge(B.tackle)){if(this.tackleTap[slot]>=0&&tick-this.tackleTap[slot]<=TACKLE_TAP_TICKS){f.action='tackle';this.tackleTap[slot]=-1;}else this.tackleTap[slot]=tick;}
      if(held(B.tackle))f.press=true;
      // □ held sends one teammate at the carrier; □ ×2 inside the window and held
      // sends two. The double flag dies with the release of □.
      if(edge(B.shot)){this.squareDouble[slot]=this.squareTap[slot]>=0&&tick-this.squareTap[slot]<=TACKLE_TAP_TICKS;this.squareTap[slot]=tick;}
      if(held(B.shot))f.teamPress=this.squareDouble[slot]?2:1;else this.squareDouble[slot]=false;
      // R2 held contains the carrier at low speed. L1 keeps its own rows.
      if(held(B.r2)&&!held(B.switchPlayer))f.jockey=true;
      if(edge(B.cross))f.action='slide';
    }else{
      this.tackleTap[slot]=-1;
      if(edge(B.pass)&&!f.keeperFeint&&!restart)f.action='pass';
      // While the ball is in the hands ○ is the punt charge, never a cross.
      if(edge(B.cross)&&!hold&&!restart)f.action=held(B.switchPlayer)?'lob':'cross';
      // A feint in this sample wins over the △ edge of the same sample.
      if(edge(B.through)&&!f.keeperFeint&&(!restart||restart.attacking))f.action='through';
    }
    // At head height □ heads at once and never charges. Otherwise □ charges in
    // both contexts: shot with the ball, clearance without it. A press spent on a
    // header stays disarmed until the release, so the release gives no shot and
    // the next press charges again. The holder of the ball keeps the charge at
    // head height, because the kick never heads.
    if(restart){this.charge[slot]=0;if(!held(B.shot))this.armed[slot]=true;}
    else if(aerial&&!hold){this.charge[slot]=0;if(!held(B.shot))this.armed[slot]=true;}
    else if(held(B.shot)&&this.armed[slot])this.charge[slot]=Math.min(1,this.charge[slot]+1/51);
    else if(!held(B.shot)){if(prev[B.shot]&&this.armed[slot]){f.action='shoot';f.power=Math.max(.15,this.charge[slot]);}this.charge[slot]=0;this.armed[slot]=true;}
    f.sprint=held(B.sprint);
    // Shield is automatic on contact: the preset has no shield button.
    // R1 with the stick released puts the held ball down or picks a low ball up.
    // R1 + △ is the sprint rush chord, so it never drops the ball.
    if(keeper&&edge(B.sprint)&&length(f.move)<.1&&!held(B.through))f.keeperDrop=true;
    // Hold △ without the ball: run out to the ball; R1 adds the sprint rush.
    if(keeper&&!hold&&held(B.through))f.keeperRush=true;
    // The chord never switches cursor or player in the same sample.
    f.switchPlayer=!restart&&edge(B.switchPlayer)&&!held(B.pass)&&!held(B.cross)&&!chordCore;
    f.switchKeeper=edge(B.keeper)&&!chordCore;
    this.previous[slot]=pressed;this.lastTick[slot]=tick;this.cached[slot]=f;return structuredClone(f);
  }
}
