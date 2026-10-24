import type { PlayerState, Presentation, Vec3 } from '../contracts/types';
import { clamp } from '../simulation/math';

export const EMBODIMENT_MAPPING={version:'procedural-rig-v2',metresPerUnit:1,
  surfaces:{foot:{maxHorizontalReach:1.6,maxHeight:1.1},head:{maxHorizontalReach:.7,maxHeight:2.25},hand:{maxHorizontalReach:1.2,maxHeight:2.8}},
  limbs:{leg:[.78,.78],arm:[.72,.72]},contactTolerance:.025} as const;
export function contactPose(p:PlayerState,s:Presentation){
  const c=s.ball.lastTouch;if(!c||c.playerId!==p.id||s.tick-c.tick>5||s.tick<c.tick)return null;
  if(c.surface==='body')return null;
  const limits=EMBODIMENT_MAPPING.surfaces[c.surface];
  const reach=Math.hypot(c.point.x-p.x,c.point.y-p.y);
  return {surface:c.surface,point:{...c.point},contactTick:c.tick,reachable:reach<=limits.maxHorizontalReach+.02&&c.point.z<=limits.maxHeight+.02};
}

/** Two-bone solution in world metres. The endpoint is never clamped silently. */
export function solveLimb(root:Vec3,target:Vec3,lengths:readonly number[],bend=1){
  const dx=target.x-root.x,dy=target.y-root.y,dz=target.z-root.z,d=Math.hypot(dx,dy,dz),[a,b]=lengths;
  if(d>a+b+1e-6||d<Math.abs(a-b)||d<1e-6)return null;
  const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  const horiz=Math.hypot(dx,dy),nx=horiz>1e-5?-dy/horiz:1,ny=horiz>1e-5?dx/horiz:0;
  return {root,knee:{x:root.x+dx/d*along+nx*height*bend,y:root.y+dy/d*along+ny*height*bend,z:root.z+dz/d*along},end:target};
}
export class CameraRig {
  private tick=-1;private target={x:0,y:0};private previous={x:0,y:0};
  rotation={x:0,z:0};mode:'broadcast'|'tactical'|'close'='broadcast';
  constructor(private dt=1/60){}
  reset(){this.tick=-1;this.rotation={x:0,z:0};}
  advance(s:Presentation){
    if(s.tick<=this.tick)return;
    const wanted={x:clamp(s.ball.x*.7,-33,33),y:clamp(s.ball.y*.5,-13,13)};
    this.previous={...this.target};
    if(this.tick<0||s.events.some(e=>e.type==='restart-awarded'))this.target=wanted;
    else {const k=1-Math.exp(-(s.tick-this.tick)*this.dt*4);this.target.x+=(wanted.x-this.target.x)*k;this.target.y+=(wanted.y-this.target.y)*k;}
    this.rotation.x+=s.ball.vy*this.dt/.11;this.rotation.z-=s.ball.vx*this.dt/.11;this.tick=s.tick;
  }
  pose(aspect=16/9,alpha=1){
    const tactical=this.mode==='tactical',zoom=this.mode==='close'?.72:1,portrait=aspect<1;
    const x=tactical?0:this.previous.x+(this.target.x-this.previous.x)*alpha,y=tactical?0:this.previous.y+(this.target.y-this.previous.y)*alpha;
    return {version:'camera-rig-v2',tick:this.tick,target:{x,y,z:0},position:{x,y:y+(tactical?45:(portrait?56:38)*zoom),z:tactical?95:(portrait?70:38)*zoom},fov:42};
  }
}
