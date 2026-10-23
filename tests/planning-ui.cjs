const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fixtures=require('../packages/contracts/fixtures.json');
const root=path.resolve(__dirname,'../source/assets'),out=path.resolve(__dirname,'../build-private/validation');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for (const width of [360,393,800]) {
   const ctx=await browser.newContext({viewport:{width,height:852},acceptDownloads:true});
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.host!=='appassets.androidplatform.net')return r.abort();const f=path.resolve(root,u.pathname.replace(/^\/assets\//,''));if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return r.fulfill({status:404});return r.fulfill({path:f,contentType:({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(f)]});});
   await p.addInitScript(profile=>{if(!localStorage.getItem('test-seeded')){localStorage.setItem('fieldkit-profiles',JSON.stringify([profile]));localStorage.setItem('fieldkit-selected-profile',JSON.stringify(profile.id));localStorage.setItem('fieldkit-notes',JSON.stringify('Preserve bench notes'));localStorage.setItem('test-seeded','yes');}},fixtures.legacy);
   await p.goto('https://appassets.androidplatform.net/assets/tools/tools_offline.html?mode=standalone');
   await p.locator('#kit-nav-home').click();await p.waitForSelector('#kit-plan:visible');
   await p.locator('#kit-plan-download-equipment').click();assert.match(await p.locator('#kit-plan-status').textContent(),/role/);
   await p.locator('#kit-plan-role').selectOption('control');await p.locator('#kit-plan-direction').selectOption('uplink');
   const downloaded=p.waitForEvent('download');await p.locator('#kit-plan-download-equipment').click();const f=await downloaded;
   const exported=JSON.parse(fs.readFileSync(await f.path(),'utf8'));assert.equal(exported.radios[0].tx_dbm,20);assert.equal(exported.revision,7);assert.deepEqual(exported.source_profile,fixtures.legacy);
   await p.locator('#kit-plan-file').setInputFiles({name:'plan.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixtures.plan))});
   await p.waitForSelector('#kit-plan-save');
   // Failed storage must not create a ghost record.
   await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fieldkit-planning-records-v1')throw new DOMException('full','QuotaExceededError');return window.originalSet.call(this,k,v);};});
   await p.locator('#kit-plan-save').click();assert.match(await p.locator('#kit-plan-status').textContent(),/Could not save/);
   assert.equal(await p.evaluate(()=>localStorage.getItem('fieldkit-planning-records-v1')),null);
   await p.evaluate(()=>Storage.prototype.setItem=window.originalSet);
   await p.locator('#kit-plan-save').click();assert.match(await p.locator('#kit-plan-status').textContent(),/Saved to Records/);
   await p.locator('#kit-plan-file').setInputFiles({name:'equipment.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await p.waitForSelector('#kit-plan-save');
   await p.locator('#kit-plan-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"future"}')});
   await p.waitForFunction(()=>document.querySelector('#kit-plan-status').textContent.startsWith('Import rejected'));
   assert.equal(await p.locator('#kit-plan-preview').isVisible(),false);
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('fieldkit-planning-records-v1')).length),1);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await p.locator('#kit-plan').evaluate(e=>e.scrollWidth<=e.clientWidth));
   await p.locator('#kit-plan').evaluate(e=>e.scrollTop=0);
   await p.screenshot({path:path.join(out,`planning-${width}.png`)});
   await p.locator('#kit-plan-records').click();assert.match(await p.locator('#kit-planning-records').textContent(),/Survey plan/);
   assert.match(await p.locator('#kit-planning-records').textContent(),/Predicted plan/);
   await p.reload();await p.locator('#kit-nav-checks').click();assert.match(await p.locator('#kit-planning-records').textContent(),/Survey plan/);
   assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('fieldkit-profiles'))),[fixtures.legacy]);
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('fieldkit-notes'))),'Preserve bench notes');
   const back=p.waitForEvent('download');await p.locator('#kit-planning-records').getByRole('button',{name:'Download',exact:true}).click();const roundtrip=JSON.parse(fs.readFileSync(await (await back).path(),'utf8'));assert.deepEqual(roundtrip,fixtures.plan);
   await p.locator('#kit-checks-close').click();await p.locator('#kit-nav-home').click();
   exported.radios[0].tx_dbm=23;
   await p.locator('#kit-plan-file').setInputFiles({name:'updated-equipment.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await p.waitForSelector('#kit-plan-save');await p.locator('#kit-plan-save').click();await p.locator('#kit-plan-records').click();
   await p.getByText('Use a radio in quick tools',{exact:true}).click();
   await p.getByLabel('Radio to use from '+exported.name).selectOption(exported.radios[0].id);
   await p.getByRole('button',{name:'Use selected radio',exact:true}).click();
   const profiles=await p.evaluate(()=>JSON.parse(localStorage.getItem('fieldkit-profiles')));
   assert.equal(profiles.length,2);assert.deepEqual(profiles[0],fixtures.legacy);assert.notEqual(profiles[1].id,profiles[0].id);assert.ok(Math.abs(profiles[1].power-199.52623149688787)<1e-8);
   await p.locator('#kit-checks-close').click();await p.locator('#kit-nav-equipment').click();assert.equal(await p.locator('#tool-configuration-deploy').isVisible(),true);
   await p.locator('#kit-nav-tools').click();assert.equal(await p.locator('#tool-connection-doctor').isVisible(),true);
   assert.deepEqual(errors,[]);await ctx.close();
  }
  console.log('Planning UI passed at 360, 393 and 800 px: exchange, quota failure, invalid preview clearing, reload, records, navigation and legacy data preservation.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
