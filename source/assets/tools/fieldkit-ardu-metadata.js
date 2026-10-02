'use strict';
// ArduPilot publishes machine-readable parameter metadata. This module turns
// that data into small, predictable UI records and keeps an offline core set.
(function(root){
 const cleanText=value=>String(value??'').replace(/\s+/g,' ').trim();
 const truth=value=>value===true||/^(?:true|yes|1)$/i.test(String(value??''));
 function pairs(value){
  if(!value)return null;
  if(Array.isArray(value))return Object.fromEntries(value.map((v,i)=>[String(v.value??v.Value??i),cleanText(v.name??v.Name??v.label??v)]));
  if(typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[String(k),cleanText(v)]));
  const result={};
  for(const part of String(value).split(',')){const match=part.trim().match(/^(-?\d+)\s*:\s*(.+)$/);if(match)result[match[1]]=cleanText(match[2]);}
  return Object.keys(result).length?result:null;
 }
 function range(value){
  if(!value)return null;
  const values=Array.isArray(value)?value:[value.low??value.Low,value.high??value.High];
  if(values[0]==null||values[1]==null){const found=String(value).trim().split(/[\s,]+/);values.splice(0,values.length,...found);}
  const low=Number(values[0]),high=Number(values[1]);return Number.isFinite(low)&&Number.isFinite(high)?[low,high]:null;
 }
 function normalize(value,source='official'){
  if(!value||typeof value!=='object')return null;
  const r=range(value.Range??value.range);
  const increment=Number(value.Increment??value.increment);
  return {
   displayName:cleanText(value.DisplayName??value.displayName??value.name),
   description:cleanText(value.Description??value.description),
   units:cleanText(value.Units??value.units),
   range:r,
   increment:Number.isFinite(increment)&&increment>0?increment:null,
   user:cleanText(value.User??value.user)||'Advanced',
   rebootRequired:truth(value.RebootRequired??value.rebootRequired),
   values:pairs(value.Values??value.values),
   bitmask:pairs(value.Bitmask??value.bitmask),source
  };
 }
 function flatten(raw,source='official'){
  const data=typeof raw==='string'?JSON.parse(raw):raw;if(!data||typeof data!=='object')throw Error('Parameter metadata is not valid JSON');
  const result=Object.create(null),input=data.parameters&&typeof data.parameters==='object'?data.parameters:data;
  const add=(key,value)=>{if(/^[A-Z][A-Z0-9_]{0,15}$/.test(key)){const normalized=normalize(value,source);if(normalized)result[key]=normalized;}};
  for(const [group,value] of Object.entries(input)){
   if(group==='json'||group==='schema'||group==='vehicle'||group==='fetchedAt'||group==='firmwareMetadata')continue;
   if(/^[A-Z][A-Z0-9_]{0,15}$/.test(group)&&(value.DisplayName||value.Description||value.Range||value.Values||value.Bitmask||value.displayName||value.description||value.range||value.values||value.bitmask)){add(group,value);continue;}
   if(value&&typeof value==='object')for(const [key,param] of Object.entries(value))add(key,param);
  }
  return result;
 }
 const CORE=flatten({parameters:{
  WPNAV_SPEED:{DisplayName:'Waypoint speed',Description:'Maximum horizontal speed used for waypoint navigation. Higher values command faster travel between mission points.',Units:'cm/s',Range:{low:20,high:2000},Increment:50,User:'Standard'},
  ATC_RAT_RLL_P:{DisplayName:'Roll response strength',Description:'Proportional gain for the roll-rate controller. Larger values make roll correction stronger; excessive values can cause oscillation.',Range:{low:0.01,high:0.5},Increment:0.005,User:'Standard'},
  RTL_ALT:{DisplayName:'Return-to-launch altitude',Description:'Target altitude used for return-to-launch. Confirm the value clears local obstacles and follows your operating procedure.',Units:'cm',Range:{low:200,high:300000},Increment:100,User:'Standard'},
  SYSID_THISMAV:{DisplayName:'Aircraft MAVLink ID',Description:'The aircraft identity used on MAVLink. Aircraft sharing a link should have unique IDs.',Range:{low:1,high:255},Increment:1,User:'Advanced',RebootRequired:true},
  COMPASS_OFS_X:{DisplayName:'Compass calibration offset X',Description:'A per-aircraft result produced by compass calibration. It is normally preserved instead of copied between aircraft.',Units:'mGauss',User:'Advanced'},
  ARMING_CHECK:{DisplayName:'Pre-arm checks',Description:'Selects which safety checks must pass before arming. Disabling checks can hide a real setup problem.',User:'Standard',Bitmask:{0:'All checks',1:'Barometer',2:'Compass',3:'GPS lock',4:'Inertial sensors',5:'Parameters',6:'RC channels',7:'Board voltage',8:'Battery level',9:'Airspeed',10:'Logging',11:'Safety switch',12:'GPS configuration',13:'System',14:'Mission',15:'Rangefinder',17:'Auxiliary authorization',18:'Vision',19:'FFT',20:'OSD',21:'DroneCAN'}},
  FRAME_CLASS:{DisplayName:'Airframe class',Description:'The physical motor and frame arrangement. This must match the aircraft.',User:'Standard',RebootRequired:true,Values:{0:'Undefined',1:'Quad',2:'Hexa',3:'Octa',4:'OctaQuad',5:'Y6',6:'Helicopter',7:'Tri',8:'Single copter',9:'Coax copter',10:'Bi-copter',11:'Dual helicopter',12:'DodecaHexa',13:'HeliQuad',14:'Deca'}},
  FRAME_TYPE:{DisplayName:'Airframe layout',Description:'The motor layout within the selected frame class. Confirm motor order and direction after any change.',User:'Standard',RebootRequired:true,Values:{0:'Plus',1:'X',2:'V',3:'H',4:'V-tail',5:'A-tail',10:'Y6B',11:'Y6F',12:'Betaflight X',13:'DJI X',14:'Clockwise X',15:'I'}},
  BATT_MONITOR:{DisplayName:'Battery monitor type',Description:'Selects how voltage and current are measured. The correct option depends on the installed power hardware.',User:'Standard',RebootRequired:true},
  GPS_TYPE:{DisplayName:'Primary GPS type',Description:'Selects the driver for the primary GPS receiver. Automatic detection is easiest when supported.',User:'Standard',RebootRequired:true},
  LOG_BITMASK:{DisplayName:'Dataflash logging',Description:'Selects which onboard log groups are recorded. More logging uses more storage and can help diagnosis.',User:'Advanced'}
 }},'built-in');
 function merge(...catalogs){const result=Object.create(null);for(const catalog of catalogs)for(const [key,value] of Object.entries(catalog||{}))result[key]={...(result[key]||{}),...value};return result;}
 function vehicleFromMavType(type){type=Number(type);if([2,19,20,21,22].includes(type))return'ArduPlane';if([10,11].includes(type))return'Rover';if(type===12)return'ArduSub';return'ArduCopter';}
 function valueLabel(meta,value){const key=String(Number.isFinite(Number(value))?Number(value):value);return meta?.values?.[key]??String(value);}
 function withUnits(value,units){if(!units)return String(value);const number=Number(value);let friendly='';if(Number.isFinite(number)&&units==='cm')friendly=' ('+(number/100).toLocaleString(undefined,{maximumFractionDigits:2})+' m)';if(Number.isFinite(number)&&units==='cm/s')friendly=' ('+(number/100).toLocaleString(undefined,{maximumFractionDigits:2})+' m/s)';return value+' '+units+friendly;}
 function changeSummary(key,before,after,meta){const name=meta?.displayName||key,a=valueLabel(meta,before),b=valueLabel(meta,after);return name+': '+withUnits(a,meta?.units)+' → '+withUnits(b,meta?.units);}
 function controlKind(meta){if(meta?.values)return'choice';if(meta?.bitmask)return'bitmask';return'number';}
 function templateEntries(text){
  const result=Object.create(null);
  for(const raw of String(text||'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const tab=line.split('\t');if(tab.length>=5&&/^[A-Z][A-Z0-9_]{0,15}$/.test(tab[2])){result[tab[2]]={value:tab[3],line:raw};continue;}const match=line.match(/^([A-Z][A-Z0-9_]{0,15})\s*(?:,|\s)\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*$/i);if(match)result[match[1].toUpperCase()]={value:match[2],line:raw};
  }return result;
 }
 function updateText(text,key,value,remove=false){
  key=String(key).toUpperCase();if(!/^[A-Z][A-Z0-9_]{0,15}$/.test(key))throw Error('Invalid ArduPilot parameter name');if(!remove&&!Number.isFinite(Number(value)))throw Error(key+' needs a numeric value');
  const lines=String(text||'').split(/\r?\n/),next=[];let found=false;
  for(const raw of lines){const line=raw.trim(),tab=line.split('\t');let name='';if(tab.length>=5)name=tab[2];else name=(line.match(/^([A-Z][A-Z0-9_]{0,15})\s*(?:,|\s)/i)||[])[1]||'';if(name.toUpperCase()!==key){next.push(raw);continue;}if(found)continue;found=true;if(remove)continue;if(tab.length>=5){tab[3]=String(Number(value));next.push(tab.join('\t'));}else next.push(key+' '+String(Number(value)));}
  if(!remove&&!found)next.push(key+' '+String(Number(value)));while(next.length&&next.at(-1)==='')next.pop();return next.join('\n')+(next.length?'\n':'');
 }
 const pending=new Map(),official=Object.create(null);
 function receive(id,json,error){const request=pending.get(id);if(!request)return;pending.delete(id);if(error){request.reject(Error(String(error)));return;}try{const parsed=JSON.parse(json),flat=flatten(parsed,'official');official[request.vehicle]=merge(official[request.vehicle],flat);try{localStorage.setItem('fieldkit-ardu-metadata-'+request.vehicle,JSON.stringify({fetchedAt:parsed.fetchedAt||new Date().toISOString(),parameters:official[request.vehicle]}));}catch(_){}request.resolve({parameters:official[request.vehicle],fetchedAt:parsed.fetchedAt||null});}catch(e){request.reject(e);}}
 function cached(vehicle){if(official[vehicle])return official[vehicle];try{const data=JSON.parse(localStorage.getItem('fieldkit-ardu-metadata-'+vehicle)||'null');if(data?.parameters)official[vehicle]=flatten(data,'official');}catch(_){}return official[vehicle]||Object.create(null);}
 function load(vehicle,keys,bridge=root.Android){
  if(!['ArduCopter','ArduPlane','Rover','ArduSub'].includes(vehicle))return Promise.reject(Error('Unsupported ArduPilot vehicle type'));
  if(!bridge?.fetchArduMetadata)return Promise.reject(Error('Official descriptions require the Android app and internet access'));
  const id=root.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random(),wanted=[...new Set(keys)].filter(k=>/^[A-Z][A-Z0-9_]{0,15}$/.test(k)).slice(0,10000);
  return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject,vehicle});try{bridge.fetchArduMetadata(id,vehicle,JSON.stringify(wanted));}catch(e){pending.delete(id);reject(e);}});
 }
 const api={CORE,normalize,flatten,merge,vehicleFromMavType,valueLabel,withUnits,changeSummary,controlKind,templateEntries,updateText,receive,cached,load};
 root.FieldKitArduMetadata=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
