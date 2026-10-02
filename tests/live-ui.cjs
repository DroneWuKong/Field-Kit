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
   await page.addInitScript(()=>{
    const bytes64=b=>{let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s);};
    const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    const crc=(bytes,extra)=>{let c=0xffff;for(const b of [...bytes,extra]){let t=b^(c&255);t^=(t<<4)&255;c=((c>>8)^(t<<8)^(t<<3)^(t>>4))&65535;}return c;};
    const extras={0:50,20:214,21:159,22:220,23:168,76:152,148:178};let seq=0;
    const frame=(id,payload)=>{const h=[payload.length,0,0,seq++&255,1,1,id&255,(id>>8)&255,(id>>16)&255],sum=crc([...h,...payload],extras[id]);return Uint8Array.from([253,...h,...payload,sum&255,sum>>8]);};
    const heartbeat=()=>{const b=new Uint8Array(9);b[5]=12;return frame(0,b);};
    const version=()=>{const b=new Uint8Array(60),v=new DataView(b.buffer);v.setBigUint64(0,16n,true);v.setUint32(8,0x010f0400,true);v.setUint32(20,42,true);v.setBigUint64(52,1234n,true);return frame(148,b);};
    const values={MPC_XY_VEL_MAX:5,MC_ROLLRATE_P:Math.fround(.15)};
    const param=(name,value,index)=>{const b=new Uint8Array(25),v=new DataView(b.buffer);v.setFloat32(0,value,true);v.setUint16(4,2,true);v.setUint16(6,index,true);for(let i=0;i<name.length;i++)b[8+i]=name.charCodeAt(i);b[24]=9;return frame(22,b);};
    let queue=[heartbeat()],state='closed';
    window.Android={
     listConfigPorts:()=>JSON.stringify([{id:'usb:test#0',label:'PX4 production fixture',serial:'DEMO-001'}]),
     openConfigUsb:()=>{state='connected';queue.push(heartbeat());return JSON.stringify({state,id:'usb:test#0',error:''});},
     configPortStatus:()=>JSON.stringify({state,id:'usb:test#0',error:''}),
     readConfigBytes:()=>bytes64(queue.shift()||heartbeat()),
     writeConfigBytes:s=>{const p=from64(s),id=p[7]|p[8]<<8|p[9];
      if(id===76)queue.push(version(),heartbeat());
      if(id===21)queue.push(param('MPC_XY_VEL_MAX',values.MPC_XY_VEL_MAX,0),param('MC_ROLLRATE_P',values.MC_ROLLRATE_P,1),heartbeat());
      if(id===23){const name=String.fromCharCode(...p.slice(16,32)).split('\0')[0],value=new DataView(p.buffer,p.byteOffset+10,4).getFloat32(0,true);values[name]=value;queue.push(heartbeat(),param(name,value,name==='MPC_XY_VEL_MAX'?0:1));}
      return 'ok';},
     closeConfigPort:()=>{state='closed';},pinConfigPeer:()=>true,saveConfigRun:()=>true,saveText:()=>{},copyText:()=>true,
     fetchArduMetadata:(id,vehicle,keys)=>setTimeout(()=>FieldKitArduMetadata.receive(id,JSON.stringify({vehicle,fetchedAt:'2026-10-02T00:00:00Z',parameters:{WPNAV_SPEED:{DisplayName:'Mission travel speed',Description:'Maximum horizontal speed while travelling between mission points.',Units:'cm/s',Range:{low:20,high:2000},Increment:50,User:'Standard'}}}),null),0)
    };
   });
   await page.route('**/*',route=>{
    const u=new URL(route.request().url());if(u.host!=='appassets.androidplatform.net')return route.abort();
    const f=path.resolve(root,u.pathname.replace(/^\/assets\//,''));
    if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.fulfill({status:404});
    return route.fulfill({path:f,contentType:({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(f)]});
   });
   await page.goto('https://appassets.androidplatform.net/assets/tools/tools_offline.html?mode=standalone#home');
   assert.equal(await page.locator('#kit-home').isVisible(),true);
   assert.equal(await page.locator('#kit-bottom-nav').isVisible(),true);
   assert.equal(await page.locator('.kit-task').count(),5);
   assert.equal(await page.locator('#tool-list .tool-choice').count(),21);
   if(width===393)await page.screenshot({path:path.join(out,'full-app-home-393.png'),fullPage:true});
   await page.evaluate(()=>showTool('configuration-deploy',true));
   await page.locator('#kit-deploy-connected').click();
   assert.equal(await page.locator('#kit-deploy-connect').isVisible(),true);
   assert.equal(await page.locator('#kit-deploy-port option').count(),1);
   assert.equal(await page.locator('#kit-deploy-run').isDisabled(),true);
   assert.equal(await page.locator('#kit-bottom-nav').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.screenshot({path:path.join(out,`connected-${width}.png`),fullPage:true});
   if(width===393){
    await page.locator('#kit-deploy-stack').selectOption('px4');
    await page.locator('#kit-deploy-connected').click();
    await page.locator('#kit-deploy-open').click();
    await page.waitForFunction(()=>document.querySelector('#kit-deploy-device')?.textContent.includes('settings read from hardware'));
    assert.equal(await page.locator('#kit-deploy-parameter-browser').isVisible(),true);await page.locator('#kit-deploy-parameter-browser').evaluate(e=>e.open=true);await page.locator('#kit-deploy-parameter-search').fill('MPC');assert.match(await page.locator('#kit-deploy-parameter-rows').textContent(),/MPC_XY_VEL_MAX/);
    await page.locator('#kit-deploy-pull').click();
    await page.waitForFunction(()=>document.querySelector('#kit-deploy-text')?.value.includes('MPC_XY_VEL_MAX'));
    await page.locator('#kit-deploy-name').fill('PX4 line setup');
    await page.locator('#kit-deploy-text').evaluate(e=>{e.value=e.value.replace(/MPC_XY_VEL_MAX\t5\t9/,'MPC_XY_VEL_MAX\t6\t9');e.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#kit-deploy-to-targets').click();
    await page.locator('#kit-deploy-preview').click();
    await page.waitForFunction(()=>document.querySelector('#kit-deploy-preview-results')?.textContent.includes('1 changes'));
    assert.equal(await page.locator('.kit-deploy-setting:checked').count(),1);
    await page.locator('#kit-deploy-to-run').click();
    await page.locator('#kit-deploy-run').click();
    await page.waitForFunction(()=>document.querySelector('#kit-deploy-run-results')?.textContent.includes('verified-active'));
    assert.equal(await page.locator('#kit-deploy-verify-restart').isVisible(),true);await page.locator('#kit-deploy-verify-restart').click();await page.waitForFunction(()=>document.querySelector('#kit-deploy-run-results')?.textContent.includes('verified-persistent'));
    await page.locator('#kit-deploy-stage-3').screenshot({path:path.join(out,'connected-result-393.png')});
    await page.locator('#kit-deploy-next-aircraft').click();assert.equal(await page.locator('#kit-deploy-stage-1').isVisible(),true);assert.equal(await page.locator('#kit-deploy-name').inputValue(),'PX4 line setup');
   }
   await page.locator('#kit-deploy-practice').click();
   assert.equal(await page.locator('#kit-deploy-connect').isHidden(),true);
   assert.equal(await page.locator('#kit-deploy-targets input').count(),3);
   if(width===393){
    await page.locator('#kit-deploy-stack').selectOption('ardupilot');
    assert.equal(await page.locator('#kit-deploy-parameter-browser').isVisible(),true);
    assert.equal(await page.locator('#kit-deploy-raw-editor').evaluate(e=>e.open),false);
    await page.locator('#kit-deploy-parameter-search').fill('waypoint');
    assert.match(await page.locator('#kit-deploy-parameter-rows').textContent(),/Waypoint speed/);
    const card=page.locator('.kit-param-card[data-param="WPNAV_SPEED"]');
    await card.locator('.kit-param-value').fill('500');await card.locator('.kit-param-value').dispatchEvent('change');
    assert.match(await page.locator('#kit-deploy-text').inputValue(),/WPNAV_SPEED 500/);
    await page.locator('#kit-deploy-metadata-refresh').click();
    await page.waitForFunction(()=>document.querySelector('#kit-deploy-metadata-source')?.textContent.includes('Official ArduPilot'));
    await page.locator('#kit-deploy-parameter-search').fill('mission');
    assert.match(await page.locator('#kit-deploy-parameter-rows').textContent(),/Mission travel speed/);
    await page.locator('#kit-deploy-parameter-browser').screenshot({path:path.join(out,'guided-ardupilot-393.png')});
   }
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Connected-device controls and Practice at 360, 393, 800 px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
