/* Shared file contracts. Pure functions; no browser storage or native access. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  // Interpreter for the constrained JSON Schema vocabulary emitted by these Pydantic models.
  function validate(value, node, schema, path = 'file') {
    if (node.$ref) return validate(value, schema.$defs[node.$ref.split('/').pop()], schema, path);
    if (node.anyOf) {
      for (const choice of node.anyOf) { try { validate(value, choice, schema, path); return; } catch (_) {} }
      throw Error(path + ': value does not match the contract.');
    }
    const fail = () => { throw Error(path + ': invalid value.'); };
    if ('const' in node && value !== node.const) fail();
    if (node.enum && !node.enum.includes(value)) fail();
    if (node.type === 'null' && value !== null) fail();
    if (node.type === 'boolean' && typeof value !== 'boolean') fail();
    if (node.type === 'string') {
      if (typeof value !== 'string' || value.length < (node.minLength ?? 0) || value.length > (node.maxLength ?? Infinity)) fail();
    }
    if (node.type === 'number' || node.type === 'integer') {
      if (typeof value !== 'number' || !Number.isFinite(value) || node.type === 'integer' && !Number.isInteger(value)) fail();
      if (value < (node.minimum ?? -Infinity) || value > (node.maximum ?? Infinity)
        || value <= (node.exclusiveMinimum ?? -Infinity) || value >= (node.exclusiveMaximum ?? Infinity)) fail();
    }
    if (node.type === 'array') {
      if (!Array.isArray(value) || value.length < (node.minItems ?? 0) || value.length > (node.maxItems ?? Infinity)) fail();
      value.forEach((item, i) => validate(item, node.items, schema, path + '[' + i + ']'));
    }
    if (node.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
      for (const key of node.required || []) if (!Object.hasOwn(value, key)) throw Error(path + ': missing ' + key);
      for (const [key, item] of Object.entries(value)) {
        if (node.properties && Object.hasOwn(node.properties, key)) validate(item, node.properties[key], schema, path + '.' + key);
        else if (node.additionalProperties === false) throw Error(path + ': unknown field ' + key);
        else if (node.additionalProperties && typeof node.additionalProperties === 'object') validate(item, node.additionalProperties, schema, path + '.' + key);
      }
    }
  }
  function uniqueRadios(radios) {
    if (new Set(radios.map(r => r.id)).size !== radios.length) throw Error('Radio IDs must be unique.');
  }
  function equipment(value) {
    validate(value, root.PrismoSchemas.equipment, root.PrismoSchemas.equipment);
    uniqueRadios(value.radios);
    return clone(value);
  }
  function fromLegacy(profile, role, direction) {
    if (!['control', 'video', 'telemetry'].includes(role) || !['uplink', 'downlink'].includes(direction)) throw Error('Choose the link role and direction.');
    if (profile.schema !== 'prismo.fieldkit.equipment.v1' || !Number.isFinite(profile.power) || profile.power <= 0) throw Error('Invalid saved equipment profile.');
    return equipment({schema: 'prismo.equipment.v1', id: profile.id, revision: profile.revision,
      name: profile.name, serial: profile.serial, origin: 'field-kit', margin_db: profile.margin,
      source_profile: clone(profile), radios: [{id: 'fieldkit-' + profile.id + '-' + role,
        name: profile.radio || profile.name, frequency_mhz: profile.frequency, role, direction,
        tx_dbm: 10 * Math.log10(profile.power), sensitivity_dbm: profile.sensitivity,
        tx_gain_dbi: profile.txGain, rx_gain_dbi: profile.rxGain, cable_loss_db: 0, additional_loss_db: 0,
        polarization: 'vertical', provenance: 'assumed',
        notes: 'Saved Field Kit inputs; power converted from ' + profile.power + ' mW. Gains, losses and polarization are assumptions; hardware specifications are unverified.'}]});
  }
  function toLegacy(value, radioId, fallbackProfile) {
    const e = equipment(value), r = e.radios.find(r => r.id === radioId);
    if (!r) throw Error('Choose a radio link.');
    if (r.tx_dbm == null || r.sensitivity_dbm == null) throw Error('Power and receiver sensitivity must be known before using quick tools.');
    if ((r.cable_loss_db || 0) !== 0 || (r.additional_loss_db || 0) !== 0) throw Error('This link includes losses that the quick tools cannot represent. Keep using Horizon for this profile.');
    const base = e.source_profile || fallbackProfile;
    if (!base || base.schema !== 'prismo.fieldkit.equipment.v1') throw Error('Choose saved equipment for the battery and device details first.');
    return {...clone(base), id: e.id, revision: e.revision, name: e.name, serial: e.serial || '',
      frequency: r.frequency_mhz, power: 10 ** (r.tx_dbm / 10), txGain: r.tx_gain_dbi ?? 0,
      rxGain: r.rx_gain_dbi ?? 0, sensitivity: r.sensitivity_dbm, margin: e.margin_db, radio: r.name};
  }
  function plan(value) {
    validate(value, root.PrismoSchemas.plan, root.PrismoSchemas.plan);
    // These fields are required for portable files even though the service can default them on creation.
    const p = value.project;
    if (!p.id || !p.name || !Array.isArray(p.waypoints) || !Array.isArray(p.radios) || !p.settings) throw Error('Incomplete portable plan.');
    uniqueRadios(p.radios);
    if (!p.radios.some(r => r.id === p.settings.selected_control && r.role === 'control')) throw Error('Plan has no selected control link.');
    for (const id of p.settings.required_telemetry || []) if (!p.radios.some(r => r.id === id && r.role === 'telemetry')) throw Error('Missing required telemetry link.');
    if (p.settings.max_agl_m != null && p.settings.max_agl_m < p.settings.min_agl_m) throw Error('Invalid altitude limits.');
    if (p.waypoints.some(w => w.params && w.params.length !== 4)) throw Error('Invalid waypoint parameters.');
    if (p.equipment) equipment(p.equipment);
    return clone(value);
  }
  function parse(text) {
    if (new TextEncoder().encode(text).length > 5000000) throw Error('File exceeds 5 MB.');
    const value = JSON.parse(text);
    if (value?.schema === 'prismo.equipment.v1') {
      if (new TextEncoder().encode(text).length > 200000) throw Error('Equipment exceeds 200 KB.');
      return equipment(value);
    }
    if (value?.schema === 'prismo.plan.v1') return plan(value);
    throw Error('Choose a Prismo equipment or plan file.');
  }
  root.PrismoExchange = {equipment, fromLegacy, toLegacy, plan, parse};
  if (typeof module !== 'undefined') module.exports = root.PrismoExchange;
})(globalThis);
