'use strict';
// The hardware transport is a byte stream. Both the real Android bridge and
// software peers implement the same five methods; no physical mode falls back
// to a practice drone.
(function(root){
 const D=root.FieldKitDeployment;
 const fail=m=>{throw Error(m);};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 function bytesTo64(bytes){let s='';for(const x of bytes)s+=String.fromCharCode(x);return btoa(s);}
 function bytesFrom64(s){const b=atob(s);return Uint8Array.from(b,c=>c.charCodeAt(0));}
 class AndroidLink{
  constructor(bridge=root.Android){if(!bridge?.listConfigPorts||!bridge?.readConfigBytes||!bridge?.writeConfigBytes)fail('This Android build has no connected configuration transport');this.bridge=bridge;}
  list(){return JSON.parse(this.bridge.listConfigPorts());}
  async openUsb(id,baud=115200){let s=JSON.parse(this.bridge.openConfigUsb(id,baud));for(let i=0;s.state==='permission-pending'&&i<100;i++){await sleep(100);s=JSON.parse(this.bridge.configPortStatus());}if(s.state!=='connected')fail(s.error||'USB permission timed out');return s;}
  async openUdp(port=14550){const s=JSON.parse(this.bridge.openConfigUdp(port));if(s.state!=='connected')fail(s.error||'UDP listen failed');return s;}
  async reconnectUsb(portId,usbSerial,baud){this.close();const until=Date.now()+15000;while(Date.now()<until){const ports=this.list();let next=usbSerial?ports.find(p=>p.serial===usbSerial):ports.find(p=>p.id===portId);if(!next&&!usbSerial&&ports.length===1)next=ports[0];if(next){const status=await this.openUsb(next.id,baud);const after=this.list().find(p=>p.id===next.id);if(usbSerial&&after?.serial!==usbSerial)fail('USB serial changed after reboot');return status;}await sleep(300);}fail('Controller did not reconnect after save');}
  async read(){const s=this.bridge.readConfigBytes();const state=JSON.parse(this.bridge.configPortStatus());if(state.state!=='connected')fail(state.error||'Connection lost');return s?bytesFrom64(s):new Uint8Array();}
  async write(bytes){const response=this.bridge.writeConfigBytes(bytesTo64(bytes));if(response!=='ok')fail('Transport write: '+response);}
  status(){return JSON.parse(this.bridge.configPortStatus());}
  pinPeer(){return this.bridge.pinConfigPeer?.()||false;}
  close(){this.bridge.closeConfigPort();}
 }
 function crc(bytes,extra){let c=0xffff;for(const b of [...bytes,extra]){let t=b^(c&255);t^=(t<<4)&255;c=((c>>8)^(t<<8)^(t<<3)^(t>>4))&65535;}return c;}
 const extras={0:50,20:214,21:159,22:220,23:168,76:152,148:178};
 class MavWire{
  constructor(link){this.link=link;this.buf=[];this.seq=0;this.messages=[];}
  async send(id,payload){if(extras[id]==null)fail('Unsupported message');const h=[payload.length,0,0,this.seq++&255,255,190,id&255,(id>>8)&255,(id>>16)&255];const sum=crc([...h,...payload],extras[id]);await this.link.write(Uint8Array.from([253,...h,...payload,sum&255,sum>>8]));}
  async pump(){const next=await this.link.read();this.buf.push(...next);while(this.buf.length){const magic=this.buf[0];if(magic!==253&&magic!==254){this.buf.shift();continue;}const v2=magic===253,header=v2?10:6;if(this.buf.length<header)break;const size=this.buf[1],signed=v2&&(this.buf[2]&1);const length=header+size+2+(signed?13:0);if(this.buf.length<length)break;const packet=this.buf.splice(0,length);const id=v2?(packet[7]|packet[8]<<8|packet[9]<<16):packet[5];if(extras[id]==null)continue;const end=header+size,computed=crc(packet.slice(1,end),extras[id]);if(computed!==(packet[end]|packet[end+1]<<8))continue;if(signed)fail('Signed MAVLink requires an authenticated session; this build has no signing key support');this.messages.push({id,systemId:packet[v2?5:3],componentId:packet[v2?6:4],payload:Uint8Array.from(packet.slice(header,end)),time:Date.now()});}if(this.messages.length>10000)this.messages.splice(0,this.messages.length-10000);}
  async until(predicate,ms=5000){const end=Date.now()+ms;while(Date.now()<end){const i=this.messages.findIndex(predicate);if(i>=0)return this.messages.splice(i,1)[0];await this.pump();await sleep(0);}fail('MAVLink response timed out');}
  clear(){this.messages=[];}
 }
 const dv=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
 const le=(size)=>new Uint8Array(size);
 function writeName(b,offset,name){if(!/^[A-Z][A-Z0-9_]{0,15}$/.test(name))fail('Invalid MAVLink parameter name');for(let i=0;i<name.length;i++)b[offset+i]=name.charCodeAt(i);}
 function nameAt(b,offset){return String.fromCharCode(...b.slice(offset,offset+16)).split('\0')[0];}
 function paramValue(b,encoding){const d=dv(b),type=b[24],raw=d.getFloat32(0,true);if(type===9)return raw;if(encoding==='c-cast')return raw;if(encoding!=='bytewise')fail('Unknown parameter encoding');const methods={1:'getUint8',2:'getInt8',3:'getUint16',4:'getInt16',5:'getUint32',6:'getInt32'};if(!methods[type])fail('Unsupported parameter type '+type);return d[methods[type]](0,true);}
 function readParam(m,encoding){const b=m.payload;if(b.length<25)fail('Truncated PARAM_VALUE');return {name:nameAt(b,8),count:dv(b).getUint16(4,true),index:dv(b).getUint16(6,true),value:paramValue(b,encoding),type:b[24]};}
 class MavAdapter{
  constructor(link,stack,options={}){if(!['ardupilot','px4'].includes(stack))fail('Choose ArduPilot or PX4');this.mode='hardware';this.link=link;this.stack=stack;this.options=options;this.wire=new MavWire(link);this.verified=true;this.identity=null;this.lastHeartbeat=null;}
  async discover(){
   const hb=await this.wire.until(m=>m.id===0&&m.componentId===1,10000);const b=hb.payload;if(b.length<9)fail('Incomplete heartbeat');const stack=b[5]===3?'ardupilot':b[5]===12?'px4':null;if(stack!==this.stack)fail('Connected autopilot is not '+this.stack);if(b[6]&128)fail('Autopilot is armed');
   this.lastHeartbeat=hb;this.link.pinPeer?.();const cmd=le(33);const v=dv(cmd);v.setFloat32(0,148,true);v.setUint16(28,512,true);cmd[30]=hb.systemId;cmd[31]=hb.componentId;await this.wire.send(76,cmd);
   const version=await this.wire.until(m=>m.id===148&&m.systemId===hb.systemId&&m.componentId===hb.componentId,8000);const a=version.payload;if(a.length<60)fail('Autopilot version metadata not returned');const d=dv(a),capabilities=d.getBigUint64(0,true);const reported=capabilities&16n?'bytewise':capabilities&131072n?'c-cast':null;const encoding=reported||this.options.encoding;if(!['bytewise','c-cast'].includes(encoding))fail('Choose parameter encoding because the controller did not report one');const uid=d.getBigUint64(52,true);const uid2=a.slice(60,78);const uid2Hex=[...uid2].map(x=>x.toString(16).padStart(2,'0')).join('');const fallback=String(this.options.fallbackSerial||'').trim();const identity=uid!==0n?'MAV-'+uid.toString(16):uid2.some(x=>x!==0)?'MAV2-'+uid2Hex:fallback?'LABEL-'+fallback:null;if(!identity)fail('Enter the asset serial because this controller returned no UID');const fw=d.getUint32(8,true),firmware=[fw>>>24,(fw>>>16)&255,(fw>>>8)&255].join('.');const board=['MAV',d.getUint16(48,true),d.getUint16(50,true),d.getUint32(20,true)].join('-');
   this.identity={uid:identity,systemId:hb.systemId,componentId:hb.componentId,board,firmware,stack,encoding,identitySource:uid!==0n||uid2.some(x=>x!==0)?'controller-uid':'operator-label',encodingSource:reported?'controller':'operator-selection'};return this.identity;
  }
  async disarmed(){const id=this.identity;const h=await this.wire.until(m=>m.id===0&&m.systemId===id.systemId&&m.componentId===id.componentId,4000);if(h.payload.length<9||h.payload[6]&128)fail('Disarmed state could not be confirmed');this.lastHeartbeat=h;}
  async read(uid){
   const id=this.identity||await this.discover();if(uid&&uid!==id.uid)fail('Connected drone identity changed');await this.disarmed();const deadline=Date.now()+120000;
   for(let generation=0;generation<3&&Date.now()<deadline;generation++){
    this.wire.clear();await this.wire.send(21,Uint8Array.of(id.systemId,id.componentId));const entries=Object.create(null),indices=new Map();let count=null,last=Date.now(),changed=false;
    while(Date.now()-last<8000&&Date.now()<deadline){
     try {const m=await this.wire.until(m=>m.id===22&&m.systemId===id.systemId&&m.componentId===id.componentId,500);const p=readParam(m,id.encoding);if(p.index===65535)continue;if(count!==null&&count!==p.count){changed=true;break;}count=p.count;if(count<1||count>10000||p.index>=count)fail('Invalid parameter count/index');if(indices.has(p.index)&&indices.get(p.index)!==p.name){changed=true;break;}indices.set(p.index,p.name);entries[p.name]={value:p.value,type:p.type};last=Date.now();if(indices.size===count)break;}
     catch(e){if(!/timed out/.test(e.message))throw e;}
    }
    if(changed)continue;if(count===null)fail('No parameters received');
    for(let round=0;round<3&&!changed&&indices.size<count&&Date.now()<deadline;round++)for(let i=0;i<count&&Date.now()<deadline;i++)if(!indices.has(i)){
     const req=le(20);dv(req).setInt16(0,i,true);req[2]=id.systemId;req[3]=id.componentId;await this.wire.send(20,req);
     try {const m=await this.wire.until(m=>m.id===22&&m.systemId===id.systemId&&m.componentId===id.componentId,600);const p=readParam(m,id.encoding);if(p.index===65535)continue;if(p.count!==count||p.index>=count){changed=true;break;}if(indices.has(p.index)&&indices.get(p.index)!==p.name){changed=true;break;}indices.set(p.index,p.name);entries[p.name]={value:p.value,type:p.type};}catch(e){if(!/timed out/.test(e.message))throw e;}
    }
    if(changed)continue;if(indices.size!==count)fail('Incomplete parameter read: '+indices.size+'/'+count);await this.disarmed();return {...id,serial:id.uid,armed:false,complete:true,evidence:'hardware',entries};
   }
   fail('Parameter catalog kept changing; wait for startup to finish and read again');
  }
  async write(uid,change){const id=this.identity;if(!id||id.uid!==uid)fail('Connected drone identity changed');await this.disarmed();const key=change.key,b=le(23),v=dv(b);b.set(D.paramValueBytes(change.after,change.type,id.encoding),0);b[4]=id.systemId;b[5]=id.componentId;writeName(b,6,key);b[22]=change.type;this.wire.clear();await this.wire.send(23,b);const m=await this.wire.until(m=>m.id===22&&m.systemId===id.systemId&&m.componentId===id.componentId&&nameAt(m.payload,8)===key,4000);const p=readParam(m,id.encoding);if(p.type!==change.type||p.value!==change.after)fail('Parameter rejected: '+key);return {uid,key,value:p.value};}
  async commit(uid){if(uid!==this.identity?.uid)fail('Connected drone changed');await this.disarmed();return {uid,persisted:false,reconnected:true};}
 }
 class BetaflightAdapter{
  constructor(link,serial,portId,baud,usbSerial){if(!serial)fail('Enter the drone asset serial, or use a USB device with one');this.mode='hardware';this.link=link;this.serial=serial;this.portId=portId;this.baud=baud;this.usbSerial=usbSerial;this.verified=true;this.uid='BF-'+serial;this.identity=null;}
  async command(cmd,timeout=8000){await this.link.write(new TextEncoder().encode(cmd+'\r'));const end=Date.now()+timeout;let output='';while(Date.now()<end){const chunk=await this.link.read();if(chunk.length)output+=new TextDecoder().decode(chunk);if(output.length>300000)fail('CLI response too large');if(/(?:^|\r?\n)#\s*$/.test(output))return output;await sleep(0);}fail('Betaflight CLI response timed out: '+cmd);}
  async pullRaw(){await this.command('#',3000);const status=await this.command('status');if(!/arming disable flags\s*:\s*.*CLI/i.test(status))fail('CLI disarmed state was not confirmed');const version=await this.command('version');const dump=await this.command('dump all',30000);const start=dump.search(/^#\s*Betaflight\s*\//m);if(start<0)fail('Betaflight dump header missing');return {version,text:dump.slice(start).replace(/(?:^|\r?\n)#\s*$/,'')};}
  async read(uid){if(uid&&uid!==this.uid)fail('Connected USB serial changed');const {version,text}=await this.pullRaw();const parsed=D.parse('betaflight',text,{readDump:true});if(!parsed.board||!parsed.firmware)fail('Board or firmware missing from CLI dump');const current={uid:this.uid,serial:this.serial,stack:'betaflight',board:parsed.board,firmware:parsed.firmware,armed:false,complete:true,evidence:'hardware',entries:parsed.entries,rawDump:text,unparsedLines:parsed.warnings};if(this.identity&&(this.identity.board!==current.board||this.identity.firmware!==current.firmware))fail('Connected board/firmware changed');this.identity={board:current.board,firmware:current.firmware,version};return current;}
  async write(uid,change){if(uid!==this.uid||!this.identity)fail('Connected drone changed');const key=change.key,scope=key.match(/^(profile|rateprofile)\/(\d+)\/(.*)$/);const base=scope?scope[3]:key;if(scope)await this.command(scope[1]+' '+scope[2]);const words=base.split(' ');let cmd=base.startsWith('set ')?base+' = '+change.after:base+' '+change.after;if(/^(feature|beeper) /.test(base))cmd=words[0]+' '+(change.after==='OFF'?'-':'')+words.slice(1).join(' ');const reply=await this.command(cmd);if(/(?:unknown command|invalid|error|out of range)/i.test(reply))fail('CLI rejected '+key);return {uid,key,value:change.after};}
  async commit(uid){if(uid!==this.uid)fail('Connected drone changed');await this.link.write(new TextEncoder().encode('save\r'));await sleep(700);await this.link.reconnectUsb(this.portId,this.usbSerial,this.baud);return {uid,persisted:true,reconnected:true};}
 }
 root.FieldKitLive={AndroidLink,MavWire,MavAdapter,BetaflightAdapter,crc,readParam};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.FieldKitLive;
})(globalThis);
