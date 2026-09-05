import type { InputFrame, Presentation, World } from '../contracts/types';
import { clamp } from '../simulation/math';
type Message={type:string;[key:string]:unknown};
export class PeerSession {
  private pc:RTCPeerConnection|null=null;private channel:RTCDataChannel|null=null;private latest:Partial<InputFrame>={};
  private receivedSequence=0;private sentInputSequence=0;private pendingAction:InputFrame['action'];private pendingSwitch=false;private lastInputAt=0;
  role:'host'|'guest'|null=null;onStatus:(status:string)=>void=()=>{};onStart:(world:World)=>void=()=>{};onSnapshot:(s:Presentation)=>void=()=>{};onConnect:()=>void=()=>{};
  private guestSnapshot:Presentation|null=null;
  get connected(){return this.channel?.readyState==='open';}
  private init(role:'host'|'guest',stun:string){
    this.close();this.role=role;this.pc=new RTCPeerConnection({iceServers:stun?[{urls:stun}]:[]});
    this.pc.onconnectionstatechange=()=>{const s=this.pc?.connectionState;this.onStatus(s==='connected'?'Conectado':s==='failed'?'No se pudo conectar. Prueba un servidor STUN/TURN compatible.':s==='disconnected'?'Conexión interrumpida':s==='closed'?'Conexión cerrada':'Conectando…');};
    if(role==='host')this.bind(this.pc.createDataChannel('match-v1',{ordered:true}));else this.pc.ondatachannel=e=>this.bind(e.channel);
  }
  private bind(channel:RTCDataChannel){this.channel=channel;channel.onopen=()=>{this.onStatus('Conectado');this.onConnect();};channel.onclose=()=>this.onStatus('Conexión cerrada');
    channel.onmessage=e=>{try{if(typeof e.data!=='string'||e.data.length>150000)return;const m=JSON.parse(e.data)as Message;
      if(m.type==='input'&&this.role==='host'){
        const f=m.frame as Partial<InputFrame>;if(!f?.move||!f.aim||![f.move.x,f.move.y,f.aim.x,f.aim.y,f.power??.5].every(Number.isFinite))return;
        this.latest={move:{x:clamp(f.move.x,-1,1),y:clamp(f.move.y,-1,1)},aim:{x:clamp(f.aim.x,-1,1),y:clamp(f.aim.y,-1,1)},power:clamp(f.power??.5,0,1),sprint:!!f.sprint,shield:!!f.shield};this.lastInputAt=performance.now();
        if(Number.isInteger(m.sequence)&&Number(m.sequence)>this.receivedSequence){this.receivedSequence=Number(m.sequence);if(f.action&&['pass','shoot','cross','through','tackle','header'].includes(f.action))this.pendingAction=f.action;this.pendingSwitch||=!!f.switchPlayer;}
      }
      if(m.type==='start'&&this.role==='guest'){const w=m.world as World;this.guestSnapshot=structuredClone({tick:w.tick,phase:w.phase,half:w.half,played:w.played,score:w.score,stats:w.stats,selected:w.selected,ball:w.ball,players:w.players,events:w.events,teams:w.teams});this.onStart(w);}
      if(m.type==='snapshot'&&this.role==='guest'&&this.guestSnapshot){
        const patch=m.patch as Omit<Presentation,'players'> & {players:Partial<Presentation['players'][number]>[]};
        if(!patch||!Number.isInteger(patch.tick)||patch.tick<=this.guestSnapshot.tick||!Array.isArray(patch.players)||patch.players.length!==this.guestSnapshot.players.length)return;
        const players=this.guestSnapshot.players.map((p,i)=>{const q=patch.players[i];if(q.id!==p.id||![q.x,q.y,q.vx,q.vy,q.heading,q.energy,q.travel].every(v=>typeof v==='number'&&Number.isFinite(v)))throw new Error('Invalid network transform');return{...p,...q};});
        this.guestSnapshot={...this.guestSnapshot,...patch,players};this.onSnapshot(structuredClone(this.guestSnapshot));
      }
    }catch{this.onStatus('Se descartó un mensaje de conexión inválido.');}};
  }
  private async gather(){const pc=this.pc!;if(pc.iceGatheringState==='complete')return;
    await new Promise<void>(resolve=>{const timer=setTimeout(done,8000);function done(){clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve();}function check(){if(pc.iceGatheringState==='complete')done();}pc.addEventListener('icegatheringstatechange',check);});
  }
  async offer(stun=''){this.init('host',stun);await this.pc!.setLocalDescription(await this.pc!.createOffer());await this.gather();return JSON.stringify(this.pc!.localDescription);}
  async answer(code:string,stun=''){this.init('guest',stun);const description=this.description(code,'offer');await this.pc!.setRemoteDescription(description);await this.pc!.setLocalDescription(await this.pc!.createAnswer());await this.gather();return JSON.stringify(this.pc!.localDescription);}
  async accept(code:string){if(this.role!=='host'||!this.pc)throw new Error('Primero crea una invitación.');await this.pc.setRemoteDescription(this.description(code,'answer'));}
  private description(code:string,type:string){const s=JSON.parse(code)as RTCSessionDescriptionInit;if(code.length>100000||s.type!==type||typeof s.sdp!=='string')throw new Error('Código de conexión inválido.');return s;}
  private send(m:object){if(this.connected&&this.channel!.bufferedAmount<100000)this.channel!.send(JSON.stringify(m));}
  start(world:World){this.send({type:'start',world});}
  snapshot(snapshot:Presentation){
    const {players,...metadata}=snapshot;
    this.send({type:'snapshot',patch:{...metadata,players:players.map(p=>({id:p.id,x:p.x,y:p.y,vx:p.vx,vy:p.vy,heading:p.heading,energy:p.energy,travel:p.travel,recovery:p.recovery,action:p.action}))}});
  }
  input(frame:InputFrame){if(frame.action||frame.switchPlayer)this.sentInputSequence++;this.send({type:'input',sequence:this.sentInputSequence,frame});}
  hostFrame(tick:number):InputFrame {
    const fresh=this.connected&&performance.now()-this.lastInputAt<350;
    const result:InputFrame={tick,slot:1,move:{x:0,y:0},aim:{x:-1,y:0},sprint:false,shield:false,...(fresh?this.latest:{}),action:fresh?this.pendingAction:undefined,switchPlayer:fresh&&this.pendingSwitch};this.pendingAction=undefined;this.pendingSwitch=false;return result;
  }
  close(){if(this.channel){this.channel.onclose=null;this.channel.onmessage=null;this.channel.onopen=null;this.channel.close();}if(this.pc){this.pc.onconnectionstatechange=null;this.pc.ondatachannel=null;this.pc.close();}this.channel=null;this.pc=null;this.role=null;this.latest={};this.receivedSequence=0;this.sentInputSequence=0;this.pendingAction=undefined;this.pendingSwitch=false;this.guestSnapshot=null;}
}
