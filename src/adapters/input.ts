import type { ActionKind, InputFrame, TeamIndex, Vec2 } from '../contracts/types';
import { clamp, length, unit } from '../simulation/math';
const BUTTONS: Record<string,ActionKind>={KeyJ:'pass',KeyK:'shoot',KeyL:'through',KeyI:'cross',KeyU:'tackle',KeyO:'header',Numpad1:'pass',Numpad2:'shoot',Numpad3:'through',Numpad5:'cross',Numpad0:'tackle',Numpad6:'header'};
export class BrowserInput {
  private keys=new Set<string>();private edges=new Set<string>();private releases=new Map<string,number>();private charges=new Map<string,number>();
  private padPrevious: boolean[][]=[[],[]]; private padCharges=[0,0];
  private touchMove:Vec2={x:0,y:0};private touchActions:ActionKind[]=[];private touchSprint=false;
  private aim:Vec2[]=[{x:1,y:0},{x:-1,y:0}];
  private lastTick=-1;private directions:[number,number]=[1,-1];
  enabled=false;
  constructor(){
    window.addEventListener('keydown',e=>{if(!this.enabled||this.isEditing(e.target))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!this.keys.has(e.code)){this.edges.add(e.code);if(e.code==='KeyK'||e.code==='Numpad2')this.charges.set(e.code,performance.now());}this.keys.add(e.code);});
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);const start=this.charges.get(e.code);if(start!==undefined){this.releases.set(e.code,clamp((performance.now()-start)/850,.15,1));this.charges.delete(e.code);}});
    window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  }
  private isEditing(target:EventTarget|null){return target instanceof HTMLElement && (['INPUT','SELECT','TEXTAREA'].includes(target.tagName)||target.isContentEditable);}
  setDirections(d:[number,number]){if(d[0]!==this.directions[0]){this.aim=[{x:d[0],y:0},{x:d[1],y:0}];}this.directions=d;}
  clear(){this.keys.clear();this.edges.clear();this.charges.clear();this.releases.clear();this.padPrevious=[[],[]];this.padCharges=[0,0];this.touchMove={x:0,y:0};this.touchActions=[];this.touchSprint=false;}
  setTouchMove(move:Vec2){this.touchMove=move;}
  setTouchSprint(pressed:boolean){this.touchSprint=pressed;}
  touchAction(action:ActionKind){this.touchActions.push(action);}
  get charging(){const start=this.charges.get('KeyK');return start===undefined?0:clamp((performance.now()-start)/850,0,1);}
  get gamepads(){return Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p&&p.connected);}
  sample(tick:number,slot:TeamIndex):InputFrame {
    this.lastTick=tick;
    const movement=slot===0?['KeyA','KeyD','KeyW','KeyS']:['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
    let move={x:Number(this.keys.has(movement[1]))-Number(this.keys.has(movement[0])),y:Number(this.keys.has(movement[3]))-Number(this.keys.has(movement[2]))};
    let sprint=this.keys.has(slot===0?'ShiftLeft':'ShiftRight'),shield=this.keys.has(slot===0?'Space':'NumpadDecimal'),action:ActionKind|undefined,power=.55;
    let switchPlayer=this.edges.delete(slot===0?'KeyQ':'Enter');
    for(const [code,kind]of Object.entries(BUTTONS)){if((slot===0)!==code.startsWith('Key'))continue;
      if(kind==='shoot'){const release=this.releases.get(code);if(release!==undefined){action='shoot';power=release;this.releases.delete(code);}}
      else if(this.edges.delete(code))action=kind;
    }
    if(slot===0){if(length(this.touchMove)>.1)move=this.touchMove;sprint||=this.touchSprint;action??=this.touchActions.shift();switchPlayer||=this.edges.delete('touch-switch');}
    const pad=this.gamepads[slot];
    if(pad&&pad.mapping==='standard'){
      const dead=(v:number)=>Math.abs(v)<.18?0:Math.sign(v)*(Math.abs(v)-.18)/.82;
      const stick={x:dead(pad.axes[0]??0),y:dead(pad.axes[1]??0)};if(length(stick)>.1)move=stick;
      const pressed=pad.buttons.map(b=>b.pressed),prev=this.padPrevious[slot];
      const mapping:Record<number,ActionKind>={0:'pass',2:'cross',3:'through',5:'tackle',7:'header'};
      for(const [i,kind]of Object.entries(mapping))if(pressed[+i]&&!prev[+i])action=kind;
      if(pressed[1])this.padCharges[slot]=Math.min(1,this.padCharges[slot]+1/51);
      else if(prev[1]){action='shoot';power=Math.max(.15,this.padCharges[slot]);this.padCharges[slot]=0;}
      sprint||=pressed[6];switchPlayer||=!!pressed[4]&&!prev[4];shield||=pressed[10];this.padPrevious[slot]=pressed;
    }
    if(length(move)>1)move=unit(move);if(length(move)>.1)this.aim[slot]=unit(move);
    return{tick,slot,move,aim:this.aim[slot],sprint,shield,action,power,switchPlayer};
  }
  switchTouch(){this.edges.add('touch-switch');}
}
