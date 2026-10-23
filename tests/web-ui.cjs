const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const width of [360,393,800,1365]){
  const p=await browser.newPage({viewport:{width,height:900}}),errors=[],failures=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(r.status()+' '+r.url())});
  await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await p.goto('http://127.0.0.1:18767/FieldKit');await p.locator('#kit-bottom-nav').waitFor();
  assert.equal(new URL(p.url()).search,'');assert.equal(await p.evaluate(()=>toolCatalog.length),21);
  await p.locator('#kit-nav-home').click();
  const download=p.getByRole('link',{name:'Download for Windows'});assert.match(await download.getAttribute('href'),/horizon-v0.2.0-windows/);
  assert.match(await p.locator('#kit-plan').textContent(),/Detailed Horizon terrain analysis runs in the desktop app/);
  assert.ok(await p.locator('#kit-plan').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await p.locator('#kit-plan-close').click();await p.locator('#kit-nav-equipment').click();assert.equal(await p.locator('#tool-configuration-deploy').isVisible(),true);
  await p.locator('#kit-nav-tools').click();assert.equal(await p.locator('[data-adapter=usb]').isVisible(),false);assert.equal(await p.locator('[data-adapter=simulation]').isVisible(),true);
  await p.locator('#kit-nav-checks').click();assert.equal(await p.locator('#kit-saved-checks').isVisible(),true);await p.locator('#kit-checks-close').click();
  await p.evaluate(()=>FieldKit.navigate('equipment-profiles'));if(await p.locator('#kit-profile-new').isVisible())await p.locator('#kit-profile-new').click();await p.locator('#kit-profile-name').fill('Web survey kit');await p.locator('#kit-profile-save').click();
  await p.reload();assert.equal(await p.evaluate(()=>FieldKit.workspace.getProfile().name),'Web survey kit');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.evaluate(()=>fieldKitHome());await p.screenshot({path:path.join('build-private',`web-${width}.png`)});
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);await p.close();
 }
 console.log('Hosted Field Kit: clean /FieldKit URL, 21 tools, navigation, Windows download, browser-only diagnostics, profile persistence and four widths passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
