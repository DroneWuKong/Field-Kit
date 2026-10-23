const assert = require('node:assert/strict');
const E = require('../source/assets/tools/prismo-contracts.js');
const fixtures = require('../packages/contracts/fixtures.json');
for (const [power, dbm] of [[1,0],[100,20],[500,26.989700043360187],[1000,30]]) {
  const p = {...fixtures.legacy, power};
  const e = E.fromLegacy(p,'control','uplink');
  assert.ok(Math.abs(e.radios[0].tx_dbm - dbm) < 1e-10);
  assert.deepEqual(e.source_profile,p); assert.equal(e.revision,7); assert.equal(e.id,p.id);
  assert.equal(e.radios[0].provenance,'assumed');
}
const equipment = E.fromLegacy(fixtures.legacy,'control','uplink');
assert.throws(()=>E.fromLegacy(fixtures.legacy,'','uplink'),/role/);
assert.throws(()=>E.fromLegacy(fixtures.legacy,'video',''),/role/);
for (const power of [0,-1,NaN,Infinity,'100']) assert.throws(()=>E.fromLegacy({...fixtures.legacy,power},'control','uplink'));
const back = E.toLegacy(equipment, equipment.radios[0].id);
assert.equal(back.power,100);assert.equal(back.batteryMah,5000);assert.equal(back.revision,7);
const unknown = structuredClone(equipment); unknown.radios[0].tx_dbm=null; unknown.radios[0].sensitivity_dbm=null;
assert.equal(E.parse(JSON.stringify(unknown)).radios[0].tx_dbm,null);
assert.throws(()=>E.toLegacy(unknown,unknown.radios[0].id),/must be known/);
assert.throws(()=>E.toLegacy({...equipment,radios:[{...equipment.radios[0],cable_loss_db:3}]},equipment.radios[0].id),/losses/);
assert.throws(()=>E.equipment({...equipment,radios:[equipment.radios[0],equipment.radios[0]]}),/unique/);
assert.throws(()=>E.equipment({...equipment,schema:'prismo.equipment.v99'}));
assert.throws(()=>E.equipment({...equipment,margin_db:Infinity}));
assert.throws(()=>E.equipment({...equipment,radios:[{...equipment.radios[0],role:'unknown'}]}));
assert.deepEqual(E.parse(JSON.stringify(fixtures.plan)), fixtures.plan);
assert.throws(()=>E.plan({...fixtures.plan,evidence:'measured'}));
assert.throws(()=>E.plan({...fixtures.plan,project:{...fixtures.plan.project,settings:{...fixtures.plan.project.settings,selected_control:'absent'}}}));
assert.throws(()=>E.parse(' '.repeat(5000001)),/5 MB/);
console.log('Shared contracts: power conversions, source preservation, unknowns, roles, revisions, schema rejection and plan round-trip passed.');
