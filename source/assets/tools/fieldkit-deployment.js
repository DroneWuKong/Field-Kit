'use strict';
// Hardware boundary: current Android package has receive-only native adapters.
// Simulation does not require or open a USB/network device. Never silently route
// a physical-device request to the simulator.
(function(root){
 const LIVE_CONFIG_WRITE_GATE=false;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const stacks=new Set(['betaflight','ardupilot','px4']);
 const fail=m=>{throw Error(m);};
 const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
 const limits={1:[0,255],2:[-128,127],3:[0,65535],4:[-32768,32767],5:[0,4294967295],6:[-2147483648,2147483647]};
 function value(v,type){
  if(typeof v!=='number'&&typeof v!=='string')fail('Expected a number or numeric text');
  if(typeof v==='string'&&!decimal.test(v))fail('Expected a finite number: '+v);
  const n=Number(v);if(!Number.isFinite(n))fail('Expected a finite number');
  if(type==null)return n;
  if(type===9){const f=Math.fround(n);if(!Number.isFinite(f))fail('Value exceeds float32');return f;}
  const range=limits[type];if(!range)fail('Unsupported MAVLink parameter type '+type);
  if(!Number.isInteger(n)||n<range[0]||n>range[1])fail('Value does not fit parameter type '+type);
  return n;
 }
 function paramValueBytes(n,type,encoding){
  if(type==null)fail('Parameter type is unknown');
  n=value(n,type);const b=new Uint8Array(4),d=new DataView(b.buffer);
  if(type===9){d.setFloat32(0,n,true);return b;}
  if(encoding==='c-cast'){
   if(Math.fround(n)!==n)fail('Integer loses precision in C-cast encoding');
   d.setFloat32(0,n,true);
  }else if(encoding==='bytewise'){
   ({1:'setUint8',2:'setInt8',3:'setUint16',4:'setInt16',5:'setUint32',6:'setInt32'}[type]) ? d[({1:'setUint8',2:'setInt8',3:'setUint16',4:'setInt16',5:'setUint32',6:'setInt32'}[type])](0,n,true) : fail('Unsupported integer type');
  }else fail('Parameter encoding is unknown');
  return b;
 }
 function keepPerDrone(stack,key){
  if(stack==='betaflight')return /(?:^|\/)set (?:name|acc_calibration|mag_calibration|gyro_calib_noise_limit|vbat_scale|ibat_scale|ibat_offset)$/.test(key);
  if(stack==='ardupilot')return /^(?:SYSID_THISMAV|CAN_P\d+_NODE_ID|INS_|COMPASS_|RC\d+_(?:MIN|MAX|TRIM)$|BATT\d*_(?:VOLT_MULT|AMP_PERVLT|AMP_OFFSET)$)/.test(key);
  return /^(?:CAL_|TC_|SENS_(?:BOARD|DPRES)_|MAV_SYS_ID$|MAV_COMP_ID$|UAVCAN_NODE_ID$|RC\d+_(?:MIN|MAX|TRIM|DZ)$)/.test(key);
 }
 function parse(stack,text){
  if(!stacks.has(stack))fail('Choose Betaflight, ArduPilot or PX4');
  if(typeof text!=='string'||text.length>250000||text.includes('\0'))fail('Configuration text must be under 250 KB and contain no NULs');
  const entries=Object.create(null),warnings=[];let board='',firmware='',scope='',fileScope=null;
  function add(key,v,type=null){
   if(Object.hasOwn(entries,key))fail('Duplicate setting '+key);
   if(Object.keys(entries).length>=4000)fail('Too many settings');
   entries[key]={value:v,type};
  }
  for(const [i,raw] of text.split(/\r?\n/).entries()){
   const line=raw.trim();if(!line)continue;
   if(line.startsWith('#')){
    const f=line.match(/^#\s*Betaflight\s*\/.*?\s(\d+\.\d+\.\d+(?:[\w.-]*))(?:\s|$)/);if(f)firmware=f[1];
    continue;
   }
   if(stack==='betaflight'){
    const identity=line.match(/^(board_name|manufacturer_id)\s+(\S+)$/);if(identity){if(identity[1]==='board_name')board=identity[2];continue;}
    if(/^(save(?: noreboot)?|batch (?:start|end)|defaults(?: nosave)?|diff(?: all)?|dump(?: all)?)$/.test(line)){
     if(line.startsWith('defaults'))warnings.push('Reset command omitted. This template changes only reviewed settings.');continue;
    }
    const s=line.match(/^(profile|rateprofile)\s+(\d+)$/);if(s){scope=s[1]+'/'+s[2]+'/';continue;}
    const set=line.match(/^set\s+([a-z][a-z0-9_]*)\s*=\s*(.+)$/);
    if(set){add(scope+'set '+set[1],set[2].trim());continue;}
    const v=line.match(/^(resource|serial|vtxtable|aux|feature|map|rxrange|rxfail|mixer|mmix|smix|servo|led|color|mode_color|adjrange|beeper|timer|dma|pinio|osd_layout)\s+(.+)$/);
    if(!v)fail('Unsupported Betaflight command on line '+(i+1)+': '+line);
    const words=v[2].split(/\s+/);let key,setting;
    if(v[1]==='feature'||v[1]==='beeper'){key=v[1]+' '+words[0].replace(/^-/,'');setting=words[0].startsWith('-')?'OFF':'ON';}
    else if(v[1]==='map'||v[1]==='mixer'){key=v[1];setting=v[2];}
    else {const n=v[1]==='resource'?2:v[1]==='vtxtable'&&words[0]==='band'?2:v[1]==='vtxtable'?1:1;key=v[1]+' '+words.slice(0,n).join(' ');setting=words.slice(n).join(' ');if(!setting)fail('Incomplete command on line '+(i+1));}
    add(scope+key,setting);
   }else{
    const parts=line.split(/[\s,]+/);let name,n,type=null;
    if(parts.length===5){
     if(!/^\d+$/.test(parts[0])||!/^\d+$/.test(parts[1])||!/^\d+$/.test(parts[4]))fail('Invalid QGC row on line '+(i+1));
     const next=parts[0]+':'+parts[1];if(fileScope&&fileScope!==next)fail('Mixed system/component files must be split before importing');fileScope=next;
     name=parts[2];n=parts[3];type=Number(parts[4]);
    }else if(parts.length===2){[name,n]=parts;}else fail('Expected NAME VALUE or a five-column QGC row on line '+(i+1));
    if(!/^[A-Z][A-Z0-9_]{0,15}$/.test(name))fail('Invalid parameter name on line '+(i+1));
    add(name,value(n,type),type);
   }
  }
  if(!Object.keys(entries).length)fail('No settings found');
  return {stack,entries,board,firmware,warnings,fileScope};
 }
 function makeTemplate({name,stack,board,firmware,text}){
  const parsed=parse(stack,text);
  name=String(name||'').trim();board=String(board||parsed.board||'').trim();firmware=String(firmware||parsed.firmware||'').trim();
  if(!name||name.length>80||!board||board.length>100||!firmware||firmware.length>50)fail('Give the template a name, board and exact firmware version');
  if(parsed.board&&board!==parsed.board)fail('Board field differs from the dump header');
  if(parsed.firmware&&firmware!==parsed.firmware)fail('Firmware field differs from the dump header');
  return {schema:'prismo.configuration-template.v1',name,stack,board,firmware,entries:parsed.entries,warnings:parsed.warnings,sourceText:text};
 }
 function validateSnapshot(s){
  if(!s||!stacks.has(s.stack)||!s.uid||!s.board||!s.firmware||s.complete!==true||!s.entries)fail('A complete, identified configuration read is required');
  if(s.armed!==false)fail('Disarmed state has not been confirmed');
  if(s.stack!=='betaflight'&&(!Number.isInteger(s.systemId)||!Number.isInteger(s.componentId)||s.systemId<1||s.systemId>255||s.componentId<1||s.componentId>255||!['bytewise','c-cast'].includes(s.encoding)))fail('MAVLink target or encoding is missing');
  return s;
 }
 function plan(template,snapshot){
  validateSnapshot(snapshot);
  if(template.stack!==snapshot.stack||template.board!==snapshot.board||template.firmware!==snapshot.firmware)fail('Template does not match stack, board and exact firmware');
  const changes=[],kept=[],unchanged=[],errors=[];
  for(const [key,entry] of Object.entries(template.entries)){
   if(keepPerDrone(template.stack,key)){kept.push(key);continue;}
   if(!Object.hasOwn(snapshot.entries,key)){errors.push('Setting not present on this drone: '+key);continue;}
   const current=snapshot.entries[key];let desired=entry.value;
   if(template.stack!=='betaflight'){
    try{
     if(entry.type!=null&&entry.type!==current.type)fail('Parameter type differs');
     desired=value(desired,current.type);paramValueBytes(desired,current.type,snapshot.encoding);
     if(current.writable===false)fail('Parameter is read-only');
     if(current.min!=null&&desired<current.min||current.max!=null&&desired>current.max)fail('Value outside known range');
    }catch(e){errors.push(key+': '+e.message);continue;}
   }
   if(desired===current.value)unchanged.push(key);else changes.push({key,before:current.value,after:desired,type:current.type});
  }
  return {uid:snapshot.uid,changes,kept,unchanged,errors};
 }
 function stable(s){return JSON.stringify([s.uid,s.stack,s.board,s.firmware,s.armed,s.complete,s.systemId,s.componentId,s.encoding,Object.entries(s.entries).sort(([a],[b])=>a.localeCompare(b))]);}
 async function digest(text){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function exportText(s){
  if(s.stack==='betaflight'){
   const lines=['# Betaflight / '+s.board+' '+s.firmware,'board_name '+s.board];let scope='';
   for(const [key,p] of Object.entries(s.entries).sort(([a],[b])=>Number(/^(profile|rateprofile)\//.test(a))-Number(/^(profile|rateprofile)\//.test(b)))){
    const m=key.match(/^(profile|rateprofile)\/(\d+)\/(.+)$/),base=m?m[3]:key,next=m?m[1]+' '+m[2]:'';
    if(next!==scope){if(next)lines.push(next);else if(scope)fail('Cannot flatten global settings after a profile; export them before profile entries');scope=next;}
    lines.push(base.startsWith('set ')?base+' = '+p.value:/^(feature|beeper) /.test(base)?base.split(' ')[0]+' '+(p.value==='OFF'?'-':'')+base.split(' ').slice(1).join(' '):base+' '+p.value);
   }
   return lines.join('\n')+'\n';
  }
  const typed=Object.values(s.entries).every(p=>p.type!=null);
  return '# '+s.stack+' '+s.board+' '+s.firmware+'\n'+Object.entries(s.entries).map(([k,p])=>typed?[s.systemId||1,s.componentId||1,k,p.value,p.type].join('\t'):k+' '+p.value).join('\n')+'\n';
 }
 function demo(stack){
  const meta={betaflight:['DEMO_F405','4.5.2'],ardupilot:['DEMO_COPTER','4.5.7'],px4:['DEMO_FMU','1.15.4']}[stack];if(!meta)fail('Unknown practice stack');
  const entries=stack==='betaflight'?{'set vtx_channel':{value:'1'},'set serialrx_provider':{value:'CRSF'},'set name':{value:'Demo A'},'set acc_calibration':{value:'1,2,3,1'}}:stack==='ardupilot'?{WPNAV_SPEED:{value:400,type:9,min:0,max:2000},ATC_RAT_RLL_P:{value:Math.fround(.135),type:9,min:0,max:1},SYSID_THISMAV:{value:1,type:4},COMPASS_OFS_X:{value:10,type:9}}:{MPC_XY_VEL_MAX:{value:5,type:9,min:0,max:20},MC_ROLLRATE_P:{value:Math.fround(.15),type:9,min:0,max:1},MAV_SYS_ID:{value:1,type:6},CAL_MAG0_XOFF:{value:Math.fround(.2),type:9}};
  return [0,1,2].map(i=>{const per=clone(entries);if(stack==='betaflight'){per['set name'].value='Demo '+(i+1);per['set acc_calibration'].value=(i+1)+',2,3,1';}else if(stack==='ardupilot'){per.SYSID_THISMAV.value=i+1;per.COMPASS_OFS_X.value=10+i;}else{per.MAV_SYS_ID.value=i+1;per.CAL_MAG0_XOFF.value=Math.fround(.2+i*.01);}return {uid:'PRACTICE-'+stack+'-'+(i+1),serial:'DEMO-'+(i+1),stack,board:meta[0],firmware:meta[1],armed:false,complete:true,evidence:'simulation',systemId:i+1,componentId:1,encoding:stack==='px4'?'bytewise':'c-cast',entries:per};});
 }
 const example={betaflight:'# Betaflight / STM32F405 (S405) 4.5.2\nboard_name DEMO_F405\nset vtx_channel = 2\nset serialrx_provider = CRSF\nset name = Do not clone this name\n',ardupilot:'WPNAV_SPEED 450\nATC_RAT_RLL_P 0.14\nSYSID_THISMAV 99\nCOMPASS_OFS_X 999\n',px4:'1\t1\tMPC_XY_VEL_MAX\t6\t9\n1\t1\tMC_ROLLRATE_P\t0.16\t9\n1\t1\tMAV_SYS_ID\t99\t6\n1\t1\tCAL_MAG0_XOFF\t999\t9\n'};
 class PracticeAdapter{
  constructor(stack,fault='none'){this.mode='simulation';this.drones=demo(stack);this.fault=fault;this.writes=[];this.commits=[];this.reads=0;}
  async read(uid){this.reads++;const s=this.drones.find(s=>s.uid===uid);if(!s)fail('Practice drone missing');return clone(s);}
  async write(uid,change){
   const s=this.drones.find(s=>s.uid===uid);if(!s)fail('Practice drone missing');
   this.writes.push({uid,...change});
   if(this.fault==='disconnect')fail('Practice connection lost; some writes may already have happened');
   if(this.fault==='reject')return {uid,key:change.key,value:s.entries[change.key].value};
   s.entries[change.key].value=change.after;return {uid,key:change.key,value:change.after};
  }
  async commit(uid){this.commits.push(uid);if(this.fault==='readback'){const s=this.drones.find(s=>s.uid===uid);s.entries[this.writes.find(w=>w.uid===uid).key].value='STALE';}return {uid,persisted:true,reconnected:true};}
 }
 class NativeAdapter{
  constructor(){fail('LIVE_CONFIG_WRITE_GATE: native configuration transport is not implemented in this Android build. Use Practice.');}
 }
 async function run({template,adapter,targets,ledger,signal,expected,job={},onProgress=()=>{}}){
  if(adapter.mode!=='simulation')fail('LIVE_CONFIG_WRITE_GATE: physical writes are unavailable');
  if(!Array.isArray(targets)||!targets.length||new Set(targets).size!==targets.length||targets.length>50)fail('Choose 1-50 distinct drones');
  if(String(job.batch||'').length>80||String(job.operator||'').length>80)fail('Batch and operator names must be under 80 characters');
  const report={job:{batch:String(job.batch||''),operator:String(job.operator||'')},schema:'prismo.configuration-run.v1',evidence:'simulation',createdAt:new Date().toISOString(),template:clone(template),units:[],state:'running'};
  for(const uid of targets){
   const unit={uid,state:'reading',attempted:[],verified:[],kept:[],backup:null,errors:[]};report.units.push(unit);
   const cancel=()=>{if(signal?.aborted)fail('Run stopped. Read this drone again before another attempt.');};
   try{
    cancel();const before=await adapter.read(uid);if(before.uid!==uid)fail('Drone identity changed');if(expected&&expected[uid]!==stable(before))fail('Drone changed since comparison; compare again');
    const p=plan(template,before);unit.kept=p.kept;unit.preview=p;if(p.errors.length)fail(p.errors.join('; '));
    unit.backup=clone(before);unit.backupHash=await digest(stable(before));unit.state='backed-up';
    // Mandatory durable backup before the first write. Storage failure aborts.
    await ledger.save(clone(report));onProgress(clone(report));cancel();
    const fresh=await adapter.read(uid);if(stable(fresh)!==stable(before))fail('Drone changed since preview; review a fresh read');
    for(const change of p.changes){
     cancel();unit.state='writing';unit.attempted.push(change.key);await ledger.save(clone(report));
     const ack=await adapter.write(uid,change);
     if(ack.uid!==uid||ack.key!==change.key||ack.value!==change.after)fail('Write response does not match '+change.key);
    }
    if(p.changes.length){cancel();const saved=await adapter.commit(uid);if(saved.uid!==uid||saved.persisted!==true||saved.reconnected!==true)fail('Save/reconnect not confirmed');}
    cancel();const after=await adapter.read(uid);validateSnapshot(after);
    if(after.uid!==uid||after.stack!==before.stack||after.board!==before.board||after.firmware!==before.firmware||after.systemId!==before.systemId||after.componentId!==before.componentId||after.encoding!==before.encoding)fail('Identity changed during readback');
    for(const c of p.changes){if(after.entries[c.key]?.value!==c.after)fail('Readback differs for '+c.key);unit.verified.push(c.key);}
    const changed=new Set(p.changes.map(c=>c.key));for(const [key,entry] of Object.entries(before.entries)){if(!changed.has(key)&&JSON.stringify(after.entries[key])!==JSON.stringify(entry))fail('Untouched setting changed: '+key);}
    unit.state=p.changes.length?'verified':'no-changes';unit.after=after;unit.afterHash=await digest(stable(after));
    await ledger.save(clone(report));onProgress(clone(report));
   }catch(e){unit.state=unit.attempted.length?'incomplete':'blocked';unit.errors.push(e.message);report.state='stopped';try{await ledger.save(clone(report));}catch(storage){unit.errors.push('Report could not be saved: '+storage.message);}onProgress(clone(report));break;}
  }
  if(report.state==='running')report.state='finished';await ledger.save(clone(report));return report;
 }
 const api={LIVE_CONFIG_WRITE_GATE,fingerprint:stable,parse,makeTemplate,plan,value,paramValueBytes,keepPerDrone,exportText,demo,example,PracticeAdapter,NativeAdapter,run,clone};
 root.FieldKitDeployment=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
