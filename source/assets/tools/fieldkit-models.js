'use strict';
// Portable, effect-free models. UI/native adapters supply clocks and observations.
window.FieldKitModels = (() => {
  const PROFILE_SCHEMA='prismo.fieldkit.equipment.v1';
  const strings=['id','name','serial','radio','antenna','vtx','firmware','protocol'];
  const numbers={frequency:[100,6000],power:[1,5000],txGain:[-5,20],rxGain:[-5,20],sensitivity:[-130,-50],margin:[0,30],batteryMah:[1,1000000],batteryVoltage:[.1,1000],averageCurrent:[.01,10000],reserve:[0,99]};
  function profile(value) {
    if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Profile must be a JSON object.');
    const keys=new Set(['schema','revision',...strings,...Object.keys(numbers)]);
    for(const key of Object.keys(value))if(!keys.has(key))throw Error('Unknown profile field: '+key);
    if(value.schema!==PROFILE_SCHEMA)throw Error('Unsupported profile schema.');
    if(!Number.isInteger(value.revision)||value.revision<1||value.revision>1000000)throw Error('Invalid profile revision.');
    const out={schema:PROFILE_SCHEMA,revision:value.revision};
    for(const key of strings) {
      if(typeof value[key]!=='string'||value[key].length>200||/[\u0000-\u001f]/.test(value[key]))throw Error('Invalid '+key+'.');
      out[key]=value[key].trim();
    }
    if(!out.id||!out.name)throw Error('Profile needs an ID and name.');
    if(!['AUTO_DETECT','MAVLINK','MSP','GHST'].includes(out.protocol))throw Error('Choose a supported receive protocol.');
    for(const [key,[min,max]] of Object.entries(numbers)) {
      const v=value[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid '+key+'.');out[key]=v;
    }
    return out;
  }
  function parseConfig(text) {
    if(typeof text!=='string'||text.length>250000)throw Error('CLI text must be 250 KB or less.');
    if(!text.trim())throw Error('Paste a Betaflight dump or diff first.');
    const entries=new Map(),warnings=[],unknown=[];
    let firmware='',target='',board='',mode='partial / unspecified', recognized=0, scoped=false;
    const put=(key,value)=>{
      const previous=entries.get(key);
      if(previous!==undefined&&previous!==value)warnings.push('Conflicting duplicate '+key+'; last value displayed.');
      entries.set(key,value);recognized++;
    };
    for(const raw of text.replace(/\r/g,'').split('\n')) {
      const line=raw.trim();if(!line)continue;
      if(/^#\s*Betaflight\s*\//i.test(line)){firmware=line.replace(/^#\s*/, '');continue;}
      if(/^#\s*diff(?:\s+all)?\b/i.test(line)){mode='diff (partial)';continue;}
      if(/^#\s*dump(?:\s+all)?\b/i.test(line)){mode='dump (declared full)';continue;}
      if(line.startsWith('#'))continue;
      let m;
      if((m=line.match(/^(board_name|manufacturer_id)\s+([A-Za-z0-9_-]+)$/))){put(m[1],m[2]);if(m[1]==='board_name')board=m[2];continue;}
      if((m=line.match(/^set\s+([A-Za-z0-9_]+)\s*=\s*(.{1,1000})$/))){if(!scoped)put('set '+m[1],m[2]);continue;}
      if((m=line.match(/^resource\s+([A-Z0-9_]+)\s+(\d+)\s+(NONE|[A-I]\d{2})$/))){put('resource '+m[1]+' '+m[2],m[3]);continue;}
      if((m=line.match(/^serial\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/))){put('serial '+m[1],m.slice(2).join(' '));continue;}
      if((m=line.match(/^vtxtable\s+(band\s+\d+|bands|channels|powerlevels|powervalues|powerlabels)\s+(.{1,1000})$/))){put('vtxtable '+m[1],m[2].replace(/\s+/g,' '));continue;}
      if((m=line.match(/^(feature|beeper)\s+(-?)([A-Z0-9_]+)$/))){put(m[1]+' '+m[3],m[2]?'disabled':'enabled');continue;}
      if((m=line.match(/^(profile|rateprofile)\s+(\d+)$/))){scoped=true;warnings.push('Profile-scoped CLI detected; profile values are not compared by this inspector.');continue;}
      if(['save','defaults','batch start','batch end','diff all','dump all','version'].includes(line)){continue;}
      unknown.push(line);
    }
    target=firmware.match(/Betaflight\s*\/\s*([^/]+)\//i)?.[1]?.trim()||'';
    if(!recognized)throw Error('No supported Betaflight configuration fields found.');
    // Global fields before profile blocks are retained; scoped blocks never overwrite them.
    warnings.push('Only fields present in the text are known. Missing fields do not prove device defaults or removals.');
    if(!firmware)warnings.push('Firmware version is missing; compatibility is unknown.');
    if(unknown.length)warnings.push(unknown.length+' unsupported lines left uninterpreted.');
    const resources=[...entries].filter(([k,v])=>k.startsWith('resource ')&&v!=='NONE');
    const pins=new Map();for(const [key,pin] of resources){if(pins.has(pin))warnings.push(pin+' is assigned to '+pins.get(pin)+' and '+key+'. Review against board documentation.');else pins.set(pin,key);}
    return {firmware,target,board,mode,entries:Object.fromEntries(entries),warnings:[...new Set(warnings)],unknownCount:unknown.length};
  }
  function explainSerial(value){
    const [mask,...baud]=value.split(' ').map(Number);
    const meanings=[[1,'MSP'],[2,'GPS'],[4,'FrSky Hub'],[8,'HoTT'],[16,'LTM'],[32,'SmartPort'],[64,'Serial receiver'],[128,'Blackbox'],[512,'MAVLink telemetry'],[1024,'ESC sensor'],[2048,'SmartAudio'],[4096,'iBus telemetry'],[8192,'Tramp'],[16384,'RC device'],[65536,'FrSky OSD'],[131072,'MSP VTX']];
    const known=meanings.reduce((v,[bit])=>v|bit,0), unknown=mask&~known;
    return (meanings.filter(([bit])=>(mask&bit)!==0).map(([,name])=>name).join(' + ')||'No recognized function')+(unknown?' · other/version-specific bits '+unknown:'')+' · MSP/GPS/telemetry/peripheral baud '+baud.join(' / ');
  }
  function compareConfig(a,b) {
    const changes=[];
    for(const key of [...new Set([...Object.keys(a.entries),...Object.keys(b.entries)])].sort()) {
      if(a.entries[key]!==b.entries[key])changes.push({key,before:a.entries[key]??'Not in baseline text',after:b.entries[key]??'Not in current text',category:key.startsWith('resource ')?'Pin assignment':key.startsWith('serial ')?'UART functions / baud':key.startsWith('vtxtable ')||key.startsWith('set vtx_')?'Video table / channel':key.includes('serialrx')||key.includes('rx_')?'Receiver':'Setting'});
    }
    const warnings=[];
    if(a.firmware!==b.firmware||a.board!==b.board)warnings.push('Firmware or board identity differs. Do not use this comparison as an apply script.');
    if(a.warnings.some(w=>w.startsWith('Conflicting'))||b.warnings.some(w=>w.startsWith('Conflicting')))warnings.push('Conflicting duplicate values make this comparison ambiguous.');
    return {changes,warnings};
  }
  const distance=(a,b)=>{
    const rad=x=>x*Math.PI/180;const p=rad(b.lat-a.lat),q=rad(b.lon-a.lon);
    const h=Math.sin(p/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(q/2)**2;
    return 6371008.8*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
  };
  function positionHealth(p,now=Date.now(),maxAge=5) {
    if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)return {state:'unavailable',reason:'No valid coordinate observation.'};
    const age=typeof p.observedAt==='number'?(now-p.observedAt)/1000+(p.ageSeconds||0):p.ageSeconds;
    if(!Number.isFinite(age)||age<0)return {state:'unknown',reason:'Observation time is missing or in the future.'};
    if(age>maxAge)return {state:'stale',age,reason:'Position exceeds the selected freshness threshold.'};
    if(p.validFix===false||p.fixType!==undefined&&p.fixType<3)return {state:'no-fix',age,reason:'Coordinates received without a valid 3D fix.'};
    if(p.mock||p.evidence==='simulation')return {state:'simulated',age,reason:'Mock or simulated observation; keep separate from live measurements.'};
    return {state:'fresh',age,reason:Number.isFinite(p.accuracy)?'Reported horizontal accuracy ±'+p.accuracy.toFixed(1)+' m.':'Horizontal accuracy unavailable. HDOP is not meters.'};
  }
  function diagnose(s,now=Date.now()) {
    const simulation=s.evidence==='simulation';
    const frameKnown=(s.frames||0)>0||s.protocol&&s.protocol!=='AUTO_DETECT'&&(s.position||s.rcFrames>0);
    const health=positionHealth(s.position?{...s.position,observedAt:s.observedAt,evidence:simulation?'simulation':'device-observation'}:null,now,5);
    const byteAge=typeof s.byteAgeSeconds==='number'?s.byteAgeSeconds+Math.max(0,(now-(s.observedAt||now))/1000):null;
    const steps=[
      {name:'Transport',state:s.state==='listening'?'observed':s.state==='idle'?'waiting':'blocked',detail:s.state==='listening'?s.device||'Receive path open':s.error||'Open a chosen USB port or listen on a UDP port.'},
      {name:'Protocol',state:frameKnown?'observed':s.bytes>0?'investigate':'waiting',detail:frameKnown?`${s.protocol==='AUTO_DETECT'?'Valid parser frames':s.protocol} · ${s.bytes||0} bytes · ${s.frames||0} counted MAV/GHST/CRSF frames`:s.bytes>0?'Bytes received but no supported valid frames. Check protocol, baud and CRC.':'No bytes received. Check cable, USB mode, permission, DTR setting or UDP destination.'},
      {name:'Telemetry',state:health.state,detail:s.rcFrames>0&&!s.position?'Controller channels only; GPS telemetry is missing.':s.position?`${health.reason} Age ${health.age?.toFixed(1)??'unknown'} s.`:frameKnown?'Protocol frames received without GPS. Confirm GPS telemetry is enabled.':'Waiting for a position with fix status.'},
      {name:'Video',state:'unverified',detail:s.video||'Probe an endpoint or record a manual video observation. TCP reachability does not prove video frames or latency.'}
    ];
    if(byteAge!==null&&byteAge>5)steps[1]={name:'Protocol',state:'stale',detail:'No receive bytes for '+byteAge.toFixed(1)+' s. Check loss/reconnection.'};
    if(s.crcErrors>0)steps[1].detail+=' CRC rejects: '+s.crcErrors+'.';
    return {steps,health,simulation};
  }
  function simulate(name,now=Date.now()) {
    const s={schema:'prismo.fieldkit.diagnostic.v1',state:'listening',mode:'simulation',evidence:'simulation',device:'Software fixture · '+name,protocol:'MAVLINK',bytes:180,frames:3,crcErrors:0,rcFrames:0,byteAgeSeconds:0,observedAt:now,video:'Simulated stream available; no device video or latency measurement.',position:{lat:41.88,lon:-87.63,fixType:3,validFix:true,satellites:12,hdop:.9,accuracy:null,ageSeconds:0}};
    if(name==='silent'){s.bytes=0;s.frames=0;s.protocol='AUTO_DETECT';delete s.position;}
    else if(name==='permission'){s.state='blocked';s.error='Simulated USB permission denied';s.bytes=0;s.frames=0;delete s.position;}
    else if(name==='rc-only'){s.protocol='GHST';s.rcFrames=8;delete s.position;}
    else if(name==='crc'){s.crcErrors=8;s.frames=0;s.protocol='AUTO_DETECT';delete s.position;}
    else if(name==='stale'){s.position.ageSeconds=30;s.byteAgeSeconds=30;}
    else if(name==='no-fix'){s.position.fixType=0;s.position.validFix=false;}
    else if(name==='video'){s.video='Simulated TCP endpoint unavailable; inspect stream service and port.';}
    else if(name!=='healthy')throw Error('Unknown simulation scenario.');
    return s;
  }
  function nextCheck(s,now=Date.now()) {
    const d=diagnose(s,now), practice=d.simulation;
    const result=(title,detail,action,target,tone='attention')=>({title,detail,action:practice&&['connection','protocol'].includes(target)?'Try another fault':action,target:practice&&['connection','protocol'].includes(target)?'scenario':target,tone,practice});
    if(s.state==='opening'||s.state==='permission-or-opening')return result('Waiting for the connection','Complete the Android USB permission prompt if one appears.','Review connection settings','connection','waiting');
    if(s.state!=='listening')return result(/permission/i.test(s.error||'')?'USB access was denied':'Connection is closed',s.error||'Choose the cable or network you want to check.','Review connection settings','connection');
    if(!s.bytes)return result('No data is arriving',s.mode==='udp'?'Check that the sender uses this phone’s IP address and the listening port.':'Check the data cable, USB mode and selected serial port.','Review connection settings','connection');
    if(s.crcErrors>0)return result('Some frames were rejected','Check the protocol, baud rate and cable. Open the details to see the CRC reject count.','Review protocol & baud','protocol');
    if(d.steps[1].state==='investigate')return result('Data arrived, but the protocol is unclear','Try the matching protocol and baud rate for this device.','Review protocol & baud','protocol');
    if(d.steps[1].state==='stale'||d.health.state==='stale')return result('Position updates have stopped','The last position is too old. Check telemetry loss or reconnect the receive path.','Check position age','position');
    if(s.rcFrames>0&&!s.position)return result('Stick channels arrived; GPS is missing','Confirm that GPS telemetry is enabled on this radio and aircraft.','Check position details','position');
    if(!s.position||d.health.state==='no-fix'||d.health.state==='unknown')return result('A usable GPS fix is still missing',s.position?'Review fix status and timestamp before using this position.':'Protocol frames are arriving without a position. Confirm that GPS telemetry is enabled.','Check position details','position');
    if(practice)return result('Practice telemetry is arriving','This is a software example. Choose a fault to learn what to check.','Try another fault','scenario','practice');
    return result('Telemetry is arriving','A recent position was received. Check video separately if you need it.','Check the video endpoint','video','observed');
  }
  return {PROFILE_SCHEMA,profile,parseConfig,compareConfig,explainSerial,distance,positionHealth,diagnose,simulate,nextCheck,strings,numbers};
})();
