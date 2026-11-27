export type Observation = number | null;
export type HppRow = { code: string; name: string; plant: string; c: Observation[]; q: Observation[] };
export type Status = 'alert' | 'up' | 'down' | 'flat' | 'quality';
export type SortKey = 'code' | 'name' | 'plant' | 'base' | 'cur' | 'dev' | 'qty' | 'state';
export const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
export const key = (d: HppRow) => d.code + '|' + d.plant;
export const positive = (v: Observation): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
export const fmt = (v: Observation, digits = 0) => v === null ? '—' : v.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const pct = (v: Observation) => v === null ? '—' : (v > 0 ? '+' : '') + fmt(v, 1) + '%';
export function delta(d: HppRow, current: number, base: number): Observation {
  const a = d.c[current], b = d.c[base];
  return positive(a) && positive(b) ? (a / b - 1) * 100 : null;
}
export function status(d: HppRow, current: number, base: number, threshold: number): Status {
  const v = delta(d, current, base);
  return v === null ? 'quality' : v >= threshold ? 'alert' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
}
export function statusLabel(d: HppRow, current: number, base: number, threshold: number): string {
  const s = status(d, current, base, threshold);
  if (s !== 'quality') return { alert: 'Naik ≥ ambang', up: 'Naik', down: 'Turun', flat: 'Tetap' }[s];
  const a = d.c[current], b = d.c[base];
  return a === null ? 'COGM kosong' : a === 0 ? 'COGM nol' : a < 0 ? 'COGM negatif' : b === null ? 'Pembanding kosong' : b === 0 ? 'Pembanding nol' : 'Pembanding negatif';
}
export function summarize(rows: HppRow[], current: number, base: number, threshold: number) {
  const comparable = rows.filter(d => delta(d, current, base) !== null);
  const ups = comparable.filter(d => delta(d, current, base)! > 0).sort((a,b) => delta(b,current,base)! - delta(a,current,base)!);
  const downs = comparable.filter(d => delta(d, current, base)! < 0).sort((a,b) => delta(a,current,base)! - delta(b,current,base)!);
  return { available: rows.filter(d => d.c[current] !== null).length, comparable, ups, downs, alerts: ups.filter(d => delta(d,current,base)! >= threshold), missing: rows.filter(d => d.c[current] === null).length, zero: rows.filter(d => d.c[current] === 0).length, zeroQty: rows.filter(d => d.q[current] === 0).length, invalidBase: rows.filter(d => !positive(d.c[base])).length };
}
export function validateSnapshot(input: unknown): HppRow[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50000) throw new Error('Snapshot harus berisi 1–50.000 kombinasi.');
  const seen = new Set<string>();
  const series = (v: unknown): v is Observation[] => Array.isArray(v) && v.length === 12 && v.every(x => x === null || (typeof x === 'number' && Number.isFinite(x)));
  return input.map((value: unknown, index: number) => {
    if (typeof value !== 'object' || value === null) throw new Error('Baris tidak valid: ' + (index + 1));
    const d = value as Record<string, unknown>;
    if (typeof d.code !== 'string' || !d.code.trim() || typeof d.name !== 'string' || !d.name.trim() || typeof d.plant !== 'string' || !d.plant.trim() || !series(d.c) || !series(d.q)) throw new Error('Format baris tidak valid: ' + (index + 1));
    const row = { code: d.code, name: d.name, plant: d.plant, c: d.c, q: d.q };
    if (seen.has(key(row))) throw new Error('Duplikasi material–plant: ' + key(row));
    seen.add(key(row));
    return row;
  });
}
export function latestPeriod(rows: HppRow[]): number {
  for (let i = 11; i >= 0; i--) if (rows.some(d => d.c[i] !== null || d.q[i] !== null)) return i;
  return 0;
}
export function sortRows(rows: HppRow[], column: SortKey, asc: boolean, current: number, base: number, threshold: number) {
  const value = (d: HppRow) => ({ code:d.code, name:d.name, plant:d.plant, base:d.c[base], cur:d.c[current], dev:delta(d,current,base), qty:d.q[current], state:statusLabel(d,current,base,threshold) })[column];
  return [...rows].sort((a,b) => {
    const x = value(a), y = value(b);
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return (typeof x === 'number' && typeof y === 'number' ? x-y : String(x).localeCompare(String(y))) * (asc ? 1 : -1);
  });
}
export function makeCsv(rows: HppRow[], current: number, base: number, threshold: number): string {
  const values = [['Tahun','Periode analisis','Periode pembanding','Kode material','Deskripsi','Plant','COGM pembanding','COGM analisis','Deviasi (%)','Deliv Qty','Status'], ...rows.map(d => [2026, months[current], months[base], d.code, d.name, d.plant, d.c[base], d.c[current], delta(d,current,base), d.q[current], statusLabel(d,current,base,threshold)])];
  // Prevent spreadsheet formula injection from user-provided text; preserve numeric negatives.
  return '\uFEFF' + values.map(row => row.map(v => {
    let s = String(v ?? '');
    if (typeof v === 'string' && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(';')).join('\r\n');
}
