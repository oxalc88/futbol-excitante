import * as THREE from 'three';
import type { Config, DeepReadonly, PlayerState, ReadonlyPresentation, TeamIndex } from '../contracts/types';
import { CameraRig, projectPoint, PLAYER_PROPORTIONS, playerHeightScale, playerPose, contactPose, EMBODIMENT_MAPPING, solveLimb, PALETTE, PITCH_PALETTES, type PitchPaletteId, teamSilhouettes, keeperSilhouette, type Kit, type SilhouetteColors } from './presentation-model';
import { clamp } from '../simulation/math';
export type { Kit } from './presentation-model';
interface Actor { contact:THREE.Group; segments:THREE.Mesh[]; root:THREE.Group; body:THREE.Group; arms:THREE.Group[]; legs:THREE.Group[]; elbows:THREE.Group[]; knees:THREE.Group[]; ring:THREE.Mesh; label:THREE.Sprite; }
export class FootballRenderer {
  private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(42,1,.1,350);
  private renderer:THREE.WebGLRenderer;private actors=new Map<string,Actor>();private ball:THREE.Mesh;private ballShadow:THREE.Mesh;private ballMarker:THREE.Mesh;
  private environment=new THREE.Group();private radar:CanvasRenderingContext2D;private target=new THREE.Vector3();private cameraReady=false;
  private config:DeepReadonly<Config>;private mode:'broadcast'|'tactical'|'close'='broadcast';private resizeObserver:ResizeObserver;
  private cameraRig=new CameraRig();private lastPose:ReturnType<CameraRig['pose']>|null=null;private lastAspect=1;
  private materials=new Map<string,THREE.MeshToonMaterial>();private outlines:THREE.Mesh[]=[];
  private outlineMaterial=new THREE.MeshBasicMaterial({color:PALETTE.outline,side:THREE.BackSide});
  private pitchMaterials=PALETTE.pitch.map(color=>new THREE.MeshToonMaterial({color}));
  private surroundMaterial=new THREE.MeshToonMaterial({color:PALETTE.surround});
  private teams:[SilhouetteColors,SilhouetteColors];private keeper:SilhouetteColors;
  private geometries=new Map<string,THREE.BufferGeometry>();
  // Players share limb geometries; only transforms differ.
  private geometry(key:string,make:()=>THREE.BufferGeometry){let g=this.geometries.get(key);if(!g){g=make();this.geometries.set(key,g);}return g;}
  private material(color:string){let m=this.materials.get(color);if(!m){m=new THREE.MeshToonMaterial({color});this.materials.set(color,m);}return m;}
  // Three hulls per player. Reuse each source geometry and one unlit material.
  private outline(mesh:THREE.Mesh,scale:number){const hull=new THREE.Mesh(mesh.geometry,this.outlineMaterial);hull.scale.setScalar(scale);hull.visible=this.quality!=='low';mesh.add(hull);this.outlines.push(hull);}
  advanceCamera(s:ReadonlyPresentation){this.cameraRig.advance(s);}
  screenPoint(p:{x:number,y:number,z:number}){if(!this.lastPose)return null;const c=this.renderer.domElement,r=c.getBoundingClientRect(),n=projectPoint(this.lastPose,this.lastAspect,p);if(!n.front)return null;return{x:r.left+(n.x+1)*r.width/2,y:r.top+(1-n.y)*r.height/2};}
  private kits:[Kit,Kit];private quality='high';private animations=true;
  constructor(private container:HTMLElement,radar:HTMLCanvasElement,config:DeepReadonly<Config>,kits:[Kit,Kit],createRenderer:()=>THREE.WebGLRenderer=()=>new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})){
    this.config=config;this.kits=kits;this.teams=teamSilhouettes(kits);this.keeper=keeperSilhouette(this.teams);this.radar=radar.getContext('2d')!;
    this.renderer=createRenderer();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Cancha de fútbol 3D');
    this.scene.background=new THREE.Color('#163f43');this.scene.fog=new THREE.Fog('#1a393f',100,240);
    this.scene.add(new THREE.HemisphereLight('#ffffff','#a0a8ab',1.9));
    const sun=new THREE.DirectionalLight('#ffffff',1.7);sun.position.set(-35,65,20);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:48,bottom:-48,near:1,far:160});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0005;sun.shadow.normalBias=.03;this.scene.add(sun);
    this.scene.add(this.environment);this.pitch();
    this.ball=new THREE.Mesh(new THREE.IcosahedronGeometry(config.physics.radius*1.8,2),new THREE.MeshBasicMaterial({color:PALETTE.ball,toneMapped:false}));this.ball.castShadow=true;
    const ballHull=new THREE.Mesh(this.ball.geometry,this.outlineMaterial);ballHull.scale.setScalar(1.14);this.ball.add(ballHull);this.scene.add(this.ball);
    this.ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.21,32),new THREE.MeshBasicMaterial({color:'#07100c',transparent:true,opacity:.85,depthWrite:false}));this.ballShadow.rotation.x=-Math.PI/2;this.scene.add(this.ballShadow);
    this.ballMarker=new THREE.Mesh(new THREE.RingGeometry(.32,.5,32),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));this.ballMarker.rotation.x=-Math.PI/2;this.scene.add(this.ballMarker);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  }
  setCamera(mode:'broadcast'|'tactical'|'close'){this.mode=mode;this.cameraRig.mode=mode;this.cameraReady=false;}
  setQuality(quality:string){this.quality=quality;this.outlines.forEach(o=>o.visible=quality!=='low');this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:1.8));this.renderer.shadowMap.enabled=quality!=='low';this.resize();}
  setPitchPalette(id:PitchPaletteId){const palette=PITCH_PALETTES[id];this.pitchMaterials.forEach((m,i)=>m.color.set(palette.pitch[i]));this.surroundMaterial.color.set(palette.surround);}
  setAnimations(value:boolean){this.animations=value;}
  private resize(){const r=this.container.getBoundingClientRect();this.renderer.setSize(r.width,r.height);this.camera.aspect=r.width/Math.max(1,r.height);this.camera.updateProjectionMatrix();}
  private box(w:number,h:number,d:number,color:string,x:number,y:number,z:number,parent:THREE.Object3D=this.environment){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.material(color));mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  private line(points:number[][],color:string=PALETTE.lines,opacity=1,parent:THREE.Object3D=this.environment){
    const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])));const l=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));parent.add(l);return l;
  }
  private pitch(){
    const {length:L,width:W,goalWidth:G,goalHeight:H}=this.config.pitch;
    this.box(L+34,.5,W+36,PALETTE.surround,0,-.35,0).material=this.surroundMaterial;
    for(let i=0;i<12;i++)this.box(L/12,.07,W,PALETTE.pitch[i%2],-L/2+(i+.5)*L/12,-.035,0).material=this.pitchMaterials[i%2];
    const y=.025;this.line([[-L/2,y,-W/2],[L/2,y,-W/2],[L/2,y,W/2],[-L/2,y,W/2],[-L/2,y,-W/2]]);
    this.line([[0,y,-W/2],[0,y,W/2]]);
    const circle=(x:number,z:number,r:number,start=0,end=Math.PI*2)=>this.line(Array.from({length:81},(_,i)=>[x+Math.cos(start+(end-start)*i/80)*r,y,z+Math.sin(start+(end-start)*i/80)*r]));
    circle(0,0,9.15);circle(0,0,.16);
    for(const dir of [-1,1]){
      const x=dir*L/2;
      this.line([[x,y,-20.16],[x-dir*16.5,y,-20.16],[x-dir*16.5,y,20.16],[x,y,20.16]]);
      this.line([[x,y,-9.16],[x-dir*5.5,y,-9.16],[x-dir*5.5,y,9.16],[x,y,9.16]]);circle(x-dir*11,0,.16);
      circle(x-dir*11,0,9.15,dir===1?Math.PI-.93:-.93,dir===1?Math.PI+.93:.93);
      for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,H,8),this.material('#f5f0dc'));post.position.set(x,H/2,side*G/2);post.castShadow=true;this.environment.add(post);}
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,G,8),this.material('#f5f0dc'));bar.rotation.x=Math.PI/2;bar.position.set(x,H,0);this.environment.add(bar);
      // Net follows authoritative goal dimensions, with low-contrast strands.
      for(let z=-G/2;z<=G/2;z+=.28)this.line([[x,H,z],[x+dir*2,H*.75,z],[x+dir*2,.04,z]],'#ccd8bc',.3);
      for(let h=0;h<=H*.75;h+=.28)this.line([[x,Math.min(H,h*1.3),-G/2],[x+dir*2,h,-G/2],[x+dir*2,h,G/2],[x,Math.min(H,h*1.3),G/2]],'#ccd8bc',.3);
      for(const side of [-1,1]){
        this.box(.035,1.5,.035,'#e8e2c8',x,.75,side*W/2);this.box(.45,.32,.02,'#f4c855',x+.22,1.34,side*W/2);
      }
    }
    for(const side of [-1,1]){
      for(let tier=0;tier<5;tier++)this.box(L+15,1.3,2.5,PALETTE.stands[tier%2],0,1+tier*1.3,side*(W/2+8+tier*2.4));
      this.box(L+8,.75,.45,PALETTE.barrier,0,.5,side*(W/2+4));
      for(let block=0;block<16;block++)this.box(4.8,.65,.5,PALETTE.barrier,-L/2+3+block*6.4,.55,side*(W/2+3.8));
    }
  }
  private actor(p:DeepReadonly<PlayerState>):Actor {
    const kit=this.kits[p.team],root=new THREE.Group(),body=new THREE.Group();root.add(body);
    const colors=p.keeper?this.keeper:this.teams[p.team],skin=colors.limb,shirt=colors.body;
    const d=PLAYER_PROPORTIONS,scale=playerHeightScale(p),hip=.1+d.lowerLeg+d.upperLeg,waist=hip+d.hips,shoulder=waist+d.torso;
    const rounded=(top:number,bottom:number,height:number,color:string,x:number,y:number,z:number,parent:THREE.Object3D)=>{
      const mesh=new THREE.Mesh(this.geometry(`c${top}/${bottom}/${height}`,()=>new THREE.CylinderGeometry(top,bottom,height,10)),this.material(color));mesh.position.set(x,y,z);mesh.scale.z=.7;parent.add(mesh);return mesh;
    };
    const oval=(x:number,y:number,z:number,color:string,parent:THREE.Object3D,px=0,py=0,pz=0)=>{
      const mesh=new THREE.Mesh(this.geometry('s',()=>new THREE.SphereGeometry(1,10,8)),this.material(color));mesh.scale.set(x,y,z);mesh.position.set(px,py,pz);parent.add(mesh);return mesh;
    };
    const torso=rounded(d.shoulderWidth/2,d.waistWidth/2,d.torso,shirt,0,waist+d.torso/2,0,body);
    const shorts=rounded(d.waistWidth/2,.19,d.hips,shirt,0,hip+d.hips/2,0,body);this.outline(torso,1.08);this.outline(shorts,1.08);
    if(!p.keeper&&kit.pattern==='band')rounded(.211,.192,.10,colors.trim,0,waist+d.torso*.56,0,body);
    rounded(.065,.07,d.neck,skin,0,shoulder+d.neck/2,0,body);
    const head=oval(.095,d.head/2,.105,skin,body,0,shoulder+d.neck+d.head/2);this.outline(head,1.1);
    const arms:THREE.Group[]=[],legs:THREE.Group[]=[],elbows:THREE.Group[]=[],knees:THREE.Group[]=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*d.shoulderWidth/2,shoulder-.04,0);body.add(arm);
      oval(.085,.09,.075,shirt,arm);
      rounded(.075,.055,d.upperArm,shirt,0,-d.upperArm/2,0,arm);
      const elbow=new THREE.Group();elbow.position.y=-d.upperArm;arm.add(elbow);
      oval(.055,.055,.055,skin,elbow);rounded(.055,.04,d.forearm,skin,0,-d.forearm/2,0,elbow);
      oval(.05,.07,.045,p.keeper?colors.trim:skin,elbow,0,-d.forearm);arms.push(arm);elbows.push(elbow);
      const leg=new THREE.Group();leg.position.set(side*.105,hip,0);body.add(leg);
      rounded(.085,.065,d.upperLeg,skin,0,-d.upperLeg/2,0,leg);
      const knee=new THREE.Group();knee.position.y=-d.upperLeg;leg.add(knee);
      oval(.065,.065,.06,skin,knee);rounded(.065,.045,d.lowerLeg,shirt,0,-d.lowerLeg/2,0,knee);
      oval(.075,.05,.15,colors.trim,knee,0,-d.lowerLeg-.05,.065);legs.push(leg);knees.push(knee);
    }
    body.scale.setScalar(scale);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.52,.64,32),new THREE.MeshBasicMaterial({color:'#ffe16b',side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;root.add(ring);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#112139';ctx.fillRect(0,0,128,64);ctx.fillStyle='#fff7dd';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText(String(p.number),64,48);
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));label.position.set(0,2.5,0);label.scale.set(1.1,.55,1);root.add(label);
    root.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=o.material!==this.outlineMaterial;});this.scene.add(root);
    const contact=new THREE.Group();root.add(contact);const segments=[0,1,2].map(i=>{const m=new THREE.Mesh(new THREE.BoxGeometry(i===2?.17:.13,1,i===2?.28:.14),this.material(i===2?colors.trim:skin));contact.add(m);return m;});contact.visible=false;
    return {root,body,arms,legs,elbows,knees,ring,label,contact,segments};
  }
  draw(previous:ReadonlyPresentation,current:ReadonlyPresentation,alpha:number,_frameDt:number){
    const teleport=previous.phase!==current.phase||current.events.some(e=>e.type==='restart-awarded');const blend=teleport?1:clamp(alpha,0,1);
    const previousPlayers=new Map(previous.players.map(p=>[p.id,p]));
    for(const p of current.players){let a=this.actors.get(p.id);if(!a){a=this.actor(p);this.actors.set(p.id,a);}a.root.visible=!p.sentOff;if(p.sentOff)continue;const prev=previousPlayers.get(p.id)??p;
      a.root.position.set(THREE.MathUtils.lerp(prev.x,p.x,blend),0,THREE.MathUtils.lerp(prev.y,p.y,blend));
      const turn=Math.atan2(Math.sin(p.heading-prev.heading),Math.cos(p.heading-prev.heading));a.root.rotation.y=Math.PI/2-(prev.heading+turn*blend);
      const motion=this.animations?playerPose(p,current.tick,blend,prev.heading):{hipL:0,hipR:0,kneeL:0,kneeR:0,shoulderL:0,shoulderR:0,elbowL:0,elbowR:0,lean:0,roll:0,bob:0,armSpread:.12};
      a.legs[0].rotation.x=motion.hipL;a.legs[1].rotation.x=motion.hipR;
      a.knees[0].rotation.x=motion.kneeL;a.knees[1].rotation.x=motion.kneeR;
      a.arms[0].rotation.x=motion.shoulderL;a.arms[1].rotation.x=motion.shoulderR;
      a.elbows[0].rotation.x=-motion.elbowL;a.elbows[1].rotation.x=-motion.elbowR;
      a.arms[0].rotation.z=-motion.armSpread;a.arms[1].rotation.z=motion.armSpread;
      a.body.position.y=motion.bob;a.body.rotation.set(motion.lean,0,motion.roll);
      a.legs.forEach(l=>l.visible=true);a.arms.forEach(l=>l.visible=true);a.contact.visible=false;
      const pose=contactPose(p,current);
      if(this.animations&&pose?.reachable&&pose.surface!=='head'){
        const hand=pose.surface==='hand',side=p.foot==='left'?0:1;
        const origin={x:p.x,y:p.y,z:hand?1.4:.76},limb=solveLimb(origin,pose.point,hand?EMBODIMENT_MAPPING.limbs.arm:EMBODIMENT_MAPPING.limbs.leg);
        if(limb){a.contact.visible=true;(hand?a.arms:a.legs)[side].visible=false;a.root.updateMatrixWorld(true);
          const points=[limb.root,limb.knee,limb.end].map(v=>a!.root.worldToLocal(new THREE.Vector3(v.x,v.z,v.y)));
          for(let i=0;i<2;i++){const m=a.segments[i],d=new THREE.Vector3().subVectors(points[i+1],points[i]);m.position.copy(points[i]).add(points[i+1]).multiplyScalar(.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}
          a.segments[2].position.copy(points[2]);a.segments[2].scale.y=.12;
        }
      }
      if(this.animations&&pose?.reachable&&pose.surface==='head'){a.body.position.y=clamp(pose.point.z-1.65,-.6,.6);a.body.rotation.x=clamp(Math.hypot(pose.point.x-p.x,pose.point.y-p.y),0,.5);}
      const selected=current.selected.includes(p.id);a.ring.visible=selected;a.label.visible=selected;
      (a.ring.material as THREE.MeshBasicMaterial).color.set(p.team===0?'#ffe779':'#f5f8ff');
    }
    const b=current.ball,pb=previous.ball;this.ball.position.set(THREE.MathUtils.lerp(pb.x,b.x,blend),THREE.MathUtils.lerp(pb.z,b.z,blend),THREE.MathUtils.lerp(pb.y,b.y,blend));
    this.ball.rotation.x=this.cameraRig.rotation.x;this.ball.rotation.z=this.cameraRig.rotation.z;
    this.ballShadow.position.set(this.ball.position.x,.03,this.ball.position.z);this.ballShadow.scale.setScalar(1+Math.min(b.z,8)*.13);(this.ballShadow.material as THREE.MeshBasicMaterial).opacity=.85/(1+b.z*.2);
    this.cameraRig.advance(current);const camera=this.cameraRig.pose(this.camera.aspect,blend);this.lastPose=camera;this.lastAspect=this.camera.aspect;
    this.camera.position.set(camera.position.x,camera.position.z,camera.position.y);this.camera.lookAt(camera.target.x,0,camera.target.y);
    this.ballMarker.position.set(this.ball.position.x,.04,this.ball.position.z);this.ballMarker.scale.setScalar(clamp(this.camera.position.distanceTo(this.ball.position)/45,1,2.2));
    this.renderer.render(this.scene,this.camera);this.drawRadar(current);
  }
  private drawRadar(s:ReadonlyPresentation){
    const ctx=this.radar,canvas=ctx.canvas,W=canvas.width,H=canvas.height,L=this.config.pitch.length,B=this.config.pitch.width;
    const xy=(x:number,y:number)=>[8+(x/L+.5)*(W-16),8+(y/B+.5)*(H-16)];
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#102a31dd';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#9eb9b477';ctx.lineWidth=1;ctx.strokeRect(8,8,W-16,H-16);ctx.beginPath();ctx.moveTo(W/2,8);ctx.lineTo(W/2,H-8);ctx.stroke();ctx.beginPath();ctx.ellipse(W/2,H/2,(W-16)*9.15/L,(H-16)*9.15/B,0,0,Math.PI*2);ctx.stroke();
    for(const p of s.players){if(p.sentOff)continue;const [x,y]=xy(p.x,p.y);ctx.fillStyle=p.team===0?'#ffe4a7':'#69baff';ctx.beginPath();ctx.arc(x,y,s.selected.includes(p.id)?3.5:2.1,0,Math.PI*2);ctx.fill();if(s.selected.includes(p.id)){ctx.strokeStyle='#fff';ctx.stroke();}}
    const [x,y]=xy(s.ball.x,s.ball.y);ctx.fillStyle='#fff';ctx.fillRect(x-2,y-2,4,4);
  }
  dispose(){this.resizeObserver.disconnect();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>([...this.materials.values(),this.outlineMaterial]);this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});for(const a of this.actors.values()){a.label.material.map?.dispose();materials.add(a.label.material);}geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();this.renderer.domElement.remove();}
}
