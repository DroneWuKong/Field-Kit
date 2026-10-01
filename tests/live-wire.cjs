const test=require('node:test');
const assert=require('node:assert/strict');
require('../source/assets/tools/fieldkit-deployment.js');
const L=require('../source/assets/tools/fieldkit-live.js');

const extra={0:50,20:214,21:159,22:220,23:168,76:152,148:178};
function frame(id,payload,sys=1,comp=1){const head=[payload.length,0,0,0,sys,comp,id&255,(id>>8)&255,(id>>16)&255];const crc=L.crc([...head,...payload],extra[id]);return Uint8Array.from([253,...head,...payload,crc&255,crc>>8]);}
function heartbeat(){const b=new Uint8Array(9);b[5]=12;return frame(0,b);}
function version(capability=16n,uid=1234n){const b=new Uint8Array(60),v=new DataView(b.buffer);v.setBigUint64(0,capability,true);v.setUint32(8,0x010f0400,true);v.setUint32(20,42,true);v.setBigUint64(52,uid,true);return frame(148,b);}
function param(name,value,index,count=2){const b=new Uint8Array(25),v=new DataView(b.buffer);v.setFloat32(0,value,true);v.setUint16(4,count,true);v.setUint16(6,index,true);for(let i=0;i<name.length;i++)b[8+i]=name.charCodeAt(i);b[24]=9;return frame(22,b);}
class Peer{
 constructor(versionFrame=version()){this.queue=[heartbeat()];this.writes=[];this.requests=0;this.versionFrame=versionFrame;}
 async read(){return this.queue.shift()||heartbeat();}
 async write(data){this.writes.push(data);const id=data[7]|data[8]<<8|data[9];if(id===76)this.queue.push(this.versionFrame,heartbeat());if(id===21)this.queue.push(param('MPC_XY_VEL_MAX',5,0),param('MC_ROLLRATE_P',.15,1),heartbeat());if(id===23){this.queue.push(heartbeat(),param('MPC_XY_VEL_MAX',6,0));}if(id===20){this.requests++;this.queue.push(param('MC_ROLLRATE_P',.15,1),heartbeat());}}
}
test('MAVLink connected read, typed set, and fresh readback with a software peer',async()=>{
 const peer=new Peer(),a=new L.MavAdapter(peer,'px4');
 const before=await a.read();
 assert.equal(before.uid,'MAV-4d2');assert.equal(before.board,'MAV-0-0-42');
 assert.equal(before.firmware,'1.15.4');assert.equal(before.complete,true);
 assert.equal(before.entries.MPC_XY_VEL_MAX.value,5);
 const ack=await a.write(before.uid,{key:'MPC_XY_VEL_MAX',after:6,type:9});
 assert.equal(ack.value,6);assert.ok(peer.writes.some(x=>x[7]===23));
});
test('corrupt MAVLink checksum does not enter the parameter catalog',async()=>{
 const bad=param('TEST',1,0,1);bad[bad.length-1]^=1;
 const peer={read:async()=>bad,write:async()=>{}};
 const wire=new L.MavWire(peer);await wire.pump();assert.equal(wire.messages.length,0);
});
test('missing MAVLink UID and encoding use explicit operator entries with provenance',async()=>{
 const peer=new Peer(version(0n,0n));
 const adapter=new L.MavAdapter(peer,'px4',{fallbackSerial:'BATCH-004',encoding:'bytewise'});
 const snapshot=await adapter.read();
 assert.equal(snapshot.uid,'LABEL-BATCH-004');assert.equal(snapshot.identitySource,'operator-label');
 assert.equal(snapshot.encodingSource,'operator-selection');
});
test('hardware mode requires a real adapter and never uses PracticeAdapter',async()=>{
 const D=globalThis.FieldKitDeployment;
 await assert.rejects(D.run({template:{},adapter:{mode:'hardware',verified:false},targets:['unit'],ledger:{save:async()=>{}}}),/verified physical/);
 assert.throws(()=>new D.NativeAdapter(),/not implemented/);
});
test('hardware response without persistence proof is labeled active readback',async()=>{
 const D=globalThis.FieldKitDeployment;
 const before=D.demo('px4')[0];before.uid='MAV-4d2';before.evidence='hardware';
 const adapter={mode:'hardware',verified:true,read:async()=>structuredClone(before),write:async(uid,change)=>{before.entries[change.key].value=change.after;return {uid,key:change.key,value:change.after};},commit:async uid=>({uid,persisted:false,reconnected:true})};
 const t=D.makeTemplate({name:'Test',stack:'px4',board:before.board,firmware:before.firmware,text:'MPC_XY_VEL_MAX 6'});
 const snapshots=[];const report=await D.run({template:t,adapter,targets:[before.uid],ledger:{save:async r=>snapshots.push(structuredClone(r))}});
 assert.equal(report.state,'finished');assert.equal(report.evidence,'hardware');assert.equal(report.units[0].state,'verified-active');assert.equal(report.units[0].persistence,'unconfirmed');
 assert.equal(snapshots.findIndex(r=>r.units[0]?.backup),0);
});
test('Betaflight CLI pulls a dump, applies a reviewed setting, and reconnects after save',async()=>{
 let channel=1,reconnects=0;const writes=[];
 const peer={queue:[],async write(b){const cmd=new TextDecoder().decode(b).trim();writes.push(cmd);
  if(cmd==='save'){channel=2;return;}
  const body=cmd==='#'?'CLI entered':cmd==='status'?'Arming disable flags: CLI':cmd==='version'?'# Betaflight / STM32F405 (S405) 4.5.2':cmd==='dump all'?'# Betaflight / STM32F405 (S405) 4.5.2\nboard_name DEMO_F405\nset vtx_channel = '+channel:'set vtx_channel = 2';
  this.queue.push(new TextEncoder().encode(body+'\r\n# '));},async read(){return this.queue.shift()||new Uint8Array();},async reconnectUsb(){reconnects++;}};
 const adapter=new L.BetaflightAdapter(peer,'DEMO-1','usb:demo',115200,'DEMO-USB');
 const before=await adapter.read();assert.equal(before.entries['set vtx_channel'].value,'1');
 const ack=await adapter.write(before.uid,{key:'set vtx_channel',after:'2'});assert.equal(ack.value,'2');
 const committed=await adapter.commit(before.uid);assert.equal(committed.reconnected,true);assert.equal(reconnects,1);
 const after=await adapter.read(before.uid);assert.equal(after.entries['set vtx_channel'].value,'2');
 assert.ok(writes.includes('dump all'));assert.ok(writes.includes('save'));
});
