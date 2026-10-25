import type { ActionKind, TeamIndex, Vec2 } from '../contracts/types';
import { clamp, length, unit } from '../simulation/math';
import { PS_BUTTON, pesButton, TACKLE_TAP_TICKS } from '../browser/pad-presets';

export interface PadReading { index:number; id:string; mapping:string; connected:boolean; axes:readonly number[]; buttons:readonly {pressed:boolean}[] }
export interface PadFrame { move:Vec2; aim?:Vec2; action?:ActionKind; power:number; sprint:boolean; shield:boolean; switchPlayer:boolean; switchKeeper:boolean }
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
};
export class ControllerMapper {
  private slots:(string|null)[]=[null,null];
  private previous:boolean[][]=[[],[]];
  private charge=[0,0];
  private armed=[false,false];
  private lastTick=[-1,-1];
  private cached:PadFrame[]=[neutral(),neutral()];
  private starts=new Map<string,boolean>();
  private cameraStarts=new Map<string,boolean>();
  // Tick of the last defending ✕ tap, or -1 when no tackle is armed.
  private tackleTap=[-1,-1];
  reset(){this.previous=[[],[]];this.charge=[0,0];this.armed=[false,false];this.lastTick=[-1,-1];this.tackleTap=[-1,-1];}
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
   * dives. The outfield player keeps the double tap. */
  sample(pads:readonly PadReading[],tick:number,slot:TeamIndex,defending=false,aerial=false,keeper=false):PadFrame {
    const connected=pads.filter(p=>p.connected&&p.mapping==='standard');
    for(let i=0;i<2;i++)if(this.slots[i]&&!connected.some(p=>identity(p)===this.slots[i])){this.slots[i]=null;this.previous[i]=[];this.charge[i]=0;this.armed[i]=false;this.lastTick[i]=-1;this.tackleTap[i]=-1;}
    for(const p of connected){const id=identity(p);if(!this.slots.includes(id)){const i=this.slots.indexOf(null);if(i>=0){this.slots[i]=id;this.previous[i]=p.buttons.map(b=>b.pressed);this.armed[i]=!p.buttons[B.shot]?.pressed;}}}
    const p=connected.find(p=>identity(p)===this.slots[slot]);if(!p)return neutral();
    if(this.lastTick[slot]===tick)return structuredClone(this.cached[slot]);
    const pressed=p.buttons.map(b=>b.pressed);if(this.previous[slot].length===0){this.previous[slot]=[...pressed];this.armed[slot]=!pressed[B.shot];}
    const prev=this.previous[slot],f=neutral();
    const dead=(v:number)=>Number.isFinite(v)&&Math.abs(v)>.18?clamp(Math.sign(v)*(Math.abs(v)-.18)/.82,-1,1):0;
    f.move={x:dead(p.axes[0]??0),y:dead(p.axes[1]??0)};if(length(f.move)>1)f.move=unit(f.move);
    const right={x:dead(p.axes[2]??0),y:dead(p.axes[3]??0)};if(length(right)>.1)f.aim=unit(right);
    const edge=(i:number)=>!!pressed[i]&&!prev[i],held=(i:number)=>!!pressed[i];
    // With the ball: ✕ pass, ○ cross (L1 + ○ lob), △ through, □ shot charge.
    // Without the ball: hold ✕ is pressure, ✕ ×2 is the tackle, ○ is the slide
    // and □ charges the clearance.
    if(aerial){
      // Header row: □, ✕, △ and ○ head the ball instead of their kick.
      // The double tap never arms in the air and □ skips its shot charge.
      this.tackleTap[slot]=-1;
      if(edge(B.pass)||edge(B.through)||edge(B.cross)||edge(B.shot))f.action='header';
      // The header spends the □ press: disarm the shot until □ is up, so the
      // release never fires a shot.
      if(edge(B.shot))this.armed[slot]=false;
    }else if(defending){
      // Pressure is a missing mechanic (phase 2), so the first tap only arms the
      // tackle and the second tap inside the window fires it.
      // The goalkeeper dives on one press of the same button.
      if(keeper){this.tackleTap[slot]=-1;if(edge(B.tackle))f.action='tackle';}
      else if(edge(B.tackle)){if(this.tackleTap[slot]>=0&&tick-this.tackleTap[slot]<=TACKLE_TAP_TICKS){f.action='tackle';this.tackleTap[slot]=-1;}else this.tackleTap[slot]=tick;}
      if(edge(B.cross))f.action='slide';
    }else{
      this.tackleTap[slot]=-1;
      if(edge(B.pass))f.action='pass';
      if(edge(B.cross))f.action=held(B.switchPlayer)?'lob':'cross';
      if(edge(B.through))f.action='through';
    }
    // At head height □ heads at once and never charges. Otherwise □ charges in
    // both contexts: shot with the ball, clearance without it. A press spent on a
    // header stays disarmed until the release, so the release gives no shot and
    // the next press charges again.
    if(aerial){this.charge[slot]=0;if(!held(B.shot))this.armed[slot]=true;}
    else if(held(B.shot)&&this.armed[slot])this.charge[slot]=Math.min(1,this.charge[slot]+1/51);
    else if(!held(B.shot)){if(prev[B.shot]&&this.armed[slot]){f.action='shoot';f.power=Math.max(.15,this.charge[slot]);}this.charge[slot]=0;this.armed[slot]=true;}
    f.sprint=held(B.sprint);
    // Shield is automatic on contact: the preset has no shield button.
    f.switchPlayer=edge(B.switchPlayer)&&!held(B.pass)&&!held(B.cross);
    f.switchKeeper=edge(B.keeper);
    this.previous[slot]=pressed;this.lastTick[slot]=tick;this.cached[slot]=f;return structuredClone(f);
  }
}
