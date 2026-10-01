const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../source/assets');
const out=path.resolve(__dirname,'../output/ui-preview');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [360,393,800]){
   const context=await browser.newContext({viewport:{width,height:852},deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.Android={listConfigPorts:()=>JSON.stringify([{id:'usb:test#0',label:'Sample USB port',serial:'DEMO-001'}]),closeConfigPort:()=>{}};});
   await page.route('**/*',route=>{
    const u=new URL(route.request().url());if(u.host!=='appassets.androidplatform.net')return route.abort();
    const f=path.resolve(root,u.pathname.replace(/^\/assets\//,''));
    if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.fulfill({status:404});
    return route.fulfill({path:f,contentType:({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(f)]});
   });
   await page.goto('https://appassets.androidplatform.net/assets/tools/tools_offline.html?mode=standalone&configPreview=1#configuration-deploy');
   await page.locator('#kit-deploy-connected').click();
   assert.equal(await page.locator('#kit-deploy-connect').isVisible(),true);
   assert.equal(await page.locator('#kit-deploy-port option').count(),1);
   assert.equal(await page.locator('#kit-deploy-run').isDisabled(),true);
   assert.equal(await page.locator('#kit-bottom-nav').isHidden(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.screenshot({path:path.join(out,`connected-${width}.png`),fullPage:true});
   await page.locator('#kit-deploy-practice').click();
   assert.equal(await page.locator('#kit-deploy-connect').isHidden(),true);
   assert.equal(await page.locator('#kit-deploy-targets input').count(),3);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Connected-device controls and Practice at 360, 393, 800 px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
