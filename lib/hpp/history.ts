import type { HppRow } from '../../app/hpp-cost-intelligence/model';

export const HPP_MAX_OBSERVATIONS = 120000;
export const HPP_MAX_COMBINATIONS = 50000;
export type HppMonthlyObservation = {
  period: number;
  materialCode: string;
  materialName: string;
  plant: string;
  cogm: string | number | null;
  deliveryQty: string | number | null;
};

export function parseHppYear(value: string | null): number | null {
  if (value === null) return null;
  if (!/^\d{4}$/.test(value)) throw new Error('Tahun tidak valid');
  const year = Number(value);
  if (year < 2000 || year > 2100) throw new Error('Tahun di luar rentang 2000–2100');
  return year;
}

function observationValue(value: string | number | null): number | null {
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') throw new Error('Nilai observasi tidak valid');
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Nilai observasi tidak valid');
  return number;
}

// Input consists only of the selected year's current published monthly versions.
// Latest available monthly description wins; null and numeric zero stay distinct.
export function pivotHppHistory(observations: readonly HppMonthlyObservation[]): HppRow[] {
  const rows = new Map<string, { row: HppRow; latest: number; months: Set<number> }>();
  if (observations.length > HPP_MAX_OBSERVATIONS) throw new Error('Batas observasi HPP terlampaui');
  for (const o of observations) {
    if (!Number.isInteger(o.period) || o.period < 1 || o.period > 12) throw new Error('Periode tidak valid');
    const id = JSON.stringify([o.materialCode, o.plant]);
    let item = rows.get(id);
    if (!item) {
      if (rows.size >= HPP_MAX_COMBINATIONS) throw new Error('Batas kombinasi HPP terlampaui');
      item = { row: { code: o.materialCode, name: o.materialName, plant: o.plant, c: Array(12).fill(null), q: Array(12).fill(null) }, latest: o.period, months: new Set() };
      rows.set(id, item);
    }
    if (item.months.has(o.period)) throw new Error('Duplikasi observasi material–plant–periode');
    item.months.add(o.period);
    item.row.c[o.period - 1] = observationValue(o.cogm);
    item.row.q[o.period - 1] = observationValue(o.deliveryQty);
    if (o.period > item.latest) {
      item.row.name = o.materialName;
      item.latest = o.period;
    }
  }
  return [...rows.values()].map(x => x.row).sort((a,b) => a.code.localeCompare(b.code) || a.plant.localeCompare(b.plant));
}
