import { colors, format, stateFor, type Result, type Sample } from './types';

export function RouteChart({ result, band, onSelect, selected }: { result: Result | null; band: string; onSelect: (i: number) => void; selected: number | null }) {
  if (!result || result.kind === 'coverage' || !result.samples.length) return <div className="chart-empty"><span className="chart-grid"/>Analyze a route to see terrain, altitude, and link quality along the flight.</div>;
  const samples = result.samples, maxD = Math.max(...samples.map(s => s.distance_m || 0), 1);
  const zs = samples.flatMap(s => [s.altitude_m, s.terrain_m]).filter((n): n is number => n != null);
  const minZ = Math.floor(((zs.length ? Math.min(...zs) : 0) - 10) / 20) * 20, maxZ = Math.max(...zs, 100) + 20;
  const xx = (s: Sample) => 50 + (s.distance_m || 0) / maxD * 900;
  const yy = (z: number) => 150 - (z - minZ) / (maxZ - minZ) * 125;
  const terrainPaths: string[] = [];
  let current = '', lastX = 0;
  samples.forEach(s => {
    if (s.terrain_m == null) { if (current) terrainPaths.push(current + ` L${lastX},150 Z`); current = ''; return; }
    current += current ? ` L${xx(s)},${yy(s.terrain_m)}` : `M${xx(s)},150 L${xx(s)},${yy(s.terrain_m)}`;
    lastX = xx(s);
  });
  if (current) terrainPaths.push(current + ` L${lastX},150 Z`);
  return <svg className="route-chart" viewBox="0 0 980 180" role="img" aria-label="Route altitude and terrain profile">
    <defs><linearGradient id="terrain-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#65aaa9" stopOpacity=".48"/><stop offset="100%" stopColor="#28435d" stopOpacity=".12"/></linearGradient></defs>
    {[0, 1, 2, 3].map(i => { const z = minZ + (maxZ - minZ) * i / 3; return <g key={i}><line x1="50" x2="950" y1={yy(z)} y2={yy(z)} stroke="#29384c" strokeDasharray="3 5"/><text x="4" y={yy(z) + 4}>{z.toFixed(0)} m</text></g>; })}
    {terrainPaths.map((d, i) => <path key={`terrain-${i}`} d={d} fill="url(#terrain-fill)" stroke="#77abaa" strokeWidth="1"/>)}
    {samples.map((s, i) => {
      if (!i) return null; const prev = samples[i - 1];
      return <g key={i}>
        {s.altitude_m != null && prev.altitude_m != null && <line x1={xx(prev)} x2={xx(s)} y1={yy(prev.altitude_m)} y2={yy(s.altitude_m)} stroke={colors[stateFor(s, band)]} strokeWidth="3"/>}
        {s.suggestion?.agl_m != null && s.terrain_m != null && <circle cx={xx(s)} cy={yy(s.terrain_m + s.suggestion.agl_m)} r="1.8" fill="#a9b8ff"/>}
        <rect x={xx(prev)} y="0" width={Math.max(3, xx(s) - xx(prev))} height="150" fill="transparent" onClick={() => onSelect(i)} style={{ cursor: 'crosshair' }}/>
      </g>;
    })}
    {selected != null && samples[selected] && <line x1={xx(samples[selected])} x2={xx(samples[selected])} y1="8" y2="155" stroke="#dce5e9" strokeDasharray="3 3"/>}
    {[0, 1, 2, 3, 4].map(i => <text key={i} x={50 + 900 * i / 4} y="173" textAnchor="middle">{(maxD * i / 4000).toFixed(1)} km</text>)}
  </svg>;
}

export function RadioProfileChart({ sample, band, fraction }: { sample: Sample | null; band: string; fraction: number }) {
  const p = sample?.profile;
  if (!p) return <div className="chart-empty small">Select an analyzed route segment or coverage cell to inspect its radio path.</div>;
  const key = band === 'combined' ? Object.keys(p.fresnel_m)[0] : band;
  const f1 = p.fresnel_m[key] || Object.values(p.fresnel_m)[0];
  const low = Math.min(...p.curved_terrain_m, ...p.line_m.map((v, i) => v - f1[i])) - 5;
  const high = Math.max(...p.curved_terrain_m, ...p.line_m.map((v, i) => v + f1[i])) + 5;
  const length = p.distance_m[p.distance_m.length - 1];
  const x = (i: number) => 38 + p.distance_m[i] / length * 460;
  const y = (z: number) => 125 - (z - low) / (high - low) * 110;
  const line = (zs: number[]) => zs.map((z, i) => `${i ? 'L' : 'M'}${x(i)},${y(z)}`).join(' ');
  const upper = p.line_m.map((v, i) => v + f1[i] * fraction);
  const lower = p.line_m.map((v, i) => v - f1[i] * fraction);
  return <><svg viewBox="0 0 530 155" className="radio-chart" role="img" aria-label="Radio path, curved terrain and Fresnel zone">
    <path d={line(upper) + lower.map((v, i) => `L${x(lower.length - 1 - i)},${y(lower[lower.length - 1 - i])}`).join(' ') + 'Z'} fill="#9c9bfa28" stroke="#b4b1f3" strokeWidth=".6"/>
    <path d={line(p.curved_terrain_m) + ' L498,130 L38,130 Z'} fill="#304f60" stroke="#77abaa"/>
    <path d={line(p.line_m)} stroke="#f3d58c" fill="none" strokeWidth="1.5" strokeDasharray="4 3"/>
    <text x="38" y="148">Ground antenna</text><text x="498" y="148" textAnchor="end">Aircraft · {format(length / 1000)} km</text>
  </svg><p className="caption">Curvature-adjusted terrain · {(fraction * 100).toFixed(0)}% Fresnel zone · {p.calculation_points.toLocaleString()} terrain samples</p></>;
}
