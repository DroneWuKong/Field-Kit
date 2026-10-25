/* Local phone planner. Portable files use the shared Horizon contracts. */
(function (root) {
  'use strict';
  const KEY = 'fieldkit-mobile-planner-v1';
  const copy = x => JSON.parse(JSON.stringify(x));
  const id = () => crypto.randomUUID();
  const radio = (role, frequency) => ({id:id(), name:role === 'control' ? 'Control link' : 'Video link',
    frequency_mhz:frequency, direction:role === 'control' ? 'uplink' : 'downlink', role,
    tx_dbm:null, sensitivity_dbm:null, tx_gain_dbi:0, rx_gain_dbi:0, cable_loss_db:0,
    additional_loss_db:0, polarization:'vertical', provenance:'assumed', notes:'Planning assumptions; verify equipment specifications.'});
  function newPlan(name, lat, lon) {
    const radios = [radio('control',915), radio('video',5800)];
    return {schema:'prismo.plan.v1', evidence:'predicted', project:{version:1,id:id(),name,
      home:{lat,lon,altitude_m:null,datum:'EGM96'}, station:{lat,lon,height_m:3},operator:null,
      waypoints:[],speed_mps:8,radios,settings:{k_factor:4/3,fresnel_fraction:0.6,margin_db:10,
        route_step_m:25,profile_step_m:10,epsilon:15,conductivity:0.005,
        selected_control:radios[0].id,require_video:true,required_telemetry:[],min_agl_m:10,max_agl_m:null},
      terrain_ids:[],source:null,altitude_datum:'EGM96',equipment:null}};
  }
  function checkedPlan(plan) {
    const p = root.PrismoExchange.plan(plan);
    if (!p.project.home || !p.project.station || !Array.isArray(p.project.terrain_ids)
        || !Array.isArray(p.project.settings.required_telemetry)) throw Error('Plan is missing home, antenna or analysis settings. Export a complete Prismo plan from Horizon.');
    if (p.project.waypoints.length > 500) throw Error('A route can have up to 500 points.');
    if (new Set(p.project.waypoints.map(w=>w.id)).size !== p.project.waypoints.length) throw Error('Waypoint IDs must be unique.');
    return p;
  }
  function validate(s) {
    if (s?.version !== 1 || !Array.isArray(s.routes) || s.routes.length > 30 || !Array.isArray(s.setups) || s.setups.length > 50)
      throw Error('Saved workspace is not recognized. Export saved data before repair.');
    s.routes.forEach(checkedPlan);
    s.setups.forEach(e=>{
      root.PrismoExchange.equipment(e.equipment);
      if (!e.equipment.radios.some(r=>r.id===e.selected_control && r.role==='control')) throw Error('Setup needs a control link.');
    });
    if (new Set(s.routes.map(r=>r.project.id)).size !== s.routes.length) throw Error('Duplicate saved routes.');
    if (s.selected !== null && !s.routes.some(r=>r.project.id===s.selected)) throw Error('Saved route selection is invalid.');
    return s;
  }
  class Store {
    constructor(storage) {
      this.storage=storage; this.error=null; this.raw=null;
      this.state={version:1,routes:[],setups:[],selected:null};
      try { this.raw=storage.getItem(KEY); if(this.raw!==null) this.state=validate(JSON.parse(this.raw)); }
      catch(e) { this.error=e.message; }
    }
    commit(change) {
      if(this.error) throw Error('Saved workspace cannot be read. Export saved data before repair.');
      const next=copy(this.state); change(next); validate(next);
      // Memory changes only after storage succeeds. Never erase a failed/corrupt read.
      this.storage.setItem(KEY,JSON.stringify(next)); this.state=next;
    }
    current() { return copy(this.state.routes.find(r=>r.project.id===this.state.selected) || null); }
    select(routeId) {this.commit(s=>{s.selected=routeId;});}
    add(plan) { const p=checkedPlan(plan); p.project.id=id(); this.commit(s=>{s.routes.push(p);s.selected=p.project.id;}); }
    edit(change) {
      this.commit(s=>{const p=s.routes.find(r=>r.project.id===s.selected)?.project;
        if(!p) throw Error('Create or import a route first.');
        if(p.source?.readonly) throw Error('This imported mission is read-only.');
        change(p);
      });
    }
    remove() {this.commit(s=>{s.routes=s.routes.filter(r=>r.project.id!==s.selected);s.selected=s.routes[0]?.project.id||null;});}
    apply(setup) {
      const before=this.current(); if(!before) throw Error('Create a route first.');
      const e=root.PrismoExchange.equipment(setup.equipment);
      this.edit(p=>{p.radios=copy(e.radios);p.settings.margin_db=e.margin_db;
        p.settings.selected_control=setup.selected_control;
        p.settings.required_telemetry=(setup.required_telemetry||[]).slice();
        p.settings.require_video=setup.require_video??e.radios.some(r=>r.role==='video');p.equipment=e;});
      return {id:before.project.id,radios:before.project.radios,settings:before.project.settings,equipment:before.project.equipment};
    }
    undo(before) {if(this.state.selected!==before.id) throw Error('Select the route where equipment changed.');
      this.edit(p=>{p.radios=copy(before.radios);p.settings=copy(before.settings);p.equipment=copy(before.equipment);});}
  }
  root.MobilePlanner={KEY,copy,id,radio,newPlan,checkedPlan,Store};
  if(typeof module!=='undefined') module.exports=root.MobilePlanner;
})(globalThis);
