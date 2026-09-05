import * as THREE from 'three';
import type { Config, PlayerState, Presentation, TeamIndex } from '../contracts/types';
import { clamp } from '../simulation/math';
export interface Kit { shirt:string; shorts:string; accent:string; pattern:'band'|'plain' }
interface Actor { root:THREE.Group; body:THREE.Group; arms:THREE.Group[]; legs:THREE.Group[]; ring:THREE.Mesh; label:THREE.Sprite; }
const material=(color:string)=>new THREE.MeshToonMaterial({color});
export class FootballRenderer {
  private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(42,1,.1,350);
  private renderer:THREE.WebGLRenderer;private actors=new Map<string,Actor>();private ball:THREE.Mesh;private ballShadow:THREE.Mesh;
  private environment=new THREE.Group();private radar:CanvasRenderingContext2D;private target=new THREE.Vector3();private cameraReady=false;
  private config:Config;private mode:'broadcast'|'tactical'|'close'='broadcast';private resizeObserver:ResizeObserver;
  private kits:[Kit,Kit];private quality='high';private animations=true;
  constructor(private container:HTMLElement,radar:HTMLCanvasElement,config:Config,kits:[Kit,Kit]){
    this.config=config;this.kits=kits;this.radar=radar.getContext('2d')!;
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Cancha de fútbol 3D');
    this.scene.background=new THREE.Color('#163f43');this.scene.fog=new THREE.Fog('#1a393f',100,240);
    this.scene.add(new THREE.HemisphereLight('#f4f4d7','#324d56',2.1));
    const sun=new THREE.DirectionalLight('#fff1d1',2.6);sun.position.set(-35,65,20);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:48,bottom:-48,near:1,far:160});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0005;sun.shadow.normalBias=.03;this.scene.add(sun);
    this.scene.add(this.environment);this.pitch();
    this.ball=new THREE.Mesh(new THREE.IcosahedronGeometry(config.physics.radius,2),material('#fff9e8'));this.ball.castShadow=true;
    const seam=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(config.physics.radius*1.002,0)),new THREE.LineBasicMaterial({color:'#344252',transparent:true,opacity:.5}));this.ball.add(seam);this.scene.add(this.ball);
    this.ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.18,20),new THREE.MeshBasicMaterial({color:'#102524',transparent:true,opacity:.55,depthWrite:false}));this.ballShadow.rotation.x=-Math.PI/2;this.scene.add(this.ballShadow);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  }
  setCamera(mode:'broadcast'|'tactical'|'close'){this.mode=mode;this.cameraReady=false;}
  setQuality(quality:string){this.quality=quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:1.8));this.renderer.shadowMap.enabled=quality!=='low';}
  setAnimations(value:boolean){this.animations=value;}
  private resize(){const r=this.container.getBoundingClientRect();this.renderer.setSize(r.width,r.height);this.camera.aspect=r.width/Math.max(1,r.height);this.camera.updateProjectionMatrix();}
  private box(w:number,h:number,d:number,color:string,x:number,y:number,z:number,parent:THREE.Object3D=this.environment){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  private line(points:number[][],color='#e5edcf',opacity=1,parent:THREE.Object3D=this.environment){
    const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])));const l=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));parent.add(l);return l;
  }
  private pitch(){
    const {length:L,width:W,goalWidth:G,goalHeight:H}=this.config.pitch;
    this.box(L+34,.5,W+36,'#244a40',0,-.35,0);
    for(let i=0;i<12;i++)this.box(L/12,.07,W,i%2?'#36764e':'#3c8054',-L/2+(i+.5)*L/12,-.035,0);
    const y=.025;this.line([[-L/2,y,-W/2],[L/2,y,-W/2],[L/2,y,W/2],[-L/2,y,W/2],[-L/2,y,-W/2]]);
    this.line([[0,y,-W/2],[0,y,W/2]]);
    const circle=(x:number,z:number,r:number,start=0,end=Math.PI*2)=>this.line(Array.from({length:81},(_,i)=>[x+Math.cos(start+(end-start)*i/80)*r,y,z+Math.sin(start+(end-start)*i/80)*r]));
    circle(0,0,9.15);circle(0,0,.16);
    for(const dir of [-1,1]){
      const x=dir*L/2;
      this.line([[x,y,-20.16],[x-dir*16.5,y,-20.16],[x-dir*16.5,y,20.16],[x,y,20.16]]);
      this.line([[x,y,-9.16],[x-dir*5.5,y,-9.16],[x-dir*5.5,y,9.16],[x,y,9.16]]);circle(x-dir*11,0,.16);
      circle(x-dir*11,0,9.15,dir===1?Math.PI-.93:-.93,dir===1?Math.PI+.93:.93);
      for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,H,8),material('#f5f0dc'));post.position.set(x,H/2,side*G/2);post.castShadow=true;this.environment.add(post);}
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,G,8),material('#f5f0dc'));bar.rotation.x=Math.PI/2;bar.position.set(x,H,0);this.environment.add(bar);
      // Net follows authoritative goal dimensions, with low-contrast strands.
      for(let z=-G/2;z<=G/2;z+=.28)this.line([[x,H,z],[x+dir*2,H*.75,z],[x+dir*2,.04,z]],'#ccd8bc',.3);
      for(let h=0;h<=H*.75;h+=.28)this.line([[x,Math.min(H,h*1.3),-G/2],[x+dir*2,h,-G/2],[x+dir*2,h,G/2],[x,Math.min(H,h*1.3),G/2]],'#ccd8bc',.3);
      for(const side of [-1,1]){
        this.box(.035,1.5,.035,'#e8e2c8',x,.75,side*W/2);this.box(.45,.32,.02,'#f4c855',x+.22,1.34,side*W/2);
      }
    }
    for(const side of [-1,1]){
      for(let tier=0;tier<5;tier++)this.box(L+15,1.3,2.5,tier%2?'#18363c':'#20434a',0,1+tier*1.3,side*(W/2+8+tier*2.4));
      this.box(L+8,.75,.45,'#163344',0,.5,side*(W/2+4));
      for(let block=0;block<16;block++)this.box(4.8,.65,.5,block%2?'#2a5961':'#d5b26d',-L/2+3+block*6.4,.55,side*(W/2+3.8));
    }
  }
  private actor(p:PlayerState):Actor {
    const kit=this.kits[p.team],root=new THREE.Group(),body=new THREE.Group();root.add(body);
    const skin=['#dfab7c','#a26b47','#724a35','#bd8a65'][p.number%4],shirt=p.keeper?(p.team===0?'#fba83b':'#b991f0'):kit.shirt;
    const scale=[.96,1.03,1.08,1][p.number%4];
    const torso=this.box(.46,.57,.25,shirt,0,1.2,0,body);torso.castShadow=true;
    this.box(.41,.24,.28,p.keeper?'#1e2639':kit.shorts,0,.81,0,body);
    if(!p.keeper&&kit.pattern==='band')this.box(.475,.13,.262,kit.accent,0,1.22,0,body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),material(skin));head.position.y=1.65;head.castShadow=true;body.add(head);
    const hair=new THREE.Mesh(new THREE.SphereGeometry(.168,8,5,0,Math.PI*2,0,Math.PI*.48),material(p.number%3?'#252423':'#573b27'));hair.position.y=1.68;body.add(hair);
    // Asymmetric nose and boots retain facing information at gameplay distance.
    this.box(.08,.075,.09,skin,0,1.66,.145,body);
    const arms:THREE.Group[]=[],legs:THREE.Group[]=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.28,1.43,0);body.add(arm);
      this.box(.15,.24,.17,shirt,0,-.1,0,arm);this.box(.12,.28,.12,skin,0,-.34,0,arm);if(p.keeper)this.box(.16,.14,.17,'#e4ebd8',0,-.48,0,arm);arms.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.12,.76,0);body.add(leg);
      this.box(.16,.28,.18,skin,0,-.12,0,leg);this.box(.14,.27,.16,p.keeper?'#273144':shirt,0,-.37,0,leg);this.box(.17,.12,.3,'#202434',0,-.61,.07,leg);legs.push(leg);
    }
    body.scale.setScalar(scale);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.52,.64,32),new THREE.MeshBasicMaterial({color:'#ffe16b',side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;root.add(ring);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#112139';ctx.fillRect(0,0,128,64);ctx.fillStyle='#fff7dd';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText(String(p.number),64,48);
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));label.position.set(0,2.5,0);label.scale.set(1.1,.55,1);root.add(label);
    root.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});this.scene.add(root);
    return {root,body,arms,legs,ring,label};
  }
  draw(previous:Presentation,current:Presentation,alpha:number,frameDt:number){
    const teleport=previous.phase!==current.phase||current.events.some(e=>e.type==='restart-awarded');const blend=teleport?1:clamp(alpha,0,1);
    const previousPlayers=new Map(previous.players.map(p=>[p.id,p]));
    for(const p of current.players){let a=this.actors.get(p.id);if(!a){a=this.actor(p);this.actors.set(p.id,a);}const prev=previousPlayers.get(p.id)??p;
      a.root.position.set(THREE.MathUtils.lerp(prev.x,p.x,blend),0,THREE.MathUtils.lerp(prev.y,p.y,blend));
      const turn=Math.atan2(Math.sin(p.heading-prev.heading),Math.cos(p.heading-prev.heading));a.root.rotation.y=Math.PI/2-(prev.heading+turn*blend);
      const gait=this.animations?Math.sin(p.travel*4):0,speed=Math.min(1,Math.hypot(p.vx,p.vy)/7);
      a.legs[0].rotation.x=gait*.65*speed;a.legs[1].rotation.x=-gait*.65*speed;a.arms[0].rotation.x=-gait*.45*speed;a.arms[1].rotation.x=gait*.45*speed;
      a.arms[0].rotation.z=.12;a.arms[1].rotation.z=-.12;a.body.position.y=Math.abs(gait)*.035*speed;a.body.rotation.x=.1*speed;
      if(p.action&&this.animations){const time=current.tick-p.action.contact;
        if(p.action.kind==='tackle'){a.body.rotation.x=-.7;a.legs[1].rotation.x=-1.25;}
        else if(p.action.kind==='header'){a.body.position.y+=Math.max(0,Math.sin((current.tick-p.action.start)/28*Math.PI))*.28;a.arms[0].rotation.z=.7;a.arms[1].rotation.z=-.7;}
        else{a.legs[p.foot==='left'?0:1].rotation.x=time<0?.55:-Math.max(0,1-time/20)*1.1;}
      }
      if(p.recovery>0){a.body.rotation.x=.8;a.body.position.y=-.35;}
      const selected=current.selected.includes(p.id);a.ring.visible=selected;a.label.visible=selected;
      (a.ring.material as THREE.MeshBasicMaterial).color.set(p.team===0?'#ffe779':'#f5f8ff');
    }
    const b=current.ball,pb=previous.ball;this.ball.position.set(THREE.MathUtils.lerp(pb.x,b.x,blend),THREE.MathUtils.lerp(pb.z,b.z,blend),THREE.MathUtils.lerp(pb.y,b.y,blend));
    this.ball.rotation.x+=b.vy*frameDt/.11;this.ball.rotation.z-=b.vx*frameDt/.11;
    this.ballShadow.position.set(this.ball.position.x,.03,this.ball.position.z);this.ballShadow.scale.setScalar(1+Math.min(b.z,8)*.13);(this.ballShadow.material as THREE.MeshBasicMaterial).opacity=.55/(1+b.z*.2);
    const portrait=this.camera.aspect<1;const wanted=new THREE.Vector3(clamp(b.x*.7,-33,33),0,clamp(b.y*.5,-13,13));
    const tactical=this.mode==='tactical';if(tactical)wanted.set(0,0,0);
    if(!this.cameraReady){this.target.copy(wanted);this.cameraReady=true;}else this.target.lerp(wanted,1-Math.exp(-frameDt*4));
    const zoom=this.mode==='close'? .72:1;const height=tactical?95:(portrait?70:38)*zoom,back=tactical?45:(portrait?56:38)*zoom;
    this.camera.position.set(this.target.x,height,this.target.z+back);this.camera.lookAt(this.target.x,0,this.target.z);
    this.renderer.render(this.scene,this.camera);this.drawRadar(current);
  }
  private drawRadar(s:Presentation){
    const ctx=this.radar,canvas=ctx.canvas,W=canvas.width,H=canvas.height,L=this.config.pitch.length,B=this.config.pitch.width;
    const xy=(x:number,y:number)=>[8+(x/L+.5)*(W-16),8+(y/B+.5)*(H-16)];
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#102a31dd';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#9eb9b477';ctx.lineWidth=1;ctx.strokeRect(8,8,W-16,H-16);ctx.beginPath();ctx.moveTo(W/2,8);ctx.lineTo(W/2,H-8);ctx.stroke();ctx.beginPath();ctx.ellipse(W/2,H/2,(W-16)*9.15/L,(H-16)*9.15/B,0,0,Math.PI*2);ctx.stroke();
    for(const p of s.players){const [x,y]=xy(p.x,p.y);ctx.fillStyle=p.team===0?'#ffe4a7':'#69baff';ctx.beginPath();ctx.arc(x,y,s.selected.includes(p.id)?3.5:2.1,0,Math.PI*2);ctx.fill();if(s.selected.includes(p.id)){ctx.strokeStyle='#fff';ctx.stroke();}}
    const [x,y]=xy(s.ball.x,s.ball.y);ctx.fillStyle='#fff';ctx.fillRect(x-2,y-2,4,4);
  }
  dispose(){this.resizeObserver.disconnect();this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>{if('map'in m)(m.map as THREE.Texture|null)?.dispose();m.dispose();});}});this.renderer.dispose();this.renderer.domElement.remove();}
}
