'use strict';
if (new URLSearchParams(location.search).get('mode') === 'standalone') {
  window.addEventListener('fieldkit-ready', () => {
    const K = FieldKit, E = PrismoExchange, {el, esc} = K;
    // New keys only. Legacy equipment, diagnostics, bench notes and practice runs stay intact.
    const key = 'fieldkit-planning-records-v1';
    let records, storageUnreadable = false;
    try { records = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(records)) throw Error(); }
    catch (_) { records = []; storageUnreadable = true; }
    const valid = r => { try { E.parse(JSON.stringify(r.value)); return typeof r.id === 'string'; } catch (_) { return false; } };
    const dialog = document.createElement('dialog'); dialog.id = 'kit-plan'; dialog.className = 'kit-planning-dialog';
    dialog.setAttribute('aria-labelledby', 'kit-plan-title');
    dialog.innerHTML = `<div class="kit-dialog-heading"><div><span class="app-eyebrow">PRISMO FIELD KIT · HORIZON</span><h2 id="kit-plan-title">Plan your next flight</h2></div><button id="kit-plan-close" class="icon-button" aria-label="Close planning">×</button></div>
      <p>Use Horizon on your computer for terrain-aware route and radio analysis. Bring your equipment along, then keep the plan here for the field.</p>
      <section class="kit-plan-card"><h3>1. Take your equipment</h3><p id="kit-plan-equipment"></p><div class="input-grid"><div class="input-group"><label for="kit-plan-role">Link role</label><select id="kit-plan-role" class="tool-input"><option value="">Choose a role</option><option value="control">Control</option><option value="video">Video</option><option value="telemetry">Telemetry</option></select></div><div class="input-group"><label for="kit-plan-direction">Link direction</label><select id="kit-plan-direction" class="tool-input"><option value="">Choose a direction</option><option value="uplink">Ground → aircraft</option><option value="downlink">Aircraft → ground</option></select></div></div><div class="kit-chips"><button id="kit-plan-copy-equipment">Copy equipment JSON</button><button id="kit-plan-download-equipment">Download equipment</button><button id="kit-plan-manage">Choose equipment</button></div><p class="result-note">Saved inputs are assumptions. Power is converted from mW to dBm; the original profile and revision travel with the file.</p></section>
      <section class="kit-plan-card"><h3>2. Plan in Horizon</h3><p>On the computer running Horizon, open <code>http://127.0.0.1:8765</code>. Choose Radios → Import equipment. When ready, use Export plan to Field Kit.</p><p class="result-note">That address belongs to the computer. This phone exchanges files; it does not connect to the desktop service or run its terrain engine.</p></section>
      <section class="kit-plan-card"><h3>3. Bring a plan back</h3><label for="kit-plan-file">Import a plan or equipment file</label><input id="kit-plan-file" type="file" accept=".json,application/json"><details><summary>Paste JSON instead</summary><label for="kit-plan-json">Plan or equipment JSON</label><textarea id="kit-plan-json" rows="5" class="kit-wide" maxlength="5000000"></textarea><button id="kit-plan-import">Review import</button></details><section id="kit-plan-preview" hidden></section></section>
      <p id="kit-plan-status" role="status"></p><div class="kit-chips"><button id="kit-plan-records">View records</button><button id="kit-plan-quick">Quick link tools</button></div>`;
    document.body.append(dialog);
    el('kit-plan-close').onclick = () => dialog.close();
    const status = text => { el('kit-plan-status').textContent = text; };
    const update = () => {
      const p = K.workspace.getProfile();
      el('kit-plan-equipment').textContent = p ? `${p.name} · ${p.serial || 'No serial'} · revision ${p.revision}${K.workspace.isDirty() ? ' · exports saved inputs; calculator edits are not saved' : ''}` : 'Choose or save an equipment profile first.';
      el('kit-plan-copy-equipment').disabled = el('kit-plan-download-equipment').disabled = !p;
    };
    const open = () => { update(); dialog.showModal(); };
    el('kit-nav-home').querySelector('span').textContent = 'Plan';
    el('kit-nav-home').querySelector('i').className = 'ph ph-map-trifold';
    el('kit-nav-home').onclick = open;
    el('kit-nav-equipment').querySelector('span').textContent = 'Set up';
    el('kit-nav-equipment').onclick = () => K.navigate('configuration-deploy');
    el('kit-nav-tools').querySelector('span').textContent = 'Check';
    el('kit-nav-tools').querySelector('i').className = 'ph ph-plugs-connected';
    el('kit-nav-tools').onclick = () => K.navigate('connection-doctor');
    el('kit-nav-checks').querySelector('span').textContent = 'Records';
    // Arrange the four task entries in workflow order.
    el('kit-bottom-nav').append(el('kit-nav-home'), el('kit-nav-equipment'), el('kit-nav-tools'), el('kit-nav-checks'));
    const navState = () => {
      const active = K.getView().active;
      for (const [id, match] of [['home', dialog.open], ['equipment', active === 'configuration-deploy'], ['tools', active === 'connection-doctor'], ['checks', el('kit-saved-checks').open]])
        el('kit-nav-' + id).setAttribute('aria-current', match ? 'page' : 'false');
    };
    window.addEventListener('fieldkit-view', navState);
    dialog.addEventListener('close', navState);
    el('kit-nav-home').onclick = () => { open(); navState(); };
    window.addEventListener('fieldkit-equipment', update);
    document.querySelector('[data-flow=link]').onclick = open;
    document.querySelector('[data-flow=link] strong').textContent = 'Plan a flight';
    document.querySelector('[data-flow=link] span span').textContent = 'Equipment, terrain planning and field records';
    el('kit-plan-manage').onclick = () => { dialog.close(); K.navigate('equipment-profiles'); };
    el('kit-plan-quick').onclick = () => { dialog.close(); K.navigate('range', 'link'); };
    const oldBack = window.fieldKitBack;
    window.fieldKitBack = () => { if (dialog.open) { dialog.close(); return true; } return oldBack(); };
    const filename = v => (v.name || v.project?.name || 'Field-Kit').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0,80) + (v.schema === 'prismo.plan.v1' ? '.prismo-plan.json' : '.equipment.json');
    const download = value => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'}));
      const a = document.createElement('a'); a.href = url; a.download = filename(value); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const equipment = () => E.fromLegacy(FieldKitModels.profile(K.workspace.getProfile()), el('kit-plan-role').value, el('kit-plan-direction').value);
    el('kit-plan-copy-equipment').onclick = () => { try { copyToolText(JSON.stringify(equipment(), null, 2), el('kit-plan-copy-equipment')); status('Equipment JSON prepared from the saved profile.'); } catch(e) { status(e.message); } };
    el('kit-plan-download-equipment').hidden = !!window.Android;
    el('kit-plan-download-equipment').onclick = () => { try { download(equipment()); status('Equipment exported. Import it in Horizon’s Radios tab.'); } catch(e) { status(e.message); } };
    let pending = null;
    function review(text) {
      // Clear a previous valid preview before parsing, so a rejected file cannot save the old one.
      pending = null; el('kit-plan-preview').hidden = true; el('kit-plan-preview').replaceChildren();
      try {
        pending = E.parse(text);
        const p = pending.project;
        el('kit-plan-preview').innerHTML = `<h3>${esc(p ? p.name : pending.name)}</h3><p>${p ? `${p.waypoints.length} waypoints · predicted plan · terrain is not included` : `${pending.radios.length} radio links · revision ${pending.revision}`}</p><p>Imported file; source claims have not been verified on this device.</p><button id="kit-plan-save">Save copy to records</button>`;
        el('kit-plan-preview').hidden = false;
        el('kit-plan-save').onclick = () => {
          try {
            if (!pending) return;
            if (storageUnreadable) throw Error('Saved planning storage is unreadable and has been retained. Export it before repairing.');
            if (records.length >= 50) throw Error('Planning record limit reached (50). Export and remove an old planning record first.');
            const next = [...records, {id: crypto.randomUUID(), importedAt: new Date().toISOString(), value: pending}];
            // Commit storage before changing memory or reporting success. No silent eviction on quota errors.
            localStorage.setItem(key, JSON.stringify(next)); records = next;
            pending = null; el('kit-plan-preview').hidden = true; el('kit-plan-json').value = ''; renderRecords(); status('Saved to Records. Existing equipment and checks are unchanged.');
          } catch(e) { status('Could not save: ' + e.message); }
        };
        status('Review the file before saving.');
      } catch(e) { status('Import rejected: ' + e.message); }
    }
    el('kit-plan-import').onclick = () => { fileEpoch++; review(el('kit-plan-json').value); };
    let fileEpoch = 0;
    el('kit-plan-file').onchange = async e => {
      const ticket = ++fileEpoch, f = e.target.files[0]; e.target.value = ''; if (!f) return;
      pending = null; el('kit-plan-preview').hidden = true;
      try { if (f.size > 5000000) throw Error('File exceeds 5 MB.'); const text = await f.text(); if (ticket === fileEpoch) review(text); }
      catch(e) { status(e.message); }
    };
    const checks = el('kit-saved-checks'); el('kit-saved-title').textContent = 'Records';
    checks.querySelector('.kit-dialog-heading p').textContent = 'Plans, equipment files, diagnostic snapshots and practice runs.';
    const planningRecords = document.createElement('section'); planningRecords.id = 'kit-planning-records'; checks.append(planningRecords);
    const practice = document.createElement('button'); practice.textContent = 'Open configuration practice runs'; practice.onclick = () => { checks.close(); K.navigate('configuration-deploy'); }; checks.append(practice);
    function renderRecords() {
      planningRecords.replaceChildren(); const title = document.createElement('h3'); title.textContent = 'Plans & shared equipment'; planningRecords.append(title);
      if (storageUnreadable) { const p = document.createElement('p'); p.textContent = 'Planning storage could not be read. It has been retained; imports are disabled until repaired.'; planningRecords.append(p); }
      if (!records.length && !storageUnreadable) { const p = document.createElement('p'); p.textContent = 'Import a plan or equipment file from Plan to keep it here.'; planningRecords.append(p); }
      for (const r of [...records].reverse()) {
        const card = document.createElement('article'); card.className = 'kit-plan-card';
        if (!valid(r)) { card.textContent = 'Unreadable saved planning record retained. Export storage before repairing it.'; planningRecords.append(card); continue; }
        const p = r.value.project, h = document.createElement('h3'), text = document.createElement('p'); h.textContent = p?.name || r.value.name;
        text.textContent = (p ? 'Predicted plan · ' + p.waypoints.length + ' waypoints' : 'Equipment assumptions · revision ' + r.value.revision) + ' · imported ' + r.importedAt;
        card.append(h, text);
        if (p) { const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre'); summary.textContent = 'Route & radio assumptions'; pre.textContent = p.waypoints.map((w,i) => `${i+1}. ${w.lat}, ${w.lon} · ${w.altitude_m} m ${w.altitude_mode}`).join('\n') + '\n\n' + p.radios.map(r => `${r.role} · ${r.frequency_mhz} MHz · ${r.tx_dbm ?? 'unknown'} dBm · ${r.provenance}`).join('\n'); details.append(summary, pre); card.append(details); }
        if (!p) {
          const use = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Use a radio in quick tools'; use.append(summary);
          const label = document.createElement('label'); label.textContent = 'Choose one link';
          const select = document.createElement('select'); select.className = 'tool-input'; select.setAttribute('aria-label', 'Radio to use from ' + r.value.name);
          select.append(new Option('Choose a radio', ''), ...r.value.radios.map(link => new Option(link.role + ' · ' + link.frequency_mhz + ' MHz · ' + link.name, link.id))); label.append(select);
          const detail = document.createElement('p'); detail.textContent = 'Uses one link’s inputs with the source profile’s battery details, or your selected equipment when no source profile exists. Other links remain in this record. Existing profiles are preserved as separate copies.';
          const apply = document.createElement('button'); apply.textContent = 'Use selected radio'; apply.onclick = () => {
            try { const profile = FieldKitModels.profile(E.toLegacy(r.value, select.value, K.workspace.getProfile())); const saved = K.workspace.importSharedProfile(profile); detail.textContent = 'Using ' + saved.name + '. Imported assumptions are not hardware measurements.'; }
            catch(e) { detail.textContent = e.message; }
          };
          use.append(label, detail, apply); card.append(use);
        }
        const buttons = document.createElement('div'); buttons.className = 'kit-chips';
        const copy = document.createElement('button'); copy.textContent = 'Copy JSON'; copy.onclick = () => copyToolText(JSON.stringify(r.value,null,2),copy); buttons.append(copy);
        if (!window.Android) { const b = document.createElement('button'); b.textContent = 'Download'; b.onclick = () => download(r.value); buttons.append(b); }
        const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.onclick = () => {
          if (!confirm('Remove this imported copy? Other records stay saved.')) return;
          try { const next = records.filter(v => v.id !== r.id); localStorage.setItem(key, JSON.stringify(next)); records = next; renderRecords(); }
          catch(e) { text.textContent = 'Could not remove record: ' + e.message; }
        }; buttons.append(remove); card.append(buttons); planningRecords.append(card);
      }
    }
    el('kit-plan-records').onclick = () => { dialog.close(); checks.showModal(); navState(); };
    el('kit-nav-checks').onclick = () => { checks.showModal(); navState(); };
    checks.addEventListener('close', navState);
    if (location.pathname.startsWith('/field-kit/') && !window.Android) {
      const launch = document.createElement('a'); launch.href = '/'; launch.textContent = 'Open Horizon on this computer →'; launch.className = 'kit-horizon-link';
      dialog.querySelectorAll('.kit-plan-card')[1].append(launch);
    }
    renderRecords(); update(); navState();
  });
}
