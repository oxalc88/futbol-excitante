import type { ActionKind, TeamIndex, Vec2 } from '../contracts/types';
import { clamp, length, unit } from '../simulation/math';
import { PS_BUTTON, pesButton } from '../browser/pad-presets';

export interface PadReading { index:number; id:string; mapping:string; connected:boolean; axes:readonly number[]; buttons:readonly {pressed:boolean}[] }
export interface PadFrame { move:Vec2; aim?:Vec2; action?:ActionKind; power:number; sprint:boolean; shield:boolean; switchPlayer:boolean; switchKeeper:boolean }
const identity=(p:PadReading)=>`${p.index}:${p.id}`;
const neutral=():PadFrame=>({move:{x:0,y:0},power:.55,sprint:false,shield:false,switchPlayer:false,switchKeeper:false});
// Buttons of the PES 2017 PS4 preset. The preset is the default pad mapping.
const B={
  pass:pesButton('pass'),through:pesButton('through'),cross:pesButton('cross'),
  shot:pesButton('shot'),sprint:pesButton('sprint'),switchPlayer:pesButton('switchPlayer'),
  tackle:pesButton('standingTackle'),pressure:pesButton('pressure'),slide:pesButton('slide'),
  clearance:pesButton('clearance'),pause:pesButton('pause'),
  // L1 + ○ plays the lob. R3 keeps the keeper switch.
  lob:pesButton('cross'),keeper:PS_BUTTON.r3,
};
export class ControllerMapper {
  private slots:(string|null)[]=[null,null];
  private previous:boolean[][]=[[],[]];
  private charge=[0,0];
  private armed=[false,false];
  private lastTick=[-1,-1];
  private cached:PadFrame[]=[neutral(),neutral()];
  private starts=new Map<string,boolean>();
  reset(){this.previous=[[],[]];this.charge=[0,0];this.armed=[false,false];this.lastTick=[-1,-1];}
  assignments(){return [...this.slots];}
  pauseRequested(pads:readonly PadReading[]){
    let pause=false;
    for(const p of pads.filter(p=>p.connected&&p.mapping==='standard')){const id=identity(p),pressed=!!p.buttons[B.pause]?.pressed;if(this.starts.has(id)&&pressed&&!this.starts.get(id))pause=true;this.starts.set(id,pressed);}
    for(const id of this.starts.keys())if(!pads.some(p=>identity(p)===id&&p.connected))this.starts.delete(id);
    return pause;
  }
  /** defending: the team has no ball. It defaults to false, so the pad uses
   * the attack keys when no possession state is given. input.ts passes the state. */
  sample(pads:readonly PadReading[],tick:number,slot:TeamIndex,defending=false):PadFrame {
    const connected=pads.filter(p=>p.connected&&p.mapping==='standard');
    for(let i=0;i<2;i++)if(this.slots[i]&&!connected.some(p=>identity(p)===this.slots[i])){this.slots[i]=null;this.previous[i]=[];this.charge[i]=0;this.armed[i]=false;this.lastTick[i]=-1;}
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
    // Without the ball: ✕ tackle (hold = pressure, tap ×2 = tackle), ○ slide, □ clearance charge.
    if(defending){
      if(edge(B.tackle))f.action='tackle'; // ✕: hold is pressure, tap ×2 is the tackle.
      if(edge(B.cross))f.action='slide';
    }else{
      if(edge(B.pass))f.action='pass';
      if(edge(B.cross))f.action=held(B.switchPlayer)?'lob':'cross';
      if(edge(B.through))f.action='through';
    }
    // □ charges in both contexts: shot with the ball, clearance without it.
    if(held(B.shot)&&this.armed[slot])this.charge[slot]=Math.min(1,this.charge[slot]+1/51);
    else if(!held(B.shot)){if(prev[B.shot]&&this.armed[slot]){f.action='shoot';f.power=Math.max(.15,this.charge[slot]);}this.charge[slot]=0;this.armed[slot]=true;}
    f.sprint=held(B.sprint);
    // Shield is automatic on contact: the preset has no shield button.
    f.switchPlayer=edge(B.switchPlayer)&&!held(B.pass)&&!held(B.cross);
    f.switchKeeper=edge(B.keeper);
    this.previous[slot]=pressed;this.lastTick[slot]=tick;this.cached[slot]=f;return structuredClone(f);
  }
}
