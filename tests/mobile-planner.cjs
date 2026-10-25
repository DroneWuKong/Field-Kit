const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
require('../source/assets/tools/prismo-contracts.js');
const M=require('../source/assets/mobile/planner-model.js'),fixtures=require('../packages/contracts/fixtures.json');
const root=path.resolve(__dirname,'../source/assets'),out=path.resolve(__dirname,'../build-private/validation');
fs.mkdirSync(out,{recursive:true});
function memory(raw=null){return {raw,getItem(){return this.raw},setItem(k,v){this.raw=v}};}
const storage=memory(),s=new M.Store(storage);s.add(M.newPlan('Test',42,-88));
const original=s.current();storage.setItem=()=>{throw Error('Quota exceeded')};
assert.throws(()=>s.edit(p=>p.name='Lost'),/Quota/);assert.deepEqual(s.current(),original);
const corrupt=new M.Store(memory('{broken'));assert.ok(corrupt.error);assert.throws(()=>corrupt.add(original),/cannot be read/);assert.equal(corrupt.raw,'{broken');
const s2=new M.Store(memory());const imported=M.copy(fixtures.plan);imported.project.source={format:'plan',filename:'mission.plan',text:'original source',document:null,warnings:[],readonly:true};s2.add(imported);assert.throws(()=>s2.edit(p=>p.name='Changed'),/read-only/);assert.deepEqual(s2.current().project.source,imported.project.source);
const s3=new M.Store(memory());s3.add(original);const equipment=PrismoExchange.fromLegacy(fixtures.legacy,'control','uplink');const setup={equipment,selected_control:equipment.radios[0].id};
const before=s3.current();const undo=s3.apply(setup);assert.deepEqual(s3.current().project.home,before.project.home);assert.equal(s3.current().project.settings.margin_db,setup.equipment.margin_db);s3.undo(undo);assert.deepEqual(s3.current(),before);
assert.equal(M.newPlan('Unknown',0,0).project.radios[0].tx_dbm,null);
console.log('Planner model: quota rollback, corruption preservation, read-only source, equipment apply/undo passed.');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  for(const width of [360,393,800]){
   const ctx=await browser.newContext({viewport:{width,height:852},acceptDownloads:true});const p=await ctx.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.host!=='appassets.androidplatform.net')return r.abort();const f=path.resolve(root,decodeURIComponent(u.pathname).replace(/^\/assets\//,''));if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return r.fulfill({status:404});return r.fulfill({path:f,contentType:({'.mjs':'application/javascript','.js':'application/javascript','.html':'text/html','.css':'text/css','.geojson':'application/json','.pbf':'application/x-protobuf'})[path.extname(f)]});});
   await p.addInitScript(()=>{if(!localStorage.getItem('fieldkit-mobile-map-source-v1'))localStorage.setItem('fieldkit-mobile-map-source-v1','world');localStorage.setItem('fieldkit-notes','Preserved bench notes');window.Android={requestFreshPhoneLocation:()=>'{"error":"pending"}',getCurrentPhoneLocation:()=>JSON.stringify(window.testFix||{error:'pending'}),saveText:(name,mime,text)=>window.exported={name,mime,text}};});
   await p.goto('https://appassets.androidplatform.net/assets/mobile/index.html');
   await p.waitForSelector('.maplibregl-canvas');await p.locator('[data-panel=route]').click();await p.locator('#new-route').click();
   await p.locator('#route-name').fill('Phone survey');await p.locator('#rename').click();
   await p.locator('#add-points').click();await p.locator('#map').click({position:{x:width/2,y:300}});await p.locator('#map').click({position:{x:width/2+20,y:320}});await p.locator('#done').click();
   await p.locator('[data-panel=route]').click();await p.locator('[data-waypoint]').first().click();await p.locator('#altitude').fill('75');await p.locator('#alt-mode').selectOption('agl');await p.locator('#save-point').click();
   await p.locator('#edit-antenna').click();await p.locator('#height').fill('6');await p.locator('#save-point').click();await p.locator('#export').click();
   let exported=await p.evaluate(()=>JSON.parse(window.exported.text));assert.equal(exported.project.name,'Phone survey');assert.equal(exported.project.waypoints.length,2);assert.equal(exported.project.waypoints[0].altitude_mode,'agl');assert.equal(exported.project.station.height_m,6);PrismoExchange.plan(exported);
   await p.locator('#close').click();await p.locator('[data-panel=equipment]').click();await p.locator('#setup-name').fill('Survey radios');await p.locator('#save-setup').click();
   await p.locator('[data-radio]').first().click();await p.locator('#frequency').fill('868');await p.locator('#save-radio').click();await p.locator('[data-setup]').click();await p.locator('#apply-setup').click();assert.match(await p.locator('[data-radio]').first().textContent(),/915/);await p.locator('#undo').click();assert.match(await p.locator('[data-radio]').first().textContent(),/868/);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await p.locator('#sheet').evaluate(e=>e.scrollWidth<=e.clientWidth));
   await p.screenshot({path:path.join(out,`mobile-equipment-${width}.png`)});
   await p.locator('#close').click();await p.reload();await p.locator('[data-panel=route]').click();assert.equal(await p.locator('#route-name').inputValue(),'Phone survey');assert.equal(await p.locator('[data-waypoint]').count(),2);
   // A failed save leaves both the displayed and stored route intact.
   await p.evaluate(()=>{window.savedSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===MobilePlanner.KEY)throw Error('Storage is full');return window.savedSet.call(this,k,v)}});
   await p.locator('#route-name').fill('Should not save');await p.locator('#rename').click();assert.match(await p.locator('#message').textContent(),/full/);await p.evaluate(()=>Storage.prototype.setItem=window.savedSet);await p.locator('#export').click();assert.equal(await p.evaluate(()=>JSON.parse(exported.text).project.name),'Phone survey');
   await p.locator('#close').click();await p.screenshot({path:path.join(out,`mobile-map-${width}.png`)});
   if(width===393){
    // Delay a software location fix until after a manual pan: preserve the user's view.
    await p.locator('#locate').click();await p.mouse.move(200,400);await p.mouse.down();await p.mouse.move(270,440,{steps:12});await p.mouse.up();await p.waitForTimeout(400);
    const viewBefore=await p.evaluate(()=>localStorage.getItem('fieldkit-mobile-view-v1'));
    await p.evaluate(()=>window.testFix={lat:51.5,lon:-.12,accuracy:80});await p.waitForSelector('.pin.phone');await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>localStorage.getItem('fieldkit-mobile-view-v1')),viewBefore);
    await p.locator('[data-panel=offline]').click();
    await p.locator('#import-map').setInputFiles(path.join(__dirname,'fixtures/mobile-map.pmtiles'));await p.waitForSelector('[data-area]');
    const glyph=p.waitForRequest(r=>r.url().includes('/fonts/')&&r.url().endsWith('.pbf'));
    await p.locator('[data-area]').click();await glyph;await p.waitForTimeout(1000);
    await p.screenshot({path:path.join(out,'mobile-offline-393.png')});
    const mapId=await p.evaluate(()=>localStorage.getItem('fieldkit-mobile-map-source-v1'));assert.ok(!['street','world'].includes(mapId));
    const requested=[];p.on('request',r=>requested.push(r.url()));await p.reload();await p.waitForTimeout(1200);await p.locator('[data-panel=offline]').click();assert.equal(await p.locator('#map-source').inputValue(),mapId);assert.equal(await p.locator('[data-area]').count(),1);assert.ok(!requested.some(u=>u.includes('tile.openstreetmap.org')));
    await p.locator('#import-map').setInputFiles({name:'bad.pmtiles',mimeType:'application/octet-stream',buffer:Buffer.alloc(200)});await p.waitForFunction(()=>document.querySelector('#panel-message').textContent.length>0);assert.equal(await p.locator('[data-area]').count(),1);
    await p.locator('#close').click();
   }
   assert.equal(await p.evaluate(()=>localStorage.getItem('fieldkit-notes')),'Preserved bench notes');
   await p.evaluate(()=>localStorage.setItem(MobilePlanner.KEY,'{corrupt'));await p.reload();await p.waitForSelector('#raw');await p.locator('#raw').click();assert.equal(await p.evaluate(()=>exported.text),'{corrupt');assert.equal(await p.evaluate(()=>localStorage.getItem(MobilePlanner.KEY)),'{corrupt');
   assert.deepEqual(errors,[]);await ctx.close();
  }
 }finally{await browser.close();}
 console.log('Mobile planner passed at 360, 393, 800 px: map placement, coordinate/altitude edits, export, saved setups, apply/undo, reload, quota failure, corrupt data recovery, legacy storage.');
})().catch(e=>{console.error(e);process.exitCode=1});
