import type { DeepReadonly, PlayerState, ReadonlyPresentation, Vec3 } from '../contracts/types';
import { clamp } from '../simulation/math';

export const EMBODIMENT_MAPPING={version:'procedural-rig-v2',metresPerUnit:1,
  surfaces:{foot:{maxHorizontalReach:1.6,maxHeight:1.1},head:{maxHorizontalReach:.7,maxHeight:2.25},hand:{maxHorizontalReach:1.2,maxHeight:2.8}},
  limbs:{leg:[.78,.78],arm:[.72,.72]},contactTolerance:.025} as const;
export function contactPose(p:DeepReadonly<PlayerState>,s:ReadonlyPresentation){
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
  advance(s:ReadonlyPresentation){
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

// Palette
/** Linear-light value bands: quiet ground, clear teams, and a white ball. */
export interface Kit { shirt:string; shorts:string; accent:string; pattern:'band'|'plain' }
export const PITCH_PALETTES={
  viva:{pitch:['#378a43','#3d9349'],surround:'#2e6a39',stands:['#243438','#29393c']},
  sobria:{pitch:['#4c6e57','#50725b'],surround:'#3a5446',stands:['#243438','#29393c']}
} as const;
export type PitchPaletteId=keyof typeof PITCH_PALETTES;
export const PALETTE={...PITCH_PALETTES.viva,barrier:'#304145',outline:'#17232b',lines:'#dce3d8',ball:'#ffffff'} as const;
type RGB=[number,number,number];
const linear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const rgb=(color:string):RGB=>[1,3,5].map(i=>linear(parseInt(color.slice(i,i+2),16)/255)) as RGB;
const value=(c:RGB)=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
/** Relative luminance in linear sRGB. Kit colors use six-digit hex. */
export const luminance=(color:string)=>value(rgb(color));
function atValue(color:string,target:number){
  const c=rgb(color),v=value(c),up=v<target,t=up?(target-v)/(1-v):(v-target)/v;
  return '#'+c.map(n=>{const x=up?n+(1-n)*t:n*(1-t);return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055)).toString(16).padStart(2,'0');}).join('');
}
export interface SilhouetteColors { body:string; trim:string; limb:string; outline:string }
/** Keep team 0 light and team 1 dark, even when their source kits match. */
export function teamSilhouettes(kits:readonly [Kit,Kit]):[SilhouetteColors,SilhouetteColors]{
  return kits.map((kit,i)=>{const target=i===0?.66:.11,body=atValue(kit.shirt,target);return {body,trim:atValue(kit.accent,target*.9),limb:atValue(kit.shirt,target*.96),outline:PALETTE.outline};}) as [SilhouetteColors,SilhouetteColors];
}
/** Choose a keeper hue far from both teams. Its value sits between the two team bands. */
export function keeperSilhouette(teams:readonly SilhouetteColors[]):SilhouetteColors {
  const candidates=['#f3cb32','#df62de','#35d9dc'].map(c=>atValue(c,.4));
  const distance=(a:string,b:string)=>rgb(a).reduce((sum,n,i)=>sum+(n-rgb(b)[i])**2,0);
  const body=candidates.reduce((best,c)=>Math.min(...teams.map(t=>distance(c,t.body)))>Math.min(...teams.map(t=>distance(best,t.body)))?c:best);
  return {body,trim:atValue(body,.36),limb:atValue(body,.39),outline:PALETTE.outline};
}
