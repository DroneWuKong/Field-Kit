'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test');
const A=require('../source/assets/tools/fieldkit-ardu-metadata.js');

test('official ArduPilot groups flatten into guided metadata',()=>{
 const rows=A.flatten({json:{version:0},Navigation:{WPNAV_SPEED:{DisplayName:'Waypoint Speed',Description:'Maximum speed',Units:'cm/s',Range:{low:20,high:2000},Increment:50,User:'Standard'}},Safety:{ARMING_CHECK:{DisplayName:'Arming checks',Bitmask:{0:'All',2:'Compass'},RebootRequired:true}}});
 assert.equal(rows.WPNAV_SPEED.displayName,'Waypoint Speed');assert.deepEqual(rows.WPNAV_SPEED.range,[20,2000]);assert.equal(rows.WPNAV_SPEED.increment,50);assert.deepEqual(rows.ARMING_CHECK.bitmask,{'0':'All','2':'Compass'});assert.equal(rows.ARMING_CHECK.rebootRequired,true);
});
test('enum strings and cached normalized records remain readable',()=>{
 const rows=A.flatten({parameters:{GPS_TYPE:{displayName:'GPS type',description:'Driver',values:{0:'None',1:'Auto'},user:'Standard'}}});
 assert.equal(rows.GPS_TYPE.values['1'],'Auto');assert.equal(A.controlKind(rows.GPS_TYPE),'choice');
});
test('friendly summaries include labels, units and useful conversions',()=>{
 assert.equal(A.changeSummary('WPNAV_SPEED',400,500,A.CORE.WPNAV_SPEED),'Waypoint speed: 400 cm/s (4 m/s) → 500 cm/s (5 m/s)');
 const mode=A.normalize({DisplayName:'Mode',Values:'0:Disabled,1:Enabled'});assert.equal(A.changeSummary('MODE',0,1,mode),'Mode: Disabled → Enabled');
});
test('template edits update simple and QGroundControl formats without hiding raw text',()=>{
 assert.equal(A.updateText('WPNAV_SPEED 400\nSYSID_THISMAV 1\n','WPNAV_SPEED',500),'WPNAV_SPEED 500\nSYSID_THISMAV 1\n');
 assert.equal(A.updateText('1\t1\tWPNAV_SPEED\t400\t9\n','WPNAV_SPEED',450),'1\t1\tWPNAV_SPEED\t450\t9\n');
 assert.equal(A.updateText('WPNAV_SPEED 400\n','WPNAV_SPEED',0,true),'');
 assert.equal(A.templateEntries('WPNAV_SPEED 500\n').WPNAV_SPEED.value,'500');
});
test('MAV types select the correct ArduPilot metadata family',()=>{
 assert.equal(A.vehicleFromMavType(3),'ArduCopter');assert.equal(A.vehicleFromMavType(2),'ArduPlane');assert.equal(A.vehicleFromMavType(10),'Rover');assert.equal(A.vehicleFromMavType(12),'ArduSub');
});
