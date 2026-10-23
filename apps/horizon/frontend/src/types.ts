import type { components } from './api-schema';
type Complete<T> = T extends (infer U)[] ? Complete<U>[] : T extends object ? { [K in keyof T]-?: Complete<T[K]> } : T;
export type Project = Complete<components['schemas']['Project']>;
export type Waypoint = Complete<components['schemas']['Waypoint']>;
export type Radio = Complete<components['schemas']['RadioProfile']>;
export type State = 'green' | 'amber' | 'red' | 'unknown';
export type Mode = 'navigate' | 'draw' | 'station' | 'home' | 'operator';
export interface TerrainRecord { id: string; name: string; datum: string; bounds: number[]; resolution_m: number; synthetic: boolean; size_bytes: number; source: Record<string, unknown> | null }
export interface Job { id: string; kind: string; status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled'; done: number; total: number; error: string | null; elapsed_s?: number; stale?: boolean; project_hash: string }
export interface Link { state: State; margin_db: number | null; rx_dbm: number | null; free_space_db: number; diffraction_db: number; clearance_fraction: number; obstruction_m: number; clearance_m: number; los: boolean; reason: string | null }
export interface Sample { lon: number; lat: number; altitude_m: number | null; terrain_m: number | null; agl_m?: number; distance_m?: number; waypoint_index?: number | null; segment?: number; cell_dx?: number; cell_dy?: number; state: State; links: Record<string, Link>; reason: string | null; suggestion?: { status: string; agl_m: number | null; reason: string | null }; profile?: { distance_m: number[]; terrain_m: number[]; curved_terrain_m: number[]; line_m: number[]; fresnel_m: Record<string, number[]>; calculation_points: number } }
export interface Result { model: string; kind: string; created_at: string; project_hash: string; synthetic: boolean; required_radios: string[]; summary: Partial<Record<State, number>>; samples: Sample[]; limitations: string[]; warnings: string[] }
export interface Area { west: number; south: number; east: number; north: number; agl_m: number; cell_m: number }
export const colors: Record<State, string> = { green: '#60dbad', amber: '#f4c26b', red: '#f47775', unknown: '#82949d' };
export const stateLabels: Record<State, string> = { green: 'Meets criteria', amber: 'Marginal', red: 'Below threshold', unknown: 'Unknown' };
export const stateFor = (s: Sample, band: string): State => band === 'combined' ? s.state : s.links[band]?.state ?? 'unknown';
export const format = (n: number | null | undefined, digits = 1) => n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits);

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api/v1' + path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail));
  }
  return response.json();
}
export const json = (body: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export function download(name: string, contents: string, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
