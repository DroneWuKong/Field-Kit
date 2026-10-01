'use strict';
// The bridge keeps its existing Tools UI; the standalone app owns this workspace.
if (new URLSearchParams(location.search).get('mode') === 'standalone') {
  const originalShowTool = window.showTool;
  const initialTool = location.hash.slice(1);
  const kitFlows = {
    link: {name:'Plan a radio link', desc:'Estimate range and check the terrain', icon:'broadcast', steps:[['range','Estimate range'],['rf-terrain','Check terrain'],['fresnel','Check clearance']], extras:['mesh-planner','dipole','harmonics','signal-check']},
    video: {name:'Set up video', desc:'Choose a transmitter and separate channels', icon:'video-camera', steps:[['vtx-config','Choose transmitter'],['channel-planner','Separate channels'],['closest-channel','Match frequency']], extras:['unlock-vtx','harmonics']},
    hardware: {name:'Check a connection', desc:'Find the next thing to check on USB or Wi-Fi', icon:'plugs-connected', steps:[['connection-doctor','Check connection'],['position-health','Check position'],['field-checklist','Save bench notes']], extras:['equipment-profiles','config-inspector','fc-matcher','elrs-info']},
    field: {name:'Quick field tools', desc:'Coordinates, battery time and signal readings', icon:'toolbox', steps:[['coordinates','Convert coordinates'],['battery','Estimate battery time'],['signal-check','Check signal readings']], extras:['field-checklist','dipole']}
  };
  const additions = [
    ['coordinates','Coordinate workbench','Convert DD, DMS & MGRS; copy a location','Field utilities','map-pin',false],
    ['battery','Battery & endurance','Capacity, reserve, current & runtime','Field utilities','battery-charging',false],
    ['signal-check','Signal & power','dBm/mW conversion and manual link headroom','Field utilities','wave-sine',false],
    ['field-checklist','Bench checklist','Save verification notes for your field kit','Field utilities','checks',false],
    ['equipment-profiles','Equipment profiles','Save radio, antenna, video, battery & firmware assumptions','Hardware','identification-card',false],
    ['config-inspector','Configuration inspector','Inspect and compare Betaflight CLI text offline','Hardware','git-diff',false],
    ['connection-doctor','Connection Doctor','Guided USB/network, protocol, telemetry & video diagnosis','Hardware','stethoscope',false],
    ['configuration-deploy','Configuration workbench','Pull, compare and apply settings on connected flight controllers','Hardware','stack',false],
    ['position-health','Position health','Inspect freshness, accuracy & source disagreement','Field utilities','crosshair',false]
  ];
  toolCatalog.push(...additions);
  kitFlows.link.extras.push('equipment-profiles','connection-doctor');
  kitFlows.hardware.extras.unshift('configuration-deploy');
  kitFlows.video.extras.push('equipment-profiles','config-inspector','connection-doctor');
  kitFlows.field.extras.unshift('position-health');
  let flow = null, active = null;
  const read = (key,fallback) => { try { const v=JSON.parse(localStorage.getItem('fieldkit-'+key));return v===null?fallback:v; } catch(_){return fallback;} };
  const write = (key,value) => { try { localStorage.setItem('fieldkit-'+key,JSON.stringify(value)); } catch(_){ document.getElementById('kit-storage-status').textContent='Local saving unavailable in this device session.'; } };
  const validIDs=new Set(toolCatalog.map(t=>t[0]));
  let favorites=read('favorites',['range','coordinates','battery']);
  let recent=read('recent',[]);
  favorites=Array.isArray(favorites)?favorites.filter(id=>validIDs.has(id)):[];
  recent=Array.isArray(recent)?recent.filter(id=>validIDs.has(id)).slice(0,4):[];
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el=id=>document.getElementById(id);
  const field = (id,label,value,min,max,step='any') => `<div class="input-group"><label for="${id}">${label}</label><input class="tool-input" id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></div>`;
  function panel(id,title,description,html) {
    const section=document.createElement('section');section.id='tool-'+id;section.className='tool-panel';section.setAttribute('aria-hidden','true');
    section.innerHTML=`<div class="tool-header"><h1 class="tool-title" tabindex="-1">${title}</h1><p class="tool-desc">${description}</p></div>${html}`;
    el('tool-content').append(section);
  }
  // Extension seam keeps new workbench tools in the existing four task paths.
  window.FieldKit = {panel,read,write,esc,el,field,flows:kitFlows,
    navigate:(id,task=null)=>{flow=task;return showTool(id,true);},
    getView:()=>({active,flow})};
  function updateRail() {
    const rail=el('kit-workflow');rail.hidden=!flow||!active;
    if(!flow||!active)return;
    const f=kitFlows[flow],expanded=rail.dataset.flow===flow&&!!el('kit-workflow-steps')?.open;rail.dataset.flow=flow;rail.replaceChildren();
    const index=f.steps.findIndex(([id])=>id===active);
    const heading=document.createElement('div');heading.className='kit-flow-heading';heading.textContent=(index<0?'Related tool':'Step '+(index+1)+' of '+f.steps.length)+' · '+f.name;rail.append(heading);const steps=document.createElement('details');steps.id='kit-workflow-steps';steps.open=expanded;const toggle=document.createElement('summary');toggle.textContent='View steps & related tools';steps.append(toggle);rail.append(steps);
    const buttons=document.createElement('div');buttons.className='kit-flow-steps';
    for(const [id,label] of f.steps) {const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-current',String(active===id));b.onclick=()=>showTool(id,true);buttons.append(b);}
    steps.append(buttons);
    if(f.extras.length){const d=document.createElement('details');const s=document.createElement('summary');s.textContent='Related tools';d.append(s);const x=document.createElement('div');x.className='kit-chips';for(const id of f.extras){const b=document.createElement('button');b.textContent=toolCatalog.find(t=>t[0]===id)[1];b.onclick=()=>showTool(id,true);x.append(b);}d.append(x);steps.append(d);}
  }
  function toolButtons(container,ids) {
    container.replaceChildren();
    for(const id of ids){const t=toolCatalog.find(t=>t[0]===id);const b=document.createElement('button');b.className='kit-shortcut';b.dataset.shortcut=id;b.innerHTML=`<i class="ph ph-${t[4]}" aria-hidden="true"></i><span>${t[1]}</span>`;b.onclick=()=>{flow=null;showTool(id,true);};container.append(b);}
  }
  function renderHome() {toolButtons(el('kit-favorites'),favorites);toolButtons(el('kit-recent'),recent);el('kit-recents-section').hidden=!recent.length;el('kit-empty-favorites').hidden=!!favorites.length;}
  window.fieldKitHome = () => {
    active=null;flow=null;document.body.classList.add('kit-at-home');el('kit-home').hidden=false;el('tool-content').hidden=true;el('kit-workflow').hidden=true;el('kit-pin').hidden=true;
    if(el('tool-library').open)el('tool-library').close();
    history.replaceState(null,'',location.pathname+location.search+'#home');document.title='Prismo Field Kit';el('kit-toolbar-title').textContent='Field Kit';renderHome();window.scrollTo(0,0);window.dispatchEvent(new Event('fieldkit-view'));
  };
  window.showTool = (id,focus=false) => {
    if (!el('kit-home')) return originalShowTool(id,focus);
    if(id==='home'){fieldKitHome();return true;}
    if(!validIDs.has(id))return false;
    el('kit-home').hidden=true;el('tool-content').hidden=false;document.body.classList.remove('kit-at-home');
    const ok=originalShowTool(id,focus);if(!ok)return false;
    active=id;recent=[id,...recent.filter(x=>x!==id)].slice(0,4);write('recent',recent);
    el('kit-pin').hidden=false;el('kit-pin').textContent=favorites.includes(id)?'★':'☆';el('kit-pin').setAttribute('aria-label',favorites.includes(id)?'Remove favorite':'Add favorite');el('kit-pin').setAttribute('aria-pressed',String(favorites.includes(id)));
    el('kit-toolbar-title').textContent=toolCatalog.find(t=>t[0]===id)[1];document.title=el('kit-toolbar-title').textContent+' · Prismo Field Kit';updateRail();window.dispatchEvent(new Event('fieldkit-view'));return true;
  };
  window.fieldKitBack=()=>{if(active){fieldKitHome();return true;}return false;};
  document.addEventListener('DOMContentLoaded',()=>{
    document.body.classList.add('fieldkit');
    const toolbar=document.querySelector('.app-toolbar');toolbar.innerHTML='<button id="kit-home-button" class="kit-brand" aria-label="Go to Field Kit home"><span class="app-eyebrow">PRISMO</span><span class="app-section" id="kit-toolbar-title">Field Kit</span></button><div class="kit-toolbar-actions"><button id="kit-pin" class="icon-button" aria-label="Add favorite" hidden>☆</button><button id="open-tools" class="library-button" aria-haspopup="dialog"><i class="ph ph-magnifying-glass" aria-hidden="true"></i> Tools</button></div>';
    el('kit-home-button').onclick=fieldKitHome;
    el('kit-pin').onclick=()=>{if(favorites.includes(active))favorites=favorites.filter(x=>x!==active);else favorites.push(active);write('favorites',favorites);el('kit-pin').textContent=favorites.includes(active)?'★':'☆';el('kit-pin').setAttribute('aria-label',favorites.includes(active)?'Remove favorite':'Add favorite');el('kit-pin').setAttribute('aria-pressed',String(favorites.includes(active)));};
    el('tool-list').addEventListener('click',()=>{flow=null;},true);
    el('open-tools').onclick=()=>{el('tool-library').showModal();el('tool-search').value='';el('tool-search').dispatchEvent(new Event('input'));el('tool-search').focus();};
    el('library-title').textContent='Find a tool';
    const home=document.createElement('main');home.id='kit-home';
    home.innerHTML=`<div class="kit-hero"><span class="kit-badge">PRISMO FIELD KIT</span><h1>What do you need to do?</h1><p>Pick a task. We’ll guide you through it.</p></div><section id="kit-home-equipment" class="kit-home-equipment"></section><div class="kit-tasks">${['hardware','link','video','field'].map(id=>{const f=kitFlows[id];return `<button data-flow="${id}" class="kit-task"><span class="kit-task-icon"><i class="ph ph-${f.icon}" aria-hidden="true"></i></span><span><strong>${f.name}</strong><span>${f.desc}</span></span><i class="ph ph-caret-right" aria-hidden="true"></i></button>`;}).join('')}</div><details class="kit-saved-tools"><summary>Pinned & recent tools</summary><section class="kit-section"><h2>Pinned tools</h2><div id="kit-favorites" class="kit-shortcuts"></div><p id="kit-empty-favorites" hidden>Open a tool and tap the star to keep it here.</p></section><section class="kit-section" id="kit-recents-section" hidden><h2>Recently used</h2><div id="kit-recent" class="kit-shortcuts"></div></section></details><p class="kit-footnote" id="kit-storage-status">Your equipment and notes stay on this device. Calculators work offline; online maps need internet.</p>`;
    toolbar.after(home);const rail=document.createElement('section');rail.id='kit-workflow';rail.hidden=true;rail.setAttribute('aria-label','Task steps');el('tool-content').before(rail);
    home.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>{flow=b.dataset.flow;showTool(kitFlows[flow].steps[0][0],true);});
    panel('coordinates','Coordinate workbench','WGS84 decimal degrees, DMS and MGRS in one place. MGRS input represents a grid cell, not a surveyed point.',`<label for="kit-coordinate-input">Location</label><input class="tool-input kit-wide" id="kit-coordinate-input" value="48.8582, 2.2945" placeholder="48.8582, 2.2945 or 31UDQ4825111932"><div class="kit-chips"><button id="kit-coordinate-convert">Convert</button><button id="kit-coordinate-gps">Use phone location</button></div><p id="kit-gps-status" role="status"></p><div id="kit-coordinate-results" class="result-card" aria-live="polite"></div><div class="kit-chips"><button id="kit-coordinate-copy">Copy coordinates</button><button id="kit-coordinate-map">Open in terrain</button></div>`);
    panel('battery','Battery & endurance','Estimate runtime from usable capacity and measured average current. The reserve is your input; this does not predict sag, battery health or flight performance.',`<div class="input-grid">${field('kit-battery-mah','Rated capacity (mAh)',5000,1,1000000)}${field('kit-battery-voltage','Nominal pack voltage (V)',22.2,0.1,1000)}${field('kit-battery-current','Average current (A)',20,0.01,10000)}${field('kit-battery-reserve','Reserve (%)',20,0,99)}</div><div id="kit-battery-result" class="result-card" aria-live="polite"></div>`);
    panel('signal-check','Signal & power','Convert RF power and compare a manual RSSI reading with the receiver sensitivity for your selected packet rate. LQ counts packets received; it is separate from RSSI.',`<div class="input-grid">${field('kit-power-mw','Transmit power (mW)',1000,0.001,1000000)}${field('kit-power-dbm','Transmit power (dBm)',30,-30,60)}${field('kit-signal-rssi','Measured RSSI (dBm)',-85,-150,0)}${field('kit-signal-sensitivity','Selected sensitivity (dBm)',-105,-150,0)}${field('kit-signal-lq','Measured link quality (%)',100,0,100)}</div><div id="kit-signal-result" class="result-card" aria-live="polite"></div><p class="result-note">Headroom is arithmetic, not a guarantee of link reliability. Enter sensitivity from the radio for the selected mode.</p><a href="https://www.expresslrs.org/info/signal-health/">ExpressLRS signal-health reference ↗</a>`);
    panel('field-checklist','Bench checklist','Record your own verification. Entries do not certify an aircraft, radio link or deployment.',`<div id="kit-checks"></div><label for="kit-check-notes">Field notes</label><textarea class="kit-wide" id="kit-check-notes" rows="5" maxlength="10000" placeholder="Hardware, firmware, conditions, measurements and anything still unresolved"></textarea><p id="kit-check-progress" role="status"></p><div class="kit-chips"><button id="kit-check-export">Export checklist</button><button id="kit-check-reset">Start a new checklist</button></div>`);
    // Restore only explicit calculator inputs. Raw FC dumps and imported files are not persisted.
    const saved=read('inputs',{}), inputIds=['range-power','range-tx-gain','range-rx-gain','range-freq','range-sensitivity','range-margin','fres-dist','fres-freq','fres-point','dip-freq','dip-vf','dip-unit','harm-freq','kit-coordinate-input','kit-battery-mah','kit-battery-voltage','kit-battery-current','kit-battery-reserve','kit-power-mw','kit-power-dbm','kit-signal-rssi','kit-signal-sensitivity','kit-signal-lq'];
    for(const id of inputIds){const input=el(id);if(saved&&typeof saved[id]==='string')input.value=saved[id];input.addEventListener('input',()=>{const values={};for(const key of inputIds)values[key]=el(key).value;write('inputs',values);});}
    // One explicit handoff reuses frequency without overwriting radio/hardware presets.
    const reuse=document.createElement('button');reuse.id='kit-reuse-frequency';reuse.textContent='Use this frequency for clearance, antenna & harmonics';reuse.onclick=()=>{try{const f=toolNumber('range-freq');for(const id of ['fres-freq','dip-freq','harm-freq']){el(id).value=f;el(id).dispatchEvent(new Event('input'));}reuse.textContent='Frequency shared · '+f+' MHz';}catch(e){reuse.textContent=e.message;}};el('tool-range').append(reuse);
    setupCoordinates();setupBattery();setupSignal();setupChecklist();
    for(const id of inputIds)el(id).dispatchEvent(new Event('input'));
    window.dispatchEvent(new Event('fieldkit-ready'));
    if(validIDs.has(initialTool))showTool(initialTool);else fieldKitHome();
  });
  function setupCoordinates() {
    let point=null, source='Manual entry';
    function dms(v,axis){let total=Math.round(Math.abs(v)*3600*100)/100;const d=Math.floor(total/3600);total-=d*3600;const m=Math.floor(total/60);const s=total-m*60;return `${d}°${String(m).padStart(2,'0')}'${s.toFixed(2)}"${axis==='lat'?(v<0?'S':'N'):(v<0?'W':'E')}`;}
    function convert(){point=null;el('kit-coordinate-copy').disabled=true;el('kit-coordinate-map').disabled=true;const text=el('kit-coordinate-input').value.trim();try{
      const dd=text.match(/^([+-]?\d+(?:\.\d+)?)\s*[,\s]\s*([+-]?\d+(?:\.\d+)?)$/);
      let lat,lon,cell='';if(dd){lat=Number(dd[1]);lon=Number(dd[2]);}
      else if(/^\d{1,2}[C-HJ-NP-X][A-HJ-NP-Z]{2}(?:\d{2}){0,5}$/i.test(text.replace(/\s/g,''))){const compact=text.replace(/\s/g,'').toUpperCase();const p=window.mgrs.toPoint(compact);[lon,lat]=p;const digits=compact.match(/\d*$/)[0].length/2;cell=`MGRS input cell: ${Math.pow(10,5-digits).toLocaleString()} m per side. Output uses its center.`;}
      else {const match=text.match(/^(\d{1,3})°\s*(\d{1,2})'\s*(\d+(?:\.\d+)?)"?\s*([NS])\s*[,\s]\s*(\d{1,3})°\s*(\d{1,2})'\s*(\d+(?:\.\d+)?)"?\s*([EW])$/i);if(!match)throw Error('Enter valid DD, DMS or MGRS coordinates.');if(+match[2]>=60||+match[3]>=60||+match[6]>=60||+match[7]>=60)throw Error('DMS minutes and seconds must be below 60.');lat=(+match[1]+match[2]/60+match[3]/3600)*(match[4].toUpperCase()==='S'?-1:1);lon=(+match[5]+match[6]/60+match[7]/3600)*(match[8].toUpperCase()==='W'?-1:1);}
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Latitude must be ±90 and longitude ±180.');
      const grid=lat>=-80&&lat<=84?window.mgrs.forward([lon,lat],5):'Outside bundled UTM/MGRS coverage (80°S–84°N)';
      point={lat,lon,text:`WGS84\nDD: ${lat.toFixed(6)}, ${lon.toFixed(6)}\nDMS: ${dms(lat,'lat')} ${dms(lon,'lon')}\nMGRS: ${grid}\n${source}${cell?'\n'+cell:''}`};
      el('kit-coordinate-results').innerHTML=`<small>WGS84 · ${esc(source)}</small><p class="kit-coordinate-dd">${lat.toFixed(6)}, ${lon.toFixed(6)}</p><p>${esc(dms(lat,'lat'))}<br>${esc(dms(lon,'lon'))}</p><strong>${grid}</strong><p class="result-note">${cell||'Grid output has 1 m cells; that is formatting precision, not measured accuracy.'}</p>`;
      el('kit-coordinate-copy').disabled=false;el('kit-coordinate-map').disabled=false;
    }catch(e){el('kit-coordinate-results').textContent=e.message;}}
    el('kit-coordinate-input').addEventListener('input',()=>{source='Manual entry';el('kit-gps-status').textContent='';convert();});el('kit-coordinate-input').addEventListener('keydown',e=>{if(e.key==='Enter')convert();});el('kit-coordinate-convert').onclick=convert;
    el('kit-coordinate-copy').onclick=()=>{if(point)copyToolText(point.text,el('kit-coordinate-copy'));};
    el('kit-coordinate-map').onclick=()=>{if(point){flow='link';showTool('rf-terrain');el('rf-coord-input').value=point.lat+', '+point.lon;el('rf-coord-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}};
    el('kit-coordinate-gps').onclick=()=>{if(!window.Android?.getGpsLocation){el('kit-gps-status').textContent='Phone location requires the Android app. Manual coordinates work offline.';return;}try{const loc=JSON.parse(Android.getGpsLocation());if(loc.error){if(loc.error==='location_permission_not_granted'){Android.requestLocationPermission?.();el('kit-gps-status').textContent='Allow location, then tap again. Manual entry remains available.';}else el('kit-gps-status').textContent=loc.error==='stale_fix'?'Cached location is older than 60 seconds. Get a fresh device fix or enter coordinates.':'No recent device location is available. Enter coordinates manually.';return;}
      if(!Number.isFinite(loc.lat)||!Number.isFinite(loc.lon)||!Number.isFinite(loc.ageSeconds)||loc.ageSeconds>60||loc.ageSeconds<0)throw Error('Invalid or stale location');
      el('kit-coordinate-input').value=loc.lat+', '+loc.lon;el('kit-coordinate-input').dispatchEvent(new Event('input'));source=`Phone ${loc.provider||'location'} · ${loc.ageSeconds.toFixed(0)} s old · ${Number.isFinite(loc.accuracy)?'±'+loc.accuracy.toFixed(1)+' m':'accuracy unavailable'}${loc.mock?' · MOCK':''}`;convert();el('kit-gps-status').textContent=source;
    }catch(_){el('kit-gps-status').textContent='Could not read a recent phone location. Manual entry remains available.';}};convert();
  }
  function setupBattery(){const calc=()=>{try{const mah=toolNumber('kit-battery-mah'),volts=toolNumber('kit-battery-voltage'),amps=toolNumber('kit-battery-current'),reserve=toolNumber('kit-battery-reserve');const usable=mah*(1-reserve/100),mins=usable/1000/amps*60;el('kit-battery-result').innerHTML=`<small>ESTIMATED USABLE RUNTIME</small><p class="kit-big">${mins.toFixed(1)} <span>min</span></p><p>${usable.toFixed(0)} mAh usable · ${reserve}% held in reserve</p><p>${(mah/1000*volts).toFixed(1)} Wh nominal · ${(usable/1000*volts).toFixed(1)} Wh usable</p><p class="result-note">Based on ${amps} A average draw. Measure current under the intended operating conditions.</p>`;}catch(e){el('kit-battery-result').textContent=e.message;}};['mah','voltage','current','reserve'].forEach(k=>el('kit-battery-'+k).addEventListener('input',calc));calc();}
  function setupSignal(){const calc=()=>{try{const mw=toolNumber('kit-power-mw'),dbm=toolNumber('kit-power-dbm'),rssi=toolNumber('kit-signal-rssi'),sens=toolNumber('kit-signal-sensitivity'),lq=toolNumber('kit-signal-lq');const head=rssi-sens;el('kit-signal-result').innerHTML=`<p>${mw.toLocaleString()} mW = ${dbm.toFixed(2)} dBm</p><small>MANUAL READING · RSSI HEADROOM</small><p class="kit-big">${head.toFixed(1)} <span>dB</span></p><p>${rssi} dBm RSSI − (${sens} dBm sensitivity)</p><p>Link quality: ${lq}% of packets received</p><p class="result-note">${head<=0?'RSSI is at or below the entered sensitivity.':''}${lq<100?' Some packets are missing; investigate interference, antennas and mode settings.':''}</p>`;}catch(e){el('kit-signal-result').textContent=e.message;}};
    el('kit-power-mw').addEventListener('input',()=>{try{el('kit-power-dbm').value=(10*Math.log10(toolNumber('kit-power-mw'))).toFixed(4);}catch(_){}calc();});el('kit-power-dbm').addEventListener('input',()=>{try{el('kit-power-mw').value=Math.pow(10,toolNumber('kit-power-dbm')/10).toFixed(4);}catch(_){}calc();});['rssi','sensitivity','lq'].forEach(k=>el('kit-signal-'+k).addEventListener('input',calc));calc();}
  function setupChecklist(){const items=['Record hardware and firmware versions','Confirm intended antennas, band and channel','Confirm receiver protocol and UART assignments','Inspect power wiring and battery condition','Confirm telemetry source and location freshness','Record bench link-loss/reconnection behavior','Record video behavior and measured latency','List unresolved checks before field use'];let checks=read('checklist',{});if(!checks||Array.isArray(checks)||typeof checks!=='object')checks={};
    function progress(){const count=items.filter((_,i)=>el('kit-check-'+i).checked).length;el('kit-check-progress').textContent=`${count} of ${items.length} recorded · self-reported, not certification`;}
    for(const [i,label] of items.entries()){const row=document.createElement('label');row.className='kit-check-row';const box=document.createElement('input');box.type='checkbox';box.id='kit-check-'+i;box.checked=checks[i]===true;box.onchange=()=>{checks[i]=box.checked;write('checklist',checks);progress();};row.append(box,document.createTextNode(label));el('kit-checks').append(row);}
    const notes=read('notes','');el('kit-check-notes').value=typeof notes==='string'?notes:'';el('kit-check-notes').oninput=()=>write('notes',el('kit-check-notes').value);progress();
    el('kit-check-export').onclick=()=>saveToolReport('Prismo-Field-Kit-checklist.html',`<html><head><meta charset="utf-8"><title>Prismo Field Kit checklist</title></head><body><h1>Bench checklist</h1><p>${new Date().toISOString()} · self-reported verification</p><ul>${items.map((item,i)=>`<li>${el('kit-check-'+i).checked?'Recorded':'Not recorded'}: ${item}</li>`).join('')}</ul><h2>Notes</h2><pre>${esc(el('kit-check-notes').value)}</pre></body></html>`);
    el('kit-check-reset').onclick=()=>{if(!window.confirm('Clear this checklist and its notes? Export first if you need a record.'))return;checks={};write('checklist',checks);write('notes','');el('kit-check-notes').value='';items.forEach((_,i)=>el('kit-check-'+i).checked=false);progress();};
  }
}
