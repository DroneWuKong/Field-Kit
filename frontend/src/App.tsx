import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, Crosshair, FileText, FolderOpen, Layers, LocateFixed, MapPin, Maximize2, Minimize2, Mountain, Plus, Radar, RadioTower, Redo2, Route, Save, Settings2, Trash2, Undo2, X, Zap } from 'lucide-react';
import MapView from './MapView';
import { RadioProfileChart, RouteChart } from './Charts';
import { api, colors, download, format, json, stateFor, stateLabels, type Area, type Job, type Mode, type Project, type Radio, type Result, type Sample, type TerrainRecord, type Waypoint } from './types';

function NumberField({ label, value, onChange, unit, nullable = false, step = 'any' }: { label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; nullable?: boolean; step?: string }) {
  const [draft, setDraft] = useState(value?.toString() ?? '');
  useEffect(() => setDraft(value?.toString() ?? ''), [value]);
  return <label className="field"><span>{label}</span><div className="input-unit"><input aria-label={label} type="number" step={step} value={draft} placeholder={nullable ? 'Not set' : ''} onChange={e => setDraft(e.target.value)} onBlur={() => { if (draft === '' && nullable) onChange(null); else if (draft !== '' && Number.isFinite(Number(draft))) onChange(Number(draft)); else setDraft(value?.toString() ?? ''); }}/>{unit && <em>{unit}</em>}</div></label>;
}
const datumOptions = <><option value="">Unresolved</option><option value="EGM96">EGM96</option><option value="NAVD88">NAVD88</option><option value="WGS84_ELLIPSOID">WGS84 ellipsoid</option></>;
const uid = () => crypto.randomUUID();

export default function App() {
  const [project, setProject] = useState<Project | null>(null), projectRef = useRef<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]), [terrain, setTerrain] = useState<TerrainRecord[]>([]);
  const [focusMap, setFocusMap] = useState(false);
  const [palette, setPalette] = useState<{low: number; high: number; colors: string[]; available: boolean; contour_m: number} | null>(null);
  useEffect(() => { let cancelled = false; setPalette(null); if (project?.terrain_ids.length) api<typeof palette>(`/terrain/palette?ids=${project.terrain_ids.join(',')}`).then(p => { if (!cancelled) setPalette(p); }).catch(() => {}); return () => { cancelled = true; }; }, [project?.terrain_ids.join(','), terrain]);
  const [tab, setTab] = useState<'plan' | 'radios' | 'terrain' | 'settings'>('plan');
  const [mode, setMode] = useState<Mode>('navigate'), [selected, setSelected] = useState<number | null>(null);
  const [band, setBand] = useState('combined'), [fitKey, setFitKey] = useState(0);
  const [result, setResult] = useState<Result | null>(null), [previous, setPrevious] = useState<Result | null>(null);
  const [sampleIndex, setSampleIndex] = useState<number | null>(null), [profile, setProfile] = useState<Sample | null>(null);
  const [job, setJob] = useState<Job | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(true), [busy, setBusy] = useState(false), [fitInsert, setFitInsert] = useState(false);
  const [exportFormat, setExportFormat] = useState<'plan' | 'wpl' | null>(null);
  const [area, setArea] = useState<Area>({ west: -88.05, south: 42.2, east: -87.91, north: 42.34, agl_m: 60, cell_m: 200 });
  const viewport = useRef(area), [catalog, setCatalog] = useState<Record<string, any>[]>([]);
  const [resolution, setResolution] = useState('10m'), [terrainDatum, setTerrainDatum] = useState('NAVD88');
  const [basemap, setBasemap] = useState<{ id: string; attribution: string } | null>(null);
  const [basemaps, setBasemaps] = useState<{id: string; name: string; attribution: string}[]>([]);
  useEffect(() => { api<typeof basemaps>('/basemaps').then(items => { setBasemaps(items); setBasemap(items.find(b => b.id === localStorage.getItem('horizon-basemap')) || null); }).catch(() => {}); }, []);
  useEffect(() => { if (basemap) localStorage.setItem('horizon-basemap', basemap.id); }, [basemap]);
  const history = useRef<Project[]>([]), future = useRef<Project[]>([]), epoch = useRef(0), jobEpoch = useRef(0), profileEpoch = useRef(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const missionInput = useRef<HTMLInputElement>(null), terrainInput = useRef<HTMLInputElement>(null), projectInput = useRef<HTMLInputElement>(null), observationsInput = useRef<HTMLInputElement>(null), basemapInput = useRef<HTMLInputElement>(null);

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), []);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  function persist(p: Project) {
    const pending = saveQueue.current.catch(() => {}).then(() => api<Project>(`/projects/${p.id}`, json(p, 'PUT')));
    saveQueue.current = pending;
    return pending;
  }
  const refresh = useCallback(async () => { const [ps, ts] = await Promise.all([api<Project[]>('/projects'), api<TerrainRecord[]>('/terrain')]); setProjects(ps); setTerrain(ts); }, []);
  function load(p: Project) {
    localStorage.setItem('horizon-project', p.id);
    if (projectRef.current && projectRef.current.id !== p.id) void persist(projectRef.current).catch(fail);
    epoch.current++; profileEpoch.current++; projectRef.current = p; setProject(p); setSaved(true);
    history.current = []; future.current = []; setHistoryVersion(v => v + 1);
    setSelected(null); setResult(null); setPrevious(null); setProfile(null); setSampleIndex(null); setMode('navigate'); setFitKey(v => v + 1);
  }
  useEffect(() => { let active = true; (async () => {
    const [ps, ts] = await Promise.all([api<Project[]>('/projects'), api<TerrainRecord[]>('/terrain')]);
    if (!active) return; setProjects(ps); setTerrain(ts);
    load(ps.find(p => p.id === localStorage.getItem('horizon-project')) || ps[0] || await api<Project>('/projects', { method: 'POST' }));
  })().catch(fail); return () => { active = false; }; }, []);

  const edit = useCallback((fn: (p: Project) => void) => {
    const old = projectRef.current; if (!old) return;
    const next = structuredClone(old); fn(next);
    if (JSON.stringify(next) === JSON.stringify(old)) return;
    history.current.push(old); if (history.current.length > 100) history.current.shift(); future.current = [];
    epoch.current++; profileEpoch.current++; projectRef.current = next; setProject(next); setSaved(false);
    setResult(null); setProfile(null); setSampleIndex(null); setHistoryVersion(v => v + 1);
  }, []);
  useEffect(() => {
    if (!project || saved) return;
    const p = project, currentEpoch = epoch.current;
    const timer = setTimeout(() => persist(p).then(() => {
      if (currentEpoch === epoch.current) setSaved(true);
    }).catch(fail), 450);
    return () => clearTimeout(timer);
  }, [project, saved]);

  function travel(back: boolean) {
    const from = back ? history.current : future.current, to = back ? future.current : history.current;
    const p = from.pop(); if (!p || !projectRef.current) return;
    to.push(projectRef.current); epoch.current++; profileEpoch.current++; projectRef.current = p; setProject(p); setSaved(false);
    setResult(null); setProfile(null); setSampleIndex(null); setHistoryVersion(v => v + 1);
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); travel(!e.shiftKey); } };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [historyVersion]);

  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const j = await api<Job>(`/jobs/${job.id}`); if (cancelled) return;
        if (j.status === 'complete') {
          const data = await api<any>(`/jobs/${j.id}/result`); if (cancelled) return;
          if (j.kind === 'analysis') {
            if (jobEpoch.current === epoch.current && !j.stale) { setResult(data); setSampleIndex(null); setProfile(null); setNotice(`Analysis complete · ${format(j.elapsed_s)} seconds`); }
            else setNotice('Analysis completed for an earlier mission revision. Rerun to analyze your edits.');
          } else if (j.kind === 'download') {
            await refresh(); edit(p => { p.terrain_ids = [...new Set([...p.terrain_ids, ...data.map((t: TerrainRecord) => t.id)])]; });
            setNotice('Terrain downloaded. Prepare datum grids before offline use.');
          } else { await refresh(); setNotice(data.remaining?.length ? 'Some datum grids remain unresolved.' : 'Datum grids prepared for offline analysis.'); }
        } else if (j.status === 'failed') fail(j.error || 'Analysis failed');
        setJob(j);
      } catch (e) { fail(e); }
    }, 600);
    return () => { cancelled = true; clearInterval(timer); };
  }, [job?.id, job?.status]);

  async function run(kind: 'route' | 'coverage' | 'altitude') {
    if (!project) return;
    setError(''); setBusy(true);
    try {
      await persist(project); setSaved(true);
      jobEpoch.current = epoch.current;
      const j = await api<Job>('/analyses', json({ project, kind, coverage: kind === 'coverage' ? area : null }));
      setJob(j); setProfile(null);
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function selectSample(index: number) {
    if (!result || !project) return;
    setMode('navigate'); setSampleIndex(index); const s = result.samples[index];
    setProfile(s); const seq = ++profileEpoch.current;
    try {
      const data = await api<Sample>('/profile', json({ project, lat: s.lat, lon: s.lon, altitude_m: s.altitude_m }));
      if (seq === profileEpoch.current) setProfile({ ...s, ...data, suggestion: s.suggestion });
    } catch (e) { fail(e); }
  }
  function addPoint(lon: number, lat: number) {
    if (!project) return;
    if (mode === 'draw' && !project.source?.readonly) {
      const index = fitInsert && selected != null ? selected + 1 : project.waypoints.length;
      edit(p => p.waypoints.splice(index, 0, { id: uid(), lat, lon, altitude_m: 60, altitude_mode: 'home', command: 16, params: [0, 0, 0, 0], source_index: null }));
      setSelected(index); setFitInsert(false);
    } else if (mode === 'station') { edit(p => { p.station.lat = lat; p.station.lon = lon; }); setMode('navigate'); }
    else if (mode === 'home' && !project.source?.readonly) { edit(p => { p.home.lat = lat; p.home.lon = lon; p.home.altitude_m = null; }); setMode('navigate'); }
    else if (mode === 'operator') { edit(p => { p.operator = { lat, lon }; }); setMode('navigate'); }
  }
  function movePoint(kind: string, index: number, lon: number, lat: number) {
    edit(p => {
      if (kind === 'waypoint') { p.waypoints[index].lon = lon; p.waypoints[index].lat = lat; }
      else if (kind === 'station') { p.station.lon = lon; p.station.lat = lat; }
      else if (kind === 'home') { p.home.lon = lon; p.home.lat = lat; p.home.altitude_m = null; }
      else p.operator = { lon, lat };
    });
  }
  async function importMission(file?: File) {
    if (!file) return; setBusy(true); setError('');
    try { const body = new FormData(); body.append('file', file); load(await api<Project>('/missions/import', { method: 'POST', body })); await refresh(); setNotice('Mission imported. Record its vertical datum before full analysis.'); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function doExport() {
    if (!exportFormat || !project) return;
    try {
      const r = await fetch('/api/v1/missions/export', json({ project, format: exportFormat }));
      if (!r.ok) throw new Error((await r.json()).detail);
      download(`${project.name}.${exportFormat === 'plan' ? 'plan' : 'waypoints'}`, await r.text()); setExportFormat(null);
    } catch (e) { fail(e); }
  }
  async function importTerrain(file?: File) {
    if (!file) return; setBusy(true);
    try { const body = new FormData(); body.append('file', file); body.append('datum', terrainDatum);
      const t = await api<TerrainRecord>('/terrain/import', { method: 'POST', body }); await refresh(); edit(p => { p.terrain_ids = [...new Set([...p.terrain_ids, t.id])]; }); setNotice('Terrain imported. Prepare datum grids for offline use.'); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function loadDemo() { setBusy(true); try { load(await api<Project>('/examples/demo', { method: 'POST' })); await refresh(); } catch (e) { fail(e); } finally { setBusy(false); } }
  async function switchProject(id: string) { setBusy(true); try { if (projectRef.current) await persist(projectRef.current); load(await api<Project>(`/projects/${id}`)); } catch (e) { fail(e); } finally { setBusy(false); } }
  async function resolveHome() { if (!project) return; try { const data = await api<{ altitude_m: number }>('/terrain/point', json({ project, lat: project.home.lat, lon: project.home.lon })); edit(p => { p.home.altitude_m = data.altitude_m; p.home.datum = 'EGM96'; }); } catch (e) { fail(e); } }
  async function catalogSearch() { setBusy(true); try { setCatalog(await api('/terrain/catalog', json({ area, resolution }))); setNotice('Catalog results use USGS current-product classification.'); } catch (e) { fail(e); } finally { setBusy(false); } }
  async function startDownload(products: Record<string, any>[]) { try { setJob(await api('/terrain/download', json({ products, datum: terrainDatum }))); } catch (e) { fail(e); } }

  const active = !!job && ['queued', 'running'].includes(job.status);
  const locked = project?.source?.readonly;
  const selectedWp = selected != null ? project?.waypoints[selected] : null;
  const synthetic = terrain.some(t => t.synthetic && project?.terrain_ids.includes(t.id));
  const patchWaypoint = (fn: (w: Waypoint) => void) => edit(p => { if (selected != null && !p.source?.readonly) fn(p.waypoints[selected]); });
  const patchRadio = (id: string, fn: (r: Radio) => void) => edit(p => { const r = p.radios.find(r => r.id === id); if (r) fn(r); });

  if (!project) return <main className="loading"><Radar size={40}/><h1>Horizon</h1><p>{error || 'Opening your local workspace…'}</p></main>;
  return <div className={`app-shell ${focusMap ? "map-focus" : ""}`}>
    {busy && <div className="busy-overlay" role="status">Working…</div>}
    <header className="topbar"><div className="brand"><span className="brand-mark"><Radar size={24}/></span><strong>HORIZON<span>MISSION PLANNER</span></strong></div>
      <div className="project-switch"><FolderOpen size={16}/><select aria-label="Open project" value={project.id} onChange={e => void switchProject(e.target.value)}><option value={project.id}>{project.name}</option>{projects.filter(p => p.id !== project.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={12}/></div>
      <div className="top-actions"><span className="local-badge"><i/>LOCAL WORKSPACE</span><button onClick={loadDemo} disabled={busy}>Example mission</button><button onClick={async () => { try { load(await api<Project>('/projects', { method: 'POST' })); await refresh(); } catch (e) { fail(e); } }}><Plus size={15}/>New</button><button className="primary" onClick={() => setExportFormat('plan')}><ArrowUpFromLine size={15}/>Export mission</button></div>
    </header>
    {error && <div role="alert" className="error-banner"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={14}/></button></div>}
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">MISSION WORKSPACE</span><h1>Build your flight plan.</h1><p>Set the route. Understand every link.</p></div>
        <nav className="tabs" aria-label="Configuration sections">{([['plan', Route, 'Route'], ['radios', RadioTower, 'Radios'], ['terrain', Mountain, 'Terrain'], ['settings', Settings2, 'Model']] as const).map(([t, Icon, label]) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}><Icon size={16}/>{label}</button>)}</nav>
        <div className="sidebar-scroll">
          {tab === 'plan' && <>
            <label className="field"><span>Mission name</span><input aria-label="Mission name" value={project.name} onChange={e => edit(p => { p.name = e.target.value; })}/></label>
            <div className="button-row"><button onClick={() => missionInput.current?.click()} disabled={busy}><ArrowDownToLine size={14}/>Import mission</button><button aria-label="Save project JSON" onClick={() => download(`${project.name}.horizon.json`, JSON.stringify(project, null, 2))}><Save size={14}/></button><button aria-label="Open project JSON" onClick={() => projectInput.current?.click()}><FolderOpen size={14}/></button></div>
            <p className="caption">QGroundControl .plan · Mission Planner .waypoints</p>
            {locked && <div className="warning">Read-only mission: unsupported commands are retained. Edit them in the original planner.{project.source?.warnings.map(w => <p key={w}>{w}</p>)}</div>}
            <div className="section-title"><h2>Ground station</h2><button className={mode === 'station' ? 'active' : ''} title="Place antenna on map" onClick={() => setMode(mode === 'station' ? 'navigate' : 'station')}><MapPin size={14}/></button></div>
            <div className="field-pair"><NumberField label="Antenna latitude" value={project.station.lat} onChange={v => edit(p => { p.station.lat = v!; })}/><NumberField label="Antenna longitude" value={project.station.lon} onChange={v => edit(p => { p.station.lon = v!; })}/></div>
            <NumberField label="Antenna height above ground" value={project.station.height_m} unit="m" onChange={v => edit(p => { p.station.height_m = v!; })}/>
            <details><summary>Aircraft home & operator</summary><div className="field-pair"><NumberField label="Home latitude" value={project.home.lat} onChange={v => !locked && edit(p => { p.home.lat = v!; })}/><NumberField label="Home longitude" value={project.home.lon} onChange={v => !locked && edit(p => { p.home.lon = v!; })}/></div><NumberField label="Home absolute altitude" value={project.home.altitude_m} nullable unit="m" onChange={v => !locked && edit(p => { p.home.altitude_m = v; })}/><label className="field"><span>Home vertical datum</span><select value={project.home.datum || ''} onChange={e => edit(p => { p.home.datum = e.target.value as Project['home']['datum'] || null; })}>{datumOptions}</select></label><button onClick={resolveHome} disabled={locked}><Mountain size={13}/>Set home from terrain</button><div className="button-row"><button disabled={locked} onClick={() => setMode('home')}>Place home</button><button onClick={() => setMode('operator')}>Place operator</button></div>{project.operator && <p className="caption">Operator: {format(project.operator.lat, 5)}, {format(project.operator.lon, 5)}</p>}</details>
            <div className="section-title"><h2>Flight route <span>{project.waypoints.length}</span></h2><div className="button-row"><button aria-label="Undo" disabled={!history.current.length} onClick={() => travel(true)}><Undo2 size={14}/></button><button aria-label="Redo" disabled={!future.current.length} onClick={() => travel(false)}><Redo2 size={14}/></button></div></div>
            <button className={`full ${mode === 'draw' ? 'active' : ''}`} disabled={locked} onClick={() => { setFitInsert(false); setMode(mode === 'draw' ? 'navigate' : 'draw'); }}><Plus size={14}/>{mode === 'draw' ? 'Click the map to add waypoints' : 'Draw waypoints on map'}</button>
            <div className="waypoint-list">{project.waypoints.map((w, i) => <button key={w.id} className={`waypoint-row ${selected === i ? 'selected' : ''}`} onClick={() => { setSelected(i); setMode('navigate'); }}><span className="waypoint-number">{String(i + 1).padStart(2, '0')}</span><span><b>{w.command === 22 ? 'Takeoff' : w.command === 21 ? 'Landing' : `Waypoint ${i + 1}`}</b><small>{w.lat.toFixed(4)}, {w.lon.toFixed(4)}</small></span><em>{format(w.altitude_m, 0)}<small>m {w.altitude_mode === 'home' ? 'REL' : w.altitude_mode.toUpperCase()}</small></em></button>)}</div>
            {!project.waypoints.length && <div className="empty-route"><Route size={26}/><p>Your route starts here.</p><small>Draw on the map or import a mission.</small></div>}
            {selectedWp && <div className="waypoint-editor"><div className="section-title"><h2>Waypoint {selected! + 1}</h2><button aria-label="Delete waypoint" disabled={locked} onClick={() => { edit(p => { p.waypoints.splice(selected!, 1); }); setSelected(null); }}><Trash2 size={14}/></button></div><fieldset disabled={locked}>
              <div className="field-pair"><NumberField label="Waypoint latitude" value={selectedWp.lat} onChange={v => patchWaypoint(w => { w.lat = v!; })}/><NumberField label="Waypoint longitude" value={selectedWp.lon} onChange={v => patchWaypoint(w => { w.lon = v!; })}/></div>
              <div className="field-pair"><NumberField label="Waypoint altitude" value={selectedWp.altitude_m} unit="m" onChange={v => patchWaypoint(w => { w.altitude_m = v!; })}/><label className="field"><span>Altitude reference</span><select value={selectedWp.altitude_mode} onChange={e => patchWaypoint(w => { w.altitude_mode = e.target.value as Waypoint['altitude_mode']; })}><option value="home">Relative to home</option><option value="agl">Above ground</option><option value="amsl">Absolute</option></select></label></div>
              <label className="field"><span>Command</span><select value={selectedWp.command} onChange={e => patchWaypoint(w => { w.command = Number(e.target.value); })}><option value="16">Waypoint</option><option value="22">Takeoff</option><option value="21">Land</option></select></label>
              <button className="full" onClick={() => { setFitInsert(true); setMode('draw'); }}><Plus size={13}/>Insert point after this waypoint</button>
            </fieldset></div>}
            <NumberField label="Planned cruise speed" value={project.speed_mps} unit="m/s" onChange={v => !locked && edit(p => { p.speed_mps = v!; })}/>
            <label className="field"><span>Absolute mission altitude datum</span><select value={project.altitude_datum || ''} onChange={e => edit(p => { p.altitude_datum = e.target.value as Project['altitude_datum'] || null; })}>{datumOptions}</select></label>
          </>}
          {tab === 'radios' && <>
            <div className="section-title"><h2>Required links</h2><RadioTower size={16}/></div>
            <label className="field"><span>Selected control band</span><select value={project.settings.selected_control} onChange={e => edit(p => { p.settings.selected_control = e.target.value; })}>{project.radios.filter(r => r.role === 'control').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label className="check"><input type="checkbox" checked={project.settings.require_video} onChange={e => edit(p => { p.settings.require_video = e.target.checked; })}/>Require video throughout mission</label>
            <p className="caption">Control bands are evaluated separately. Automatic band failover is not assumed.</p>
            {project.radios.map(r => <details className="radio-config" key={r.id} open><summary><span className="radio-dot"/>{r.name}<small>{r.role}</small></summary>
              <NumberField label={`${r.id} frequency`} value={r.frequency_mhz} unit="MHz" onChange={v => patchRadio(r.id, r => { r.frequency_mhz = v!; })}/>
              <div className="field-pair"><NumberField label={`${r.id} transmit power`} value={r.tx_dbm} nullable unit="dBm" onChange={v => patchRadio(r.id, r => { r.tx_dbm = v; })}/><NumberField label={`${r.id} receiver threshold`} value={r.sensitivity_dbm} nullable unit="dBm" onChange={v => patchRadio(r.id, r => { r.sensitivity_dbm = v; })}/></div>
              <div className="field-pair"><NumberField label={`${r.id} TX gain`} value={r.tx_gain_dbi} unit="dBi" onChange={v => patchRadio(r.id, r => { r.tx_gain_dbi = v!; })}/><NumberField label={`${r.id} RX gain`} value={r.rx_gain_dbi} unit="dBi" onChange={v => patchRadio(r.id, r => { r.rx_gain_dbi = v!; })}/></div>
              <div className="field-pair"><NumberField label={`${r.id} cable loss`} value={r.cable_loss_db} unit="dB" onChange={v => patchRadio(r.id, r => { r.cable_loss_db = v!; })}/><NumberField label={`${r.id} additional loss`} value={r.additional_loss_db} unit="dB" onChange={v => patchRadio(r.id, r => { r.additional_loss_db = v!; })}/></div>
              <div className="field-pair"><label className="field"><span>Polarization</span><select value={r.polarization} onChange={e => patchRadio(r.id, r => { r.polarization = e.target.value as Radio['polarization']; })}><option>vertical</option><option>horizontal</option></select></label><label className="field"><span>Parameter source</span><select value={r.provenance} onChange={e => patchRadio(r.id, r => { r.provenance = e.target.value as Radio['provenance']; })}><option>assumed</option><option>manufacturer</option><option>measured</option></select></label></div>
              <label className="field"><span>Notes / source reference</span><textarea value={r.notes} onChange={e => patchRadio(r.id, r => { r.notes = e.target.value; })}/></label>
              {r.role === 'telemetry' && <label className="check"><input type="checkbox" checked={project.settings.required_telemetry.includes(r.id)} onChange={e => edit(p => { p.settings.required_telemetry = e.target.checked ? [...p.settings.required_telemetry, r.id] : p.settings.required_telemetry.filter(x => x !== r.id); })}/>Require telemetry link</label>}
            </details>)}
            <button onClick={() => edit(p => { p.radios.push({ ...p.radios[0], id: `telemetry-${uid().slice(0, 6)}`, role: 'telemetry', direction: 'downlink', name: 'Return telemetry', tx_dbm: null, sensitivity_dbm: null }); })}><Plus size={14}/>Add return telemetry</button>
          </>}
          {tab === 'terrain' && <>
            <div className="section-title"><h2>Offline terrain library</h2><Mountain size={16}/></div><p className="caption">USGS 3DEP bare-earth elevations. Trees and buildings are not included.</p>
            {terrain.map(t => <label key={t.id} className="terrain-card"><input type="checkbox" checked={project.terrain_ids.includes(t.id)} onChange={e => edit(p => { p.terrain_ids = e.target.checked ? [...p.terrain_ids, t.id] : p.terrain_ids.filter(id => id !== t.id); })}/><span><b>{t.name}</b><small>{format(t.resolution_m)} m · {t.datum} · {format(t.size_bytes / 1048576)} MB</small>{t.synthetic && <em>SYNTHETIC EXAMPLE</em>}</span></label>)}
            <label className="field"><span>Imported/downloaded elevation datum</span><select value={terrainDatum} onChange={e => setTerrainDatum(e.target.value)}><option>NAVD88</option><option>EGM96</option><option>WGS84_ELLIPSOID</option></select></label><button className="full" disabled={busy} onClick={() => terrainInput.current?.click()}><Plus size={14}/>Import elevation GeoTIFF</button>
            <button className="full" disabled={active || !project.terrain_ids.length} onClick={async () => { try { setJob(await api('/terrain/grids', json({ ids: project.terrain_ids }))); } catch (e) { fail(e); } }}><ArrowDownToLine size={14}/>Prepare offline datum grids</button>
            <details open><summary>Download from USGS</summary><button className="full" onClick={() => setArea({ ...viewport.current, agl_m: area.agl_m, cell_m: area.cell_m })}><Crosshair size={13}/>Use current map extent</button>
              <div className="field-pair"><NumberField label="West" value={area.west} onChange={v => setArea(a => ({ ...a, west: v! }))}/><NumberField label="East" value={area.east} onChange={v => setArea(a => ({ ...a, east: v! }))}/></div><div className="field-pair"><NumberField label="South" value={area.south} onChange={v => setArea(a => ({ ...a, south: v! }))}/><NumberField label="North" value={area.north} onChange={v => setArea(a => ({ ...a, north: v! }))}/></div>
              <label className="field"><span>Resolution</span><select value={resolution} onChange={e => setResolution(e.target.value)}><option value="10m">1/3 arc-second · ~10 m</option><option value="1m">1 meter · where available</option></select></label><button className="full" onClick={catalogSearch} disabled={busy}>Find elevation products</button>
              {catalog.length > 0 && <><p className="caption">{catalog.length} products · {format(catalog.reduce((n, p) => n + (p.sizeInBytes || 0), 0) / 1048576)} MB</p><button className="full primary" disabled={active} onClick={() => startDownload(catalog)}>Download selected area</button>{catalog.map(p => <p className="caption" key={p.sourceId}>{p.title} · {format((p.sizeInBytes || 0) / 1048576)} MB</p>)}</>}
            </details>
            <details><summary>Optional basemap</summary><p className="caption">Import a local raster PMTiles v3 archive. Elevation calculations still use the selected DEMs.</p><select aria-label="Local basemap" value={basemap?.id || ""} onChange={e => { localStorage.setItem("horizon-basemap", e.target.value); setBasemap(basemaps.find(b => b.id === e.target.value) || null); }}><option value="">Terrain only</option>{basemaps.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><button onClick={() => basemapInput.current?.click()}>Import raster PMTiles</button></details>
          </>}
          {tab === 'settings' && <>
            <div className="section-title"><h2>Propagation model</h2><Settings2 size={16}/></div><div className="model-card"><b>ITU-R P.525 + P.526-16</b><p>Free space + complete terrain diffraction</p><small>Effective Earth curvature, Bullington construction, and spherical-Earth correction.</small></div>
            <NumberField label="Effective Earth radius factor" value={project.settings.k_factor} onChange={v => edit(p => { p.settings.k_factor = v!; })}/><NumberField label="Required Fresnel fraction" value={project.settings.fresnel_fraction} onChange={v => edit(p => { p.settings.fresnel_fraction = v!; })}/><NumberField label="Required planning margin" value={project.settings.margin_db} unit="dB" onChange={v => edit(p => { p.settings.margin_db = v!; })}/><NumberField label="Route sample spacing" value={project.settings.route_step_m} unit="m" onChange={v => edit(p => { p.settings.route_step_m = v!; })}/><NumberField label="Maximum terrain profile spacing" value={project.settings.profile_step_m} unit="m" onChange={v => edit(p => { p.settings.profile_step_m = v!; })}/>
            <details><summary>Ground electrical properties</summary><NumberField label="Relative permittivity" value={project.settings.epsilon} onChange={v => edit(p => { p.settings.epsilon = v!; })}/><NumberField label="Conductivity" value={project.settings.conductivity} unit="S/m" onChange={v => edit(p => { p.settings.conductivity = v!; })}/></details>
            <div className="section-title"><h2>Altitude search bounds</h2></div><div className="field-pair"><NumberField label="Minimum AGL" value={project.settings.min_agl_m} unit="m" onChange={v => edit(p => { p.settings.min_agl_m = v!; })}/><NumberField label="Maximum AGL" value={project.settings.max_agl_m} nullable unit="m" onChange={v => edit(p => { p.settings.max_agl_m = v; })}/></div><p className="caption">Lowest evaluated altitude: 5 m sweep, 1 m refinement. Suggestions do not model climb or turn capability.</p><button className="full" disabled={active || busy || project.settings.max_agl_m == null} onClick={() => run('altitude')}><Activity size={14}/>Find altitude suggestions</button>
            <div className="section-title"><h2>Field observations</h2></div><p className="caption">Compare measured RSSI with predictions. Import does not change radio parameters.</p><button className="full" onClick={() => observationsInput.current?.click()}><FileText size={14}/>Import observation CSV</button><button className="full" onClick={() => download('observations-template.csv', 'lat,lon,altitude_m,altitude_reference,frequency_mhz,rssi_dbm,link_quality\n', 'text/csv')}>Download CSV template</button>
          </>}
        </div>
        <div className="sidebar-footer"><span><i className={saved ? 'saved-dot' : 'pending-dot'}/>{saved ? 'Saved on this laptop' : 'Saving changes…'}</span><span>v0.1</span></div>
      </aside>
      <main className="main-pane">
        <section className="map-area">
          <div className="map-view-actions"><span><Mountain size={13}/> TERRAIN VIEW</span><button aria-label={focusMap ? "Restore panels" : "Expand map"} title={focusMap ? "Restore panels" : "Expand map"} onClick={() => setFocusMap(v => !v)}>{focusMap ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button></div>
          {palette?.available && <div className="elevation-legend"><div><Mountain size={12}/><b>Elevation</b><span>m · EGM96</span></div><div className="elevation-ramp" style={{background: `linear-gradient(90deg, ${palette.colors.join(',')})`}}/><div className="elevation-ticks"><span>≤ {palette.low}</span><span>{Math.round((palette.low + palette.high) / 2)}</span><span>≥ {palette.high}</span></div><small>Sampled terrain range · {palette.contour_m} m contours</small></div>}
          <MapView project={project} terrain={terrain} result={result} previous={previous} band={band} mode={mode} selected={selected} fitKey={fitKey} onPoint={addPoint} onMove={movePoint} onSelect={setSelected} onSample={selectSample} onBounds={a => { viewport.current = a; }} onError={fail} basemap={basemap}/>
          <div className="map-top"><div className="map-tools"><button className={mode === 'navigate' ? 'active' : ''} title="Navigate" onClick={() => setMode('navigate')}><Crosshair size={17}/></button><button disabled={locked} className={mode === 'draw' ? 'active' : ''} title="Draw route" onClick={() => setMode('draw')}><Route size={17}/></button><button className={mode === 'station' ? 'active' : ''} title="Place ground antenna" onClick={() => setMode('station')}><RadioTower size={17}/></button><span/><button title="Fit route" onClick={() => setFitKey(v => v + 1)}><LocateFixed size={17}/></button></div>
            <div className="map-context"><span className="eyebrow">TERRAIN + RADIO COVERAGE</span><b>{synthetic ? 'Synthetic ridge study' : project.terrain_ids.length ? 'USGS / imported elevation' : 'Prepare your operating area'}</b><small>{synthetic ? 'Demonstration data · not real terrain' : project.terrain_ids.length ? `${project.terrain_ids.length} local elevation tiles` : 'Add 3DEP terrain from the Terrain tab'}</small></div>
          </div>
          <div className="band-switch" aria-label="Coverage band"><button className={band === 'combined' ? 'active' : ''} onClick={() => setBand('combined')}><Layers size={13}/>Combined</button>{project.radios.map(r => <button key={r.id} className={band === r.id ? 'active' : ''} onClick={() => setBand(r.id)}>{r.frequency_mhz >= 1000 ? `${format(r.frequency_mhz / 1000)} GHz` : `${r.frequency_mhz} MHz`}</button>)}</div>
          {mode !== 'navigate' && <div className="mode-hint">{mode === 'draw' ? (fitInsert ? 'Click to insert after the selected waypoint' : 'Click to add a waypoint · drag pins to adjust') : `Click to place ${mode === 'station' ? 'the ground antenna' : mode}`}<button onClick={() => setMode('navigate')}>Done</button></div>}
          {!project.terrain_ids.length && <div className="map-welcome"><Mountain size={34}/><h2>Every route has a horizon.</h2><p>Prepare your terrain, place a ground antenna,<br/>and see where your radio links reach.</p><button className="primary" onClick={() => setTab('terrain')}>Prepare terrain</button><button onClick={loadDemo} disabled={busy}>Explore the synthetic example</button></div>}
          <div className="map-legend">{Object.entries(colors).map(([state, color]) => <span key={state}><i style={{ background: color }}/>{stateLabels[state as keyof typeof colors]}</span>)}</div>
          {previous && <div className="baseline-badge">Dashed white: saved comparison<button aria-label="Clear comparison" onClick={() => setPrevious(null)}><X size={12}/></button></div>}
        </section>
        <section className="route-profile"><div className="profile-header"><div><span className="eyebrow">FLIGHT PROFILE</span><h2>Terrain & link margin</h2></div><div className="profile-key"><span><i style={{ background: '#52634a' }}/>Terrain</span><span><i style={{ background: '#60dbad' }}/>Planned altitude</span>{result?.kind === 'altitude' && <span><i style={{ background: '#a9b8ff' }}/>Suggested AGL</span>}</div><button disabled={!result} onClick={() => setPrevious(result ? structuredClone(result) : null)}>Keep for comparison</button></div><RouteChart result={result} band={band} onSelect={selectSample} selected={sampleIndex}/></section>
      </main>
      <aside className="inspector">
        <div className="inspector-heading"><span className="eyebrow">MISSION ANALYSIS</span><h2>Link intelligence.</h2></div>
        <button className="primary analyze-button" disabled={active || busy || !project.waypoints.length} onClick={() => run('route')}><Zap size={17}/>{active ? 'Analysis in progress' : 'Analyze route'}</button>
        {active && <div className="job-progress"><progress value={job.done} max={job.total || 1}/><span>{job.total ? `${job.done} / ${job.total}` : 'Preparing…'}</span><button onClick={async () => { try { setJob(await api(`/jobs/${job.id}`, { method: 'DELETE' })); } catch (e) { fail(e); } }}>Cancel</button></div>}
        <div className="analysis-summary"><span className={`status-orb ${result ? 'ready' : ''}`}><Activity size={22}/></span><div><b>{result ? 'Prediction complete' : 'Ready when you are'}</b><p>{result ? `${result.samples.length.toLocaleString()} positions evaluated` : 'Draw or import a route to begin.'}</p></div></div>
        {synthetic && <div className="synthetic-note">SYNTHETIC EXAMPLE<br/><span>Terrain and radio settings are illustrative.</span></div>}
        {result && <div className="summary-grid">{Object.entries(colors).map(([state, color]) => <div key={state}><b style={{ color }}>{result.summary[state as keyof typeof result.summary] || 0}</b><small>{stateLabels[state as keyof typeof colors]}</small></div>)}</div>}
        {previous && result && <p className="caption">Comparison: {previous.summary.green || 0} → {result.summary.green || 0} positions meet criteria. Counts depend on sampling and mission extent.</p>}
        <div className="section-title"><h2>Link detail</h2><RadioTower size={15}/></div>
        {profile ? <><p className="caption">{format(profile.lat, 5)}, {format(profile.lon, 5)} · {format(profile.agl_m)} m AGL</p>{profile.reason && <p className="warning">{profile.reason}</p>}{project.radios.map(r => { const link = profile.links[r.id]; return <div className="link-card" key={r.id}><div><span className="status-dot" style={{ background: colors[link?.state || 'unknown'] }}/><b>{r.name}</b><small>{result?.required_radios.includes(r.id) ? 'Required' : 'Comparison'}</small></div><strong style={{ color: colors[link?.state || 'unknown'] }}>{format(link?.margin_db)}<span> dB margin</span></strong><dl><dt>Received power</dt><dd>{format(link?.rx_dbm)} dBm</dd><dt>Fresnel clearance</dt><dd>{link ? format(link.clearance_fraction * 100, 0) : '—'}%</dd><dt>Diffraction loss</dt><dd>{format(link?.diffraction_db)} dB</dd></dl>{link?.reason && <p className="caption">{link.reason}</p>}</div>; })}</> : <p className="empty-detail">Click a colored route segment or coverage cell to inspect each radio link.</p>}
        <div className="section-title"><h2>Radio path</h2></div><RadioProfileChart sample={profile} band={band === 'combined' ? project.settings.selected_control : band} fraction={project.settings.fresnel_fraction}/>
        {profile?.suggestion && <div className="suggestion"><b>{profile.suggestion.status === 'found' ? `${format(profile.suggestion.agl_m)} m AGL` : profile.suggestion.status === 'no_pass' ? 'No passing altitude' : 'Altitude unresolved'}</b><p>{profile.suggestion.reason || 'Lowest evaluated altitude meeting the selected criteria.'}</p>{profile.suggestion.agl_m != null && profile.waypoint_index != null && <button disabled={locked} onClick={() => { const index = profile.waypoint_index!, height = profile.suggestion!.agl_m!; edit(p => { p.waypoints[index].altitude_mode = 'agl'; p.waypoints[index].altitude_m = height; }); }}>Apply to waypoint {profile.waypoint_index + 1}</button>}</div>}
        <details className="coverage-controls"><summary>Area coverage</summary><p className="caption">Use the Terrain tab’s area bounds, or capture the visible map.</p><button onClick={() => setArea({ ...viewport.current, agl_m: area.agl_m, cell_m: area.cell_m })}>Use visible map area</button><div className="field-pair"><NumberField label="Coverage AGL" value={area.agl_m} unit="m" onChange={v => setArea(a => ({ ...a, agl_m: v! }))}/><NumberField label="Coverage cell" value={area.cell_m} unit="m" onChange={v => setArea(a => ({ ...a, cell_m: v! }))}/></div><button className="full" disabled={active || busy || !project.terrain_ids.length} onClick={() => run('coverage')}>Calculate coverage</button></details>
        <button className="full report-button" disabled={!result} onClick={() => download(`${project.name}-analysis.json`, JSON.stringify(result, null, 2))}><FileText size={14}/>Export analysis & assumptions</button>
        <p className="model-footnote">MODELED, NOT MEASURED<br/>Bare earth · static antenna gains · no interference model</p>
        {result?.warnings.map(w => <p className="warning" key={w}>{w}</p>)}
      </aside>
    </div>
    <footer className="statusbar"><span><Check size={12}/>{notice || 'Offline analysis · your mission stays on this laptop'}</span><span>{project.waypoints.length} waypoints<span className="separator">/</span>{project.terrain_ids.length} terrain tiles<span className="separator">/</span>P.525 + P.526</span></footer>

    <input hidden ref={missionInput} type="file" accept=".plan,.waypoints,.txt" onChange={e => { importMission(e.target.files?.[0]); e.target.value = ''; }}/>
    <input hidden ref={terrainInput} type="file" accept=".tif,.tiff" onChange={e => { importTerrain(e.target.files?.[0]); e.target.value = ''; }}/>
    <input hidden ref={projectInput} type="file" accept=".json" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const p = JSON.parse(await f.text()) as Project; p.id = uid(); load(await api(`/projects/${p.id}`, json(p, 'PUT'))); await refresh(); } catch (err) { fail(err); } }}/>
    <input hidden ref={observationsInput} type="file" accept=".csv" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); try { const body = new FormData(); body.append('project', JSON.stringify(project)); body.append('file', f); const data = await api('/observations', { method: 'POST', body }); download('observation-comparison.json', JSON.stringify(data, null, 2)); setNotice('Observation comparison saved. No calibration was applied.'); } catch (err) { fail(err); } finally { setBusy(false); } }}/>
    <input hidden ref={basemapInput} type="file" accept=".pmtiles" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const header = new Uint8Array(await f.slice(0, 100).arrayBuffer()); if (![2, 3, 4].includes(header[99])) throw new Error('Use raster PNG/JPEG/WebP PMTiles; vector styles are not bundled in this release.'); const body = new FormData(); body.append('file', f); setBasemap(await api('/basemaps', { method: 'POST', body })); setBasemaps(await api('/basemaps')); } catch (err) { fail(err); } }}/>
    {exportFormat && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Review mission export"><div className="section-title"><h2>Review mission export</h2><button aria-label="Close export" onClick={() => setExportFormat(null)}><X size={18}/></button></div><p>{project.name}</p><label className="field"><span>File format</span><select value={exportFormat} onChange={e => setExportFormat(e.target.value as 'plan' | 'wpl')}><option value="plan">QGroundControl .plan</option><option value="wpl">Mission Planner .waypoints (WPL 110)</option></select></label><dl className="export-details"><dt>Waypoints</dt><dd>{project.waypoints.length}</dd><dt>Home altitude</dt><dd>{format(project.home.altitude_m)} m · {project.home.datum || 'unresolved'}</dd><dt>Mission vertical datum</dt><dd>{project.altitude_datum || 'unresolved'}</dd><dt>Source</dt><dd>{project.source?.filename || 'Drawn in Horizon'}</dd></dl><div className="export-table">{project.waypoints.map((w, i) => <div key={w.id}><span>{i + 1}</span><span>{w.lat.toFixed(5)}, {w.lon.toFixed(5)}</span><span>{w.altitude_m} m {w.altitude_mode}</span></div>)}</div><p className="caption">Exports a new file. Unsupported commands remain read-only. Review flight behavior in your aircraft’s mission planner.</p><button className="primary full" onClick={doExport}><ArrowUpFromLine size={15}/>Download mission</button></section></div>}
  </div>;
}
