import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { GeoJSONSource, Map, Marker } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { colors, stateFor, type Area, type Mode, type Project, type Result, type TerrainRecord } from './types';

const protocol = new Protocol();
maplibregl.setWorkerUrl(workerUrl);
maplibregl.addProtocol('pmtiles', protocol.tile);
const collection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
const feature = (geometry: Geometry, properties = {}): Feature => ({ type: 'Feature', geometry, properties });
interface Props {
  project: Project; terrain: TerrainRecord[]; result: Result | null; previous: Result | null;
  band: string; mode: Mode; selected: number | null; fitKey: number;
  onPoint: (lon: number, lat: number) => void;
  onMove: (kind: string, index: number, lon: number, lat: number) => void;
  onSelect: (index: number) => void; onSample: (index: number) => void;
  onBounds: (area: Area) => void; onError: (message: string) => void;
  basemap: { id: string; attribution: string; tileType?: number } | null;
}
export default function MapView(props: Props) {
  const container = useRef<HTMLDivElement>(null), map = useRef<Map | null>(null);
  const latest = useRef(props); latest.current = props;
  const markers = useRef<Marker[]>([]);
  useEffect(() => {
    const m = new Map({ container: container.current!, center: [props.project.station.lon, props.project.station.lat], zoom: 11,
      style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#152a30' } }] },
      attributionControl: false, maxZoom: 18, minZoom: 3 });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    m.on('error', e => latest.current.onError('Map: ' + e.error.message));
    m.on('click', e => {
      const p = latest.current;
      if (p.mode !== 'navigate') { p.onPoint(e.lngLat.lng, e.lngLat.lat); return; }
      if (m.getLayer('coverage')) {
        const features = m.queryRenderedFeatures(e.point, { layers: ['coverage', 'route-analysis'] });
        const f = features.find(f => f.properties?.index != null);
        if (f) p.onSample(Number(f.properties.index));
      }
    });
    m.on('moveend', () => {
      const b = m.getBounds();
      latest.current.onBounds({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), agl_m: 60, cell_m: 200 });
    });
    m.on('load', () => {
      m.addSource('terrain-raster', { type: 'raster', tiles: [], tileSize: 256, attribution: 'USGS 3DEP / selected terrain · bare earth' });
      m.addLayer({ id: 'terrain-raster', type: 'raster', source: 'terrain-raster', paint: { 'raster-opacity': 0.65, 'raster-fade-duration': 0 } });
      for (const id of ['coverage', 'previous', 'route', 'route-analysis', 'footprints', 'fences']) m.addSource(id, { type: 'geojson', data: collection([]) });
      m.addLayer({ id: 'coverage', type: 'fill', source: 'coverage', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.27 } });
      m.addLayer({ id: 'footprints', type: 'line', source: 'footprints', paint: { 'line-color': '#779b96', 'line-dasharray': [3, 3], 'line-width': 1 } });
      m.addLayer({ id: 'fences', type: 'line', source: 'fences', paint: { 'line-color': '#efad71', 'line-dasharray': [2, 2], 'line-width': 2 } });
      m.addLayer({ id: 'previous', type: 'line', source: 'previous', paint: { 'line-color': '#e6edf3', 'line-opacity': 0.5, 'line-width': 2, 'line-dasharray': [2, 3] } });
      m.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#78bbc6', 'line-width': 3, 'line-dasharray': [2, 2] } });
      m.addLayer({ id: 'route-analysis', type: 'line', source: 'route-analysis', paint: { 'line-color': ['get', 'color'], 'line-width': 5 } });
      update(m, latest.current);
      m.fire('moveend');
    });
    map.current = m;
    const observer = new ResizeObserver(() => m.resize()); observer.observe(container.current!);
    return () => { observer.disconnect(); markers.current.forEach(marker => marker.remove()); m.remove(); map.current = null; };
  }, []);

  function update(m: Map, p: Props) {
    if (!m.getSource('route')) return;
    const route = p.project.waypoints.map(w => [w.lon, w.lat]);
    (m.getSource('route') as GeoJSONSource).setData(collection(route.length > 1 ? [feature({ type: 'LineString', coordinates: route })] : []));
    const lines: Feature[] = [], cells: Feature[] = [];
    p.result?.samples.forEach((s, i, all) => {
      const color = colors[stateFor(s, p.band)];
      if (s.cell_dx && s.cell_dy) {
        const x = s.cell_dx / 2, y = s.cell_dy / 2;
        cells.push(feature({ type: 'Polygon', coordinates: [[[s.lon - x, s.lat - y], [s.lon + x, s.lat - y], [s.lon + x, s.lat + y], [s.lon - x, s.lat + y], [s.lon - x, s.lat - y]]] }, { color, index: i }));
      } else if (i && s.distance_m !== all[i - 1].distance_m) {
        lines.push(feature({ type: 'LineString', coordinates: [[all[i - 1].lon, all[i - 1].lat], [s.lon, s.lat]] }, { color, index: i }));
      }
    });
    (m.getSource('coverage') as GeoJSONSource).setData(collection(cells));
    (m.getSource('route-analysis') as GeoJSONSource).setData(collection(lines));
    const prev = p.previous?.kind !== 'coverage' ? p.previous?.samples.map(s => [s.lon, s.lat]) : null;
    (m.getSource('previous') as GeoJSONSource).setData(collection(prev && prev.length > 1 ? [feature({ type: 'LineString', coordinates: prev })] : []));
    const bounds = p.terrain.filter(t => p.project.terrain_ids.includes(t.id)).map(t => {
      const [w, s, e, n] = t.bounds; return feature({ type: 'LineString', coordinates: [[w, s], [e, s], [e, n], [w, n], [w, s]] });
    });
    (m.getSource('footprints') as GeoJSONSource).setData(collection(bounds));
    const source = p.project.source?.document as Record<string, any> | null;
    const fences: Feature[] = [];
    for (const poly of source?.geoFence?.polygons ?? []) {
      const points = poly.polygon.map((v: number[]) => [v[1], v[0]]);
      if (points.length > 2) fences.push(feature({ type: 'LineString', coordinates: [...points, points[0]] }));
    }
    for (const circle of source?.geoFence?.circles ?? []) {
      const center = circle.circle?.center, radius = circle.circle?.radius;
      if (center && radius) {
        const pts = Array.from({ length: 65 }, (_, i) => {
          const angle = i / 64 * Math.PI * 2;
          return [center[1] + Math.cos(angle) * radius / (111320 * Math.cos(center[0] * Math.PI / 180)), center[0] + Math.sin(angle) * radius / 111320];
        });
        fences.push(feature({ type: 'LineString', coordinates: pts }));
      }
    }
    (m.getSource('fences') as GeoJSONSource).setData(collection(fences));
    m.getCanvas().style.cursor = p.mode === 'navigate' ? '' : 'crosshair';
  }

  useEffect(() => { if (map.current) update(map.current, props); }, [props.project, props.result, props.previous, props.band, props.mode, props.terrain]);
  useEffect(() => {
    const m = map.current; if (!m) return;
    const set = () => {
      const src = m.getSource('terrain-raster') as maplibregl.RasterTileSource;
      src?.setTiles([`${location.origin}/api/v1/terrain/tiles/{z}/{x}/{y}.png?ids=${props.project.terrain_ids.join(',')}`]);
    };
    if (m.getSource('terrain-raster')) set(); else m.once('load', set);
    return () => { m.off('load', set); };
  }, [props.project.terrain_ids.join(','), props.terrain]);
  useEffect(() => {
    const m = map.current; if (!m) return;
    markers.current.forEach(marker => marker.remove()); markers.current = [];
    const add = (kind: string, index: number, lon: number, lat: number, label: string, title: string) => {
      const el = document.createElement('button'); el.className = `map-pin ${kind} ${index === props.selected && kind === 'waypoint' ? 'selected' : ''}`;
      el.textContent = label; el.title = title; el.setAttribute('aria-label', title);
      el.onclick = e => { e.stopPropagation(); if (kind === 'waypoint') latest.current.onSelect(index); };
      const marker = new Marker({ element: el, draggable: !props.project.source?.readonly }).setLngLat([lon, lat]).addTo(m);
      marker.on('dragend', () => { const pos = marker.getLngLat(); latest.current.onMove(kind, index, pos.lng, pos.lat); });
      markers.current.push(marker);
    };
    props.project.waypoints.forEach((w, i) => add('waypoint', i, w.lon, w.lat, String(i + 1).padStart(2, '0'), `Waypoint ${i + 1}`));
    add('home', -1, props.project.home.lon, props.project.home.lat, 'H', 'Planned aircraft home');
    add('station', -1, props.project.station.lon, props.project.station.lat, 'G', 'Ground antenna');
    if (props.project.operator) add('operator', -1, props.project.operator.lon, props.project.operator.lat, 'O', 'Operator');
  }, [props.project.waypoints, props.project.station, props.project.home, props.project.operator, props.selected]);
  useEffect(() => {
    const m = map.current; if (!m) return;
    const points = [[props.project.station.lon, props.project.station.lat], ...props.project.waypoints.map(w => [w.lon, w.lat])];
    const b = new maplibregl.LngLatBounds(); points.forEach(p => b.extend(p as [number, number]));
    m.fitBounds(b, { padding: 85, maxZoom: 13, duration: 600 });
  }, [props.fitKey]);
  useEffect(() => {
    const m = map.current; if (!m) return;
    const set = () => {
      if (m.getLayer('local-basemap')) m.removeLayer('local-basemap');
      if (m.getSource('local-basemap')) m.removeSource('local-basemap');
      if (!props.basemap) return;
      // Raster PMTiles need no remote fonts/styles. Vector archives are retained
      // but rejected by the UI until a complete offline style is supplied.
      m.addSource('local-basemap', { type: 'raster', url: `pmtiles://${location.origin}/api/v1/basemaps/${props.basemap.id}.pmtiles`, tileSize: 256, attribution: props.basemap.attribution });
      m.addLayer({ id: 'local-basemap', type: 'raster', source: 'local-basemap', paint: { 'raster-opacity': 0.6 } }, 'coverage');
    };
    if (m.getSource('terrain-raster')) set(); else m.once('load', set);
    return () => { m.off('load', set); };
  }, [props.basemap]);
  return <div className="map-canvas" ref={container} data-testid="mission-map"/>;
}
