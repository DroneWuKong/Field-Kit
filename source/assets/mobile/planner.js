import * as maplibre from './vendor/maplibre-gl.mjs';
maplibre.setWorkerUrl(new URL('./vendor/maplibre-gl-worker.mjs',import.meta.url).href);
const protocol=new pmtiles.Protocol(); maplibre.addProtocol('pmtiles',protocol.tile);
const M=MobilePlanner, store=new M.Store({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)}), $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message=s=>{$('message').textContent=s;if($('sheet').open){$('panel-message').hidden=false;$('panel-message').textContent=s;}};
const sheet=$('sheet'), content=$('content');
window.fieldKitBack=()=>{if(sheet.open){sheet.close();return true;}if(placing){placing=null;$('done').hidden=true;return true;}return false;};
let placing=null, markers=[], undo=null, activeMap='street', mapRecords=[], phone=null, interaction=0, locateToken=0;
let view={center:[-98,38],zoom:3};
try {const v=JSON.parse(localStorage.getItem('fieldkit-mobile-view-v1'));if(v&&Array.isArray(v.center)&&v.center.length===2&&v.center.every(Number.isFinite)&&Math.abs(v.center[0])<=180&&Math.abs(v.center[1])<=85&&Number.isFinite(v.zoom))view=v;}catch{}
function worldStyle(){return {version:8,sources:{countries:{type:'geojson',data:new URL('./data/countries.geojson',import.meta.url).href},lakes:{type:'geojson',data:new URL('./data/lakes.geojson',import.meta.url).href}},layers:[
  {id:'ocean',type:'background',paint:{'background-color':'#163545'}},
  {id:'land',type:'fill',source:'countries',paint:{'fill-color':'#37594f','fill-outline-color':'#7c9a85'}},
  {id:'lakes',type:'fill',source:'lakes',paint:{'fill-color':'#163545'}}]};}
const map=new maplibre.Map({container:'map',style:worldStyle(),...view,attributionControl:false});
map.addControl(new maplibre.AttributionControl({compact:true,customAttribution:'Natural Earth · Public domain'}));
map.on('dragstart',()=>interaction++); map.on('zoomstart',e=>{if(e.originalEvent)interaction++;});
map.on('moveend',()=>{try{localStorage.setItem('fieldkit-mobile-view-v1',JSON.stringify({center:map.getCenter().toArray(),zoom:map.getZoom()}));}catch{}});
map.on('error',()=>message('Some map detail could not load. The world overview and saved route remain available.'));
function guard(fn){return async(...args)=>{try{return await fn(...args);}catch(e){message(e.message||'Could not complete the action.');}};}
function button(id,fn){$(id).onclick=guard(fn);}
function open(title,html){$('sheet-title').textContent=title;content.innerHTML=html;$('panel-message').hidden=true;if(!sheet.open)sheet.showModal();sheet.scrollTop=0;}
button('close',()=>sheet.close());
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=guard(()=>panels[b.dataset.panel]()));
function field(label,id,value,type='number',attrs=''){return `<label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}" ${type==='number'?'step="any"':''} ${attrs}>`;}
function num(id,nullable=false){const s=$(id).value.trim();if(!s){if(nullable)return null;throw Error('Enter '+$(id).previousElementSibling.textContent+'.');}const n=Number(s);if(!Number.isFinite(n))throw Error('Enter a valid number.');return n;}
function text(id){const s=$(id).value.trim();if(!s)throw Error('Enter a name.');return s;}
function editable(){const p=store.current()?.project;if(!p)throw Error('Create or import a route first.');if(p.source?.readonly)throw Error('This imported mission is read-only.');return p;}
function changed(){interaction++;drawRoute();message('Saved on this device. Draft plan — analyze terrain and coverage in Horizon.');}
function saveFile(name,data,mime='application/json'){
  const safe=name.replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,90);
  const body=typeof data==='string'?data:JSON.stringify(data,null,2);
  if(new TextEncoder().encode(body).length>5000000)throw Error('Export exceeds 5 MB. Export routes individually.');
  if(window.Android?.saveText){Android.saveText(safe,mime,body);message('Choose where to save the file in Android.');}
  else{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([body],{type:mime}));a.href=url;a.download=safe;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
function recovery(){open('Saved data needs attention',`<p class="notice">${esc(store.error)} Your stored data has been retained. Export it before attempting repair.</p><button id="raw">Export saved data</button><p>Existing Tools records are stored separately.</p>`);button('raw',()=>saveFile('Field-Kit-saved-data.txt',store.raw??'Storage could not be read.','text/plain'));}
function drawRoute(force=false){
  markers.forEach(m=>m.remove());markers=[];const p=store.current()?.project;
  function pin(coords,label,kind,action){const el=document.createElement('button');el.className='pin '+kind;el.textContent=label;el.setAttribute('aria-label',kind==='home'?'Mission home':kind==='station'?'Ground antenna':kind==='phone'?'Phone location':'Waypoint '+label);if(action)el.onclick=e=>{e.stopPropagation();guard(action)();};const marker=new maplibre.Marker({element:el}).setLngLat(coords).addTo(map);markers.push(marker);}
  if(p){pin([p.home.lon,p.home.lat],'H','home',()=>pointEditor('home'));pin([p.station.lon,p.station.lat],'A','station',()=>pointEditor('station'));
    p.waypoints.forEach((w,i)=>pin([w.lon,w.lat],String(i+1),'',()=>pointEditor(w.id)));}
  if(phone)pin([phone.lon,phone.lat],'','phone');
  if(!force&&!map.isStyleLoaded())return;
  const coords=p?[[p.home.lon,p.home.lat],...p.waypoints.map(w=>[w.lon,w.lat])]:[];
  const data={type:'FeatureCollection',features:coords.length>1?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}]:[]};
  if(map.getSource('route'))map.getSource('route').setData(data);
  else{map.addSource('route',{type:'geojson',data});map.addLayer({id:'route-line',type:'line',source:'route',paint:{'line-color':'#ffe38b','line-width':3}});}
}
map.on('style.load',()=>drawRoute(true));
function fitRoute(){const p=store.current()?.project;if(!p)throw Error('Create or import a route first.');const points=[p.home,p.station,...p.waypoints];const b=new maplibre.LngLatBounds();points.forEach(w=>b.extend([w.lon,w.lat]));map.fitBounds(b,{padding:70,maxZoom:16,duration:300});}
button('fit',fitRoute);
function place(mode){editable();interaction++;placing=mode;sheet.close();$('done').hidden=false;message(mode==='waypoint'?'Tap the map to add route points. Choose Done when finished.':`Tap the map to place ${mode==='home'?'mission home':'the ground antenna'}.`);}
button('done',()=>{placing=null;$('done').hidden=true;message('Placement finished. Open Route to edit coordinates or altitude.');});
map.on('click',guard(e=>{if(!placing)return;const lat=Math.max(-85,Math.min(85,e.lngLat.lat)),lon=((e.lngLat.lng+540)%360)-180;
  store.edit(p=>{if(placing==='waypoint')p.waypoints.push({id:M.id(),lat,lon,altitude_m:50,altitude_mode:'home',command:16,params:[0,0,0,null],source_index:null});else Object.assign(p[placing],{lat,lon});});
  changed();if(placing!=='waypoint'){placing=null;$('done').hidden=true;}
}));
function routePanel(){
  if(store.error)return recovery();const p=store.current()?.project;
  open('Route',`<label for="route-select">Saved route</label><select id="route-select"><option value="">Choose a route</option>${store.state.routes.map(r=>`<option value="${esc(r.project.id)}" ${r.project.id===p?.id?'selected':''}>${esc(r.project.name)}</option>`).join('')}</select>
    <div class="row"><button id="new-route" class="primary">New route</button><button id="import">Import JSON</button></div>
    ${p?`<p class="muted">${p.source?.readonly?'Read-only imported mission':'Draft plan'} · ${p.waypoints.length} points · ${p.terrain_ids.length} terrain references</p>
    ${field('Route name','route-name',p.name,'text','maxlength="200"')}<div class="row"><button id="rename">Save name</button><button id="export">Export plan</button></div>
    <div class="row"><button id="home">Set home on map</button><button id="antenna">Set antenna on map</button></div><div class="row"><button id="edit-home">Home coordinates</button><button id="edit-antenna">Antenna / height</button></div>
    <button id="add-points" class="primary">Add points on map</button>
    ${p.waypoints.map((w,i)=>`<button class="waypoint" data-waypoint="${esc(w.id)}">${i+1}. ${w.lat.toFixed(5)}, ${w.lon.toFixed(5)} · ${w.altitude_m} m ${esc(w.altitude_mode.toUpperCase())}</button>`).join('')}
    <p class="muted">Home, antenna and phone location are separate. Export to Horizon for terrain-aware analysis; this phone stores planning assumptions.</p><button id="delete-route" class="danger">Delete this route</button>`:'<p>Create a route at the map center, or import a Prismo plan from Horizon.</p>'}`);
  $('route-select').onchange=guard(()=>{store.select($('route-select').value||null);undo=null;changed();routePanel();});
  button('new-route',()=>{const c=map.getCenter();store.add(M.newPlan('Route '+(store.state.routes.length+1),Math.max(-85,Math.min(85,c.lat)),((c.lng+540)%360)-180));undo=null;changed();routePanel();});
  button('import',()=>$('import-plan').click());
  if(!p)return;
  button('rename',()=>{store.edit(p=>p.name=text('route-name'));changed();routePanel();});
  button('export',()=>saveFile(p.name+'.json',store.current()));
  button('home',()=>place('home'));button('antenna',()=>place('station'));button('add-points',()=>place('waypoint'));
  button('edit-home',()=>pointEditor('home'));button('edit-antenna',()=>pointEditor('station'));
  content.querySelectorAll('[data-waypoint]').forEach(b=>b.onclick=guard(()=>pointEditor(b.dataset.waypoint)));
  button('delete-route',()=>{open('Delete route?',`<p>Delete ${esc(p.name)} from this device? Export it first if you need a copy.</p><button id="confirm-delete" class="danger">Delete route</button>`);button('confirm-delete',()=>{store.remove();undo=null;changed();routePanel();});});
  if(p.source?.readonly)['rename','home','antenna','add-points'].forEach(id=>$(id).disabled=true);
}
function pointEditor(kind){const p=store.current()?.project;if(!p)return;const waypoint=!['home','station'].includes(kind),point=waypoint?p.waypoints.find(w=>w.id===kind):p[kind];if(!point)return;
  open(waypoint?'Edit waypoint':kind==='home'?'Mission home':'Ground antenna',`<div class="grid"><div>${field('Latitude','lat',point.lat)}</div><div>${field('Longitude','lon',point.lon)}</div></div>
    ${kind==='station'?field('Antenna height (m)','height',point.height_m):field(kind==='home'?'Home elevation AMSL (m; blank if unknown)':'Altitude (m)','altitude',point.altitude_m)}
    ${waypoint?`<label for="alt-mode">Altitude reference</label><select id="alt-mode"><option value="home">Above home</option><option value="agl">Above terrain (AGL)</option><option value="amsl">Sea level (AMSL)</option></select>`:''}
    <p class="muted">${p.source?.readonly?'This imported mission is read-only.':'Coordinates and altitude are saved as planning inputs.'}</p><div class="row"><button id="save-point" class="primary">Save point</button>${waypoint?'<button id="remove-point">Remove point</button>':''}</div>`);
  if(waypoint)$('alt-mode').value=point.altitude_mode;
  button('save-point',()=>{const lat=num('lat'),lon=num('lon');store.edit(p=>{const w=waypoint?p.waypoints.find(w=>w.id===kind):p[kind];Object.assign(w,{lat,lon});if(kind==='station')w.height_m=num('height');else w.altitude_m=num('altitude',kind==='home');if(waypoint)w.altitude_mode=$('alt-mode').value;});changed();routePanel();});
  if(waypoint)button('remove-point',()=>{store.edit(p=>p.waypoints=p.waypoints.filter(w=>w.id!==kind));changed();routePanel();});
  $('save-point').disabled=!!p.source?.readonly;if(waypoint)$('remove-point').disabled=!!p.source?.readonly;
}
function setupFromCurrent(name){const p=editable();return {equipment:{schema:'prismo.equipment.v1',id:M.id(),revision:1,name,serial:'',origin:'field-kit',radios:M.copy(p.radios),margin_db:p.settings.margin_db,source_profile:null},selected_control:p.settings.selected_control,require_video:p.settings.require_video,required_telemetry:p.settings.required_telemetry.slice()};}
function equipmentPanel(){
  if(store.error)return recovery();const p=store.current()?.project;
  open('Equipment',`${p?`<p class="muted">${esc(p.name)} · Planning assumptions, not measured hardware</p>${p.radios.map((r,i)=>`<button class="waypoint" data-radio="${i}">${esc(r.name)} · ${r.frequency_mhz} MHz · ${r.tx_dbm??'unknown'} dBm</button>`).join('')}
    <button id="add-radio">Add radio link</button>
    <label for="control">Required control link</label><select id="control">${p.radios.filter(r=>r.role==='control').map(r=>`<option value="${esc(r.id)}" ${r.id===p.settings.selected_control?'selected':''}>${esc(r.name)}</option>`).join('')}</select>
    ${field('Planning margin (dB)','margin',p.settings.margin_db)}<label><input id="require-video" type="checkbox" ${p.settings.require_video?'checked':''}> Require video</label>
    <button id="save-settings">Save settings</button>${field('Reusable setup name','setup-name',p.name+' equipment','text','maxlength="200"')}
    <div class="row"><button id="save-setup" class="primary">Save reusable setup</button><button id="export-equipment">Export equipment</button></div>
    ${undo?'<button id="undo">Undo equipment change</button>':''}`:'<p>Create a route to edit equipment.</p>'}
    <h2>Saved setups</h2><button id="import-equipment">Import JSON</button>${store.state.setups.map((s,i)=>`<div class="card"><h2>${esc(s.equipment.name)}</h2><p>${s.equipment.radios.length} links · ${s.equipment.margin_db} dB margin</p><div class="row"><button data-setup="${i}">Review & apply</button><button data-remove-setup="${i}">Remove setup</button></div></div>`).join('')||'<p>No reusable setups yet.</p>'}`);
  button('import-equipment',()=>$('import-plan').click());
  content.querySelectorAll('[data-setup]').forEach(b=>b.onclick=guard(()=>reviewSetup(store.state.setups[+b.dataset.setup],false)));
  content.querySelectorAll('[data-remove-setup]').forEach(b=>b.onclick=guard(()=>{const i=+b.dataset.removeSetup;open('Remove saved setup?',`<p>Routes already using this equipment will be retained.</p><button id="remove-setup">Remove setup</button>`);button('remove-setup',()=>{store.commit(s=>s.setups.splice(i,1));equipmentPanel();});}));
  if(!p)return;
  content.querySelectorAll('[data-radio]').forEach(b=>b.onclick=guard(()=>radioEditor(+b.dataset.radio)));
  button('add-radio',()=>{store.edit(p=>p.radios.push(M.radio('telemetry',915)));changed();equipmentPanel();});
  button('save-settings',()=>{store.edit(p=>{p.settings.selected_control=$('control').value;p.settings.margin_db=num('margin');p.settings.require_video=$('require-video').checked;});changed();});
  button('save-setup',()=>{const setup=setupFromCurrent(text('setup-name'));store.commit(s=>s.setups.push(setup));message('Reusable setup saved.');equipmentPanel();});
  button('export-equipment',()=>{const setup=setupFromCurrent(text('setup-name'));saveFile(setup.equipment.name+'.json',setup.equipment);});
  if(undo)button('undo',()=>{store.undo(undo);undo=null;changed();equipmentPanel();});
}
function radioEditor(index){const p=editable(),r=p.radios[index];
  open('Radio link',`${field('Radio name','radio-name',r.name,'text','maxlength="200"')}<div class="grid"><div>${field('Frequency (MHz)','frequency',r.frequency_mhz)}</div><div><label for="role">Role</label><select id="role"><option>control</option><option>video</option><option>telemetry</option></select></div>
    <div>${field('Transmit power (dBm; blank = unknown)','power',r.tx_dbm)}</div><div>${field('Sensitivity (dBm; blank = unknown)','sensitivity',r.sensitivity_dbm)}</div>
    <div>${field('TX antenna gain (dBi)','tx-gain',r.tx_gain_dbi)}</div><div>${field('RX antenna gain (dBi)','rx-gain',r.rx_gain_dbi)}</div>
    <div>${field('Cable loss (dB)','cable',r.cable_loss_db)}</div><div>${field('Additional loss (dB)','loss',r.additional_loss_db)}</div></div>
    <label for="direction">Direction</label><select id="direction"><option>uplink</option><option>downlink</option></select><label for="polarization">Polarization</label><select id="polarization"><option>vertical</option><option>horizontal</option></select>
    <p class="muted">Edited values are marked assumed. Confirm specifications before analysis.</p><div class="row"><button id="save-radio" class="primary">Save radio</button><button id="delete-radio">Remove radio</button></div>`);
  $('role').value=r.role;$('direction').value=r.direction;$('polarization').value=r.polarization;
  button('save-radio',()=>{store.edit(p=>Object.assign(p.radios[index],{name:text('radio-name'),frequency_mhz:num('frequency'),role:$('role').value,direction:$('direction').value,polarization:$('polarization').value,tx_dbm:num('power',true),sensitivity_dbm:num('sensitivity',true),tx_gain_dbi:num('tx-gain'),rx_gain_dbi:num('rx-gain'),cable_loss_db:num('cable'),additional_loss_db:num('loss'),provenance:'assumed'}));changed();equipmentPanel();});
  button('delete-radio',()=>{store.edit(p=>p.radios.splice(index,1));changed();equipmentPanel();});
}
function reviewSetup(setup,imported){const e=PrismoExchange.equipment(setup.equipment),controls=e.radios.filter(r=>r.role==='control');
  open('Review equipment',`<h2>${esc(e.name)}</h2><p>Replace the selected route’s radio assumptions and margin. Home, waypoints and terrain references stay with the route.</p>${e.radios.map(r=>`<div class="card"><strong>${esc(r.name)}</strong><p>${r.frequency_mhz} MHz · ${esc(r.role)} · ${esc(r.direction)}<br>Power ${r.tx_dbm??'unknown'} dBm · sensitivity ${r.sensitivity_dbm??'unknown'} dBm<br>Gains ${r.tx_gain_dbi}/${r.rx_gain_dbi} dBi · losses ${r.cable_loss_db+r.additional_loss_db} dB</p></div>`).join('')}
    <p>Margin: ${e.margin_db} dB. Imported claims are not measurements.</p><label for="review-control">Required control link</label><select id="review-control">${controls.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select><div class="row"><button id="apply-setup" class="primary">Apply to route</button>${imported?'<button id="keep-setup">Save reusable setup</button>':''}</div>`);
  if(setup.selected_control)$('review-control').value=setup.selected_control;
  const reviewed=()=>({...M.copy(setup),equipment:e,selected_control:$('review-control').value});
  button('apply-setup',()=>{undo=store.apply(reviewed());changed();equipmentPanel();});
  if(imported)button('keep-setup',()=>{store.commit(s=>s.setups.push(reviewed()));message('Imported setup saved.');equipmentPanel();});
  if(!controls.length){$('apply-setup').disabled=true;if(imported)$('keep-setup').disabled=true;message('This equipment file has no control link. Add one in Horizon before applying.');}
}
$('import-plan').onchange=guard(async()=>{const file=$('import-plan').files[0];$('import-plan').value='';if(!file)return;if(file.size>5000000)throw Error('Choose a JSON file up to 5 MB.');const value=PrismoExchange.parse(await file.text());
  if(value.schema==='prismo.equipment.v1')return reviewSetup({equipment:value},true);
  M.checkedPlan(value);open('Import route',`<h2>${esc(value.project.name)}</h2><p>${value.project.waypoints.length} waypoints · ${value.project.source?.readonly?'read-only imported mission':'editable draft'}. Source commands and terrain references will be retained.</p><button id="confirm-import" class="primary">Save imported route</button>`);
  button('confirm-import',()=>{store.add(value);undo=null;changed();fitRoute();routePanel();});
});
// Each archive is a Blob in IndexedDB; commit success is transaction completion.
let dbPromise;
function database(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('fieldkit-offline-maps-v1',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('maps'))req.result.createObjectStore('maps',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Close other Field Kit windows and retry offline maps.'));});return dbPromise;}
async function dbOp(mode,fn){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('maps',mode),request=fn(tx.objectStore('maps'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Map storage was interrupted.'));});}
async function mapsRefresh(){mapRecords=await dbOp('readonly',s=>s.getAll());}
function offlinePanel(){open('Offline maps',`<p>World overview is bundled. Import a regional PMTiles archive for offline detail (up to 150 MB). Street tiles load only for the current view.</p><label for="map-source">Map source</label><select id="map-source"><option value="street">Online street map</option><option value="world">Offline world overview</option>${mapRecords.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select><div class="row"><button id="import-map-button" class="primary">Import offline map</button><button id="refresh-maps">Refresh maps</button></div>
    ${mapRecords.map((r,i)=>`<div class="card"><h2>${esc(r.name)}</h2><p>${(r.blob.size/1048576).toFixed(1)} MB · zoom ${r.header.minZoom}–${r.header.maxZoom}<br>${r.header.minLat.toFixed(3)}, ${r.header.minLon.toFixed(3)} to ${r.header.maxLat.toFixed(3)}, ${r.header.maxLon.toFixed(3)}</p><p class="muted">SHA-256 identifies these bytes; it does not authenticate the source.</p><pre>${esc(r.sha256)}</pre><div class="row"><button data-area="${i}">Show area</button><button data-remove-map="${i}">Remove map</button></div></div>`).join('')}
    <p class="muted">Compatible with Protomaps vector basemaps and PNG, JPEG or WebP archives. Keep your original files and verify coverage before leaving connectivity. Basemaps do not provide terrain elevations.</p>`);
  $('map-source').value=activeMap;$('map-source').onchange=guard(async()=>{await selectMap($('map-source').value);message('Map source selected.');});
  button('import-map-button',()=>$('import-map').click());button('refresh-maps',async()=>{await mapsRefresh();offlinePanel();});
  content.querySelectorAll('[data-area]').forEach(b=>b.onclick=guard(async()=>{const r=mapRecords[+b.dataset.area];await selectMap(r.id);interaction++;map.fitBounds([[r.header.minLon,r.header.minLat],[r.header.maxLon,r.header.maxLat]],{padding:40,maxZoom:r.header.maxZoom});sheet.close();}));
  content.querySelectorAll('[data-remove-map]').forEach(b=>b.onclick=guard(()=>{const r=mapRecords[+b.dataset.removeMap];open('Remove offline map?',`<p>Remove ${esc(r.name)} from this device? Keep the original archive for reimport.</p><button id="confirm-remove-map">Remove map</button>`);button('confirm-remove-map',async()=>{await dbOp('readwrite',s=>s.delete(r.id));if(activeMap===r.id)await selectMap('world');await mapsRefresh();offlinePanel();});}));
}
async function selectMap(id){const style=worldStyle();
  if(id==='street'){style.sources.street={type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'};style.layers.push({id:'street',type:'raster',source:'street'});}
  else if(id!=='world'){
    const r=mapRecords.find(r=>r.id===id);if(!r)throw Error('Offline map was not found.');const archive=new pmtiles.PMTiles(new pmtiles.FileSource(new File([r.blob],r.id+'.pmtiles')));protocol.add(archive);
    const common={url:'pmtiles://'+r.id+'.pmtiles',minzoom:r.header.minZoom,maxzoom:r.header.maxZoom,bounds:[r.header.minLon,r.header.minLat,r.header.maxLon,r.header.maxLat]};
    if(r.header.tileType===1){style.sources.region={type:'vector',...common};
      for(const [layer,color,type] of [['earth','#53664c','fill'],['landuse','#607452','fill'],['water','#254f66','fill'],['buildings','#8a9680','fill'],['roads','#e3c99a','line'],['boundaries','#aab8a2','line']])style.layers.push({id:'region-'+layer,type,source:'region','source-layer':layer,paint:type==='fill'?{'fill-color':color}:{'line-color':color,'line-width':layer==='roads'?2:1}});
      style.glyphs=new URL('./data/fonts/{fontstack}/{range}.pbf',import.meta.url).href.replace(/%7B/g,'{').replace(/%7D/g,'}');
      style.layers.push({id:'places',type:'symbol',source:'region','source-layer':'places',layout:{'text-field':['coalesce',['get','name:en'],['get','name'],''],'text-font':['Noto Sans Regular'],'text-size':13},paint:{'text-color':'#ffffff','text-halo-color':'#263e37','text-halo-width':1}});
    } else{style.sources.region={type:'raster',...common,tileSize:256};style.layers.push({id:'region',type:'raster',source:'region'});}
  }
  activeMap=id;map.setStyle(style);try{localStorage.setItem('fieldkit-mobile-map-source-v1',id);}catch{message('Map source changed, but could not be remembered.');}
}
$('import-map').onchange=guard(async()=>{const f=$('import-map').files[0];$('import-map').value='';if(!f)return;if(f.size>150*1024*1024||f.size<127)throw Error('Choose a PMTiles archive up to 150 MB.');
  message('Checking offline map…');const archive=new pmtiles.PMTiles(new pmtiles.FileSource(f)),header=await archive.getHeader();
  if(![1,2,3,4].includes(header.tileType))throw Error('Use vector, PNG, JPEG or WebP PMTiles.');
  if(![header.minLon,header.minLat,header.maxLon,header.maxLat,header.minZoom,header.maxZoom].every(Number.isFinite)||header.minLon>=header.maxLon||header.minLat>=header.maxLat||header.minLon< -180||header.maxLon>180||header.minLat< -90||header.maxLat>90||header.maxZoom>24)throw Error('Archive bounds or zoom levels are invalid.');
  const meta=await archive.getMetadata();if(header.tileType===1&&!meta.vector_layers?.some(l=>['earth','water','roads'].includes(l.id)))throw Error('Choose a Protomaps-compatible vector basemap.');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
  const record={id:M.id(),name:f.name,header,sha256,blob:f};await dbOp('readwrite',s=>s.put(record));await mapsRefresh();message('Offline map saved on this device. Choose Show area to check it.');offlinePanel();
});
function showLocation(fix,atInteraction){if(!Number.isFinite(fix.lat)||!Number.isFinite(fix.lon))return;phone=fix;drawRoute();if(interaction===atInteraction)map.easeTo({center:[fix.lon,Math.max(-85,Math.min(85,fix.lat))],zoom:Math.max(map.getZoom(),14)});message(`Phone location${Number.isFinite(fix.accuracy)?' · ±'+Math.round(fix.accuracy)+' m':''}. Mission home and antenna are unchanged.`);}
async function locate(){const token=++locateToken,atInteraction=interaction;message('Requesting phone location…');
  if(window.Android?.requestFreshPhoneLocation){let response=JSON.parse(Android.requestFreshPhoneLocation());if(response.error==='location_permission_not_granted')Android.requestLocationPermission();
    let requested=response.error!=='location_permission_not_granted';const end=Date.now()+30000;
    while(Date.now()<end&&token===locateToken){await new Promise(r=>setTimeout(r,500));response=JSON.parse(Android.getCurrentPhoneLocation());if(response.error!=='location_permission_not_granted'&&!requested){Android.requestFreshPhoneLocation();requested=true;continue;}if(Number.isFinite(response.lat)){showLocation(response,atInteraction);return;}}
    if(token===locateToken)message('Location unavailable or permission denied. You can still plan manually.');
  }else if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>{if(token===locateToken)showLocation({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy},atInteraction);},()=>message('Location unavailable or permission denied. You can still plan manually.'),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  else message('Location unavailable. Plan manually on the map.');
}
button('locate',locate);
const panels={route:routePanel,equipment:equipmentPanel,offline:offlinePanel};
map.once('load',guard(async()=>{drawRoute();try{await mapsRefresh();}catch{message('Offline map storage could not be opened.');}
  let selected='street';try{selected=localStorage.getItem('fieldkit-mobile-map-source-v1')||'street';}catch{}
  await selectMap(mapRecords.some(r=>r.id===selected)||['world','street'].includes(selected)?selected:'world');
  if(store.error)recovery();else {message('Choose Route to begin. Changes stay on this device.');locate();}
}));
