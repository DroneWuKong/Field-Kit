const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../source/assets');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:393,height:852}});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>{
   const u=new URL(r.request().url());if(u.host!=='appassets.androidplatform.net')return r.abort();
   const f=path.resolve(root,u.pathname.replace(/^\/assets\//,''));
   if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return r.fulfill({status:404});
   return r.fulfill({path:f,contentType:({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(f)]});
  });
  await p.addInitScript(()=>{
   localStorage.setItem('fieldkit-favorites',JSON.stringify(['mafialrs','range']));
   localStorage.setItem('fieldkit-recent',JSON.stringify(['mafialrs','battery']));
   localStorage.setItem('tak-tool','mafialrs');
   localStorage.setItem('fieldkit-notes',JSON.stringify('Existing bench notes'));
  });
  await p.goto('https://appassets.androidplatform.net/assets/tools/tools_offline.html?mode=standalone#mafialrs');
  await p.waitForSelector('#kit-bottom-nav');
  assert.equal(await p.evaluate(()=>toolCatalog.length),21);
  assert.equal(await p.locator('#tool-mafialrs,[data-tool=mafialrs],[data-shortcut=mafialrs]').count(),0);
  assert.equal(await p.evaluate(()=>FieldKit.getView().active),null);
  assert.equal(await p.locator('#kit-favorites [data-shortcut=range]').count(),1);
  assert.equal(await p.locator('#kit-recent [data-shortcut=battery]').count(),1);
  assert.equal(await p.evaluate(()=>showTool('mafialrs')),false);
  await p.locator('#kit-nav-tools').click();await p.locator('#tool-search').fill('mafia');
  assert.equal(await p.locator('.tool-choice:visible').count(),0);
  assert.equal(await p.locator('#empty-tools').isVisible(),true);
  await p.locator('#close-tools').click();
  await p.locator('[data-flow=hardware]').click();
  await p.locator('#kit-workflow-steps').evaluate(e=>e.open=true);
  await p.locator('#kit-workflow-steps details').evaluate(e=>e.open=true);
  assert.match(await p.locator('#kit-workflow-steps').textContent(),/ExpressLRS/);
  assert.doesNotMatch(await p.locator('#kit-workflow-steps').textContent(),/mafia/i);
  await p.evaluate(()=>FieldKit.navigate('field-checklist'));
  assert.equal(await p.locator('#kit-check-notes').inputValue(),'Existing bench notes');
  assert.deepEqual(errors,[]);
  const result={tool_count:21,stale_shortcuts_filtered:true,retired_hash_returns_home:true,retired_tool_rejected:true,search_empty:true,hardware_flow_intact:true,existing_notes_preserved:true,errors};
  fs.writeFileSync(path.resolve(__dirname,'../output/app/fieldkit-validation.json'),JSON.stringify(result,null,2));console.log(result);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
