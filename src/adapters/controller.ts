import type { ActionKind, TeamIndex, Vec2 } from '../contracts/types';
import { clamp, length, unit } from '../simulation/math';

export interface PadReading { index:number; id:string; mapping:string; connected:boolean; axes:readonly number[]; buttons:readonly {pressed:boolean}[] }
export interface PadFrame { move:Vec2; aim?:Vec2; action?:ActionKind; power:number; sprint:boolean; shield:boolean; switchPlayer:boolean }
const identity=(p:PadReading)=>`${p.index}:${p.id}`;
const neutral=():PadFrame=>({move:{x:0,y:0},power:.55,sprint:false,shield:false,switchPlayer:false});
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
    for(const p of pads.filter(p=>p.connected&&p.mapping==='standard')){const id=identity(p),pressed=!!p.buttons[9]?.pressed;if(this.starts.has(id)&&pressed&&!this.starts.get(id))pause=true;this.starts.set(id,pressed);}
    for(const id of this.starts.keys())if(!pads.some(p=>identity(p)===id&&p.connected))this.starts.delete(id);
    return pause;
  }
  sample(pads:readonly PadReading[],tick:number,slot:TeamIndex):PadFrame {
    const connected=pads.filter(p=>p.connected&&p.mapping==='standard');
    for(let i=0;i<2;i++)if(this.slots[i]&&!connected.some(p=>identity(p)===this.slots[i])){this.slots[i]=null;this.previous[i]=[];this.charge[i]=0;this.armed[i]=false;this.lastTick[i]=-1;}
    for(const p of connected){const id=identity(p);if(!this.slots.includes(id)){const i=this.slots.indexOf(null);if(i>=0){this.slots[i]=id;this.previous[i]=p.buttons.map(b=>b.pressed);this.armed[i]=!p.buttons[1]?.pressed;}}}
    const p=connected.find(p=>identity(p)===this.slots[slot]);if(!p)return neutral();
    if(this.lastTick[slot]===tick)return structuredClone(this.cached[slot]);
    const pressed=p.buttons.map(b=>b.pressed);if(this.previous[slot].length===0){this.previous[slot]=[...pressed];this.armed[slot]=!pressed[1];}
    const prev=this.previous[slot],f=neutral();
    const dead=(v:number)=>Number.isFinite(v)&&Math.abs(v)>.18?clamp(Math.sign(v)*(Math.abs(v)-.18)/.82,-1,1):0;
    f.move={x:dead(p.axes[0]??0),y:dead(p.axes[1]??0)};if(length(f.move)>1)f.move=unit(f.move);
    const right={x:dead(p.axes[2]??0),y:dead(p.axes[3]??0)};if(length(right)>.1)f.aim=unit(right);
    const mapping:Record<number,ActionKind>={0:pressed[4]?'lob':'pass',2:'cross',3:'through',5:pressed[6]?'slide':'tackle',7:'header'};
    for(const [i,kind]of Object.entries(mapping))if(pressed[+i]&&!prev[+i])f.action=kind;
    if(pressed[1]&&this.armed[slot])this.charge[slot]=Math.min(1,this.charge[slot]+1/51);
    else if(!pressed[1]){if(prev[1]&&this.armed[slot]){f.action='shoot';f.power=Math.max(.15,this.charge[slot]);}this.charge[slot]=0;this.armed[slot]=true;}
    f.sprint=!!pressed[6];f.shield=!!pressed[10];f.switchPlayer=!!pressed[4]&&!prev[4]&&!pressed[0];
    this.previous[slot]=pressed;this.lastTick[slot]=tick;this.cached[slot]=f;return structuredClone(f);
  }
}
