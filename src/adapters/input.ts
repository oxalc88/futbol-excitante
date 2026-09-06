import type { ActionKind, InputFrame, TeamIndex, Vec2 } from '../contracts/types';
import { ControllerMapper } from './controller';
import { clamp, length, unit } from '../simulation/math';
const BUTTONS: Record<string,ActionKind>={KeyJ:'pass',KeyK:'shoot',KeyL:'through',KeyI:'cross',KeyU:'tackle',KeyO:'header',KeyH:'lob',KeyB:'slide',Numpad1:'pass',Numpad2:'shoot',Numpad3:'through',Numpad5:'cross',Numpad0:'tackle',Numpad6:'header',Numpad4:'lob',Numpad7:'slide'};
export class BrowserInput {
  private keys=new Set<string>();private edges=new Set<string>();private releases=new Map<string,number>();private charges=new Map<string,number>();
  private controller=new ControllerMapper();
  private touchMove:Vec2={x:0,y:0};private touchActions:ActionKind[]=[];private touchSprint=false;private touchShield=false;private touchCharge:number|null=null;private touchPower=.55;
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
  clear(){this.keys.clear();this.edges.clear();this.charges.clear();this.releases.clear();this.controller.reset();this.touchMove={x:0,y:0};this.touchActions=[];this.touchSprint=false;this.touchShield=false;this.touchCharge=null;this.lastTick=-1;}
  setTouchMove(move:Vec2){this.touchMove=move;}
  setTouchSprint(pressed:boolean){this.touchSprint=pressed;}
  setTouchShield(pressed:boolean){this.touchShield=pressed;}
  startTouchShot(){if(this.enabled)this.touchCharge=performance.now();}
  endTouchShot(cancel=false){if(this.touchCharge!==null&&!cancel){this.touchPower=clamp((performance.now()-this.touchCharge)/850,.15,1);this.touchActions.push('shoot');}this.touchCharge=null;}
  pauseRequested(){return this.controller.pauseRequested(this.gamepads);}
  touchAction(action:ActionKind){this.touchActions.push(action);}
  get charging(){const start=this.touchCharge??this.charges.get('KeyK');return start===undefined?0:clamp((performance.now()-start)/850,0,1);}
  get gamepads(){return Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p&&p.connected);}
  sample(tick:number,slot:TeamIndex):InputFrame {
    if(!this.enabled)return{tick,slot,move:{x:0,y:0},aim:this.aim[slot],sprint:false,shield:false};
    this.lastTick=tick;
    const movement=slot===0?['KeyA','KeyD','KeyW','KeyS']:['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
    let move={x:Number(this.keys.has(movement[1]))-Number(this.keys.has(movement[0])),y:Number(this.keys.has(movement[3]))-Number(this.keys.has(movement[2]))};
    let sprint=this.keys.has(slot===0?'ShiftLeft':'ShiftRight'),shield=this.keys.has(slot===0?'Space':'NumpadDecimal'),action:ActionKind|undefined,power=.55;
    let switchPlayer=this.edges.delete(slot===0?'KeyQ':'Enter');
    for(const [code,kind]of Object.entries(BUTTONS)){if((slot===0)!==code.startsWith('Key'))continue;
      if(kind==='shoot'){const release=this.releases.get(code);if(release!==undefined){action='shoot';power=release;this.releases.delete(code);}}
      else if(this.edges.delete(code))action=kind;
    }
    if(slot===0){if(length(this.touchMove)>.1)move=this.touchMove;sprint||=this.touchSprint;shield||=this.touchShield;const touched=this.touchActions.shift();if(!action&&touched){action=touched;power=touched==='shoot'?this.touchPower:.55;}switchPlayer||=this.edges.delete('touch-switch');}
    const pad=this.controller.sample(this.gamepads,tick,slot);
    if(length(pad.move)>.1)move=pad.move;
    sprint||=pad.sprint;shield||=pad.shield;switchPlayer||=pad.switchPlayer;
    if(pad.action){action=pad.action;power=pad.power;}
    if(length(move)>1)move=unit(move);if(length(move)>.1)this.aim[slot]=unit(move);if(pad.aim)this.aim[slot]=pad.aim;
    return{tick,slot,move,aim:this.aim[slot],sprint,shield,action,power,switchPlayer};
  }
  switchTouch(){this.edges.add('touch-switch');}
}
