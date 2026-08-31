import { ZERO } from './math';
import type { AnalyticalSnapshot, SnapshotBasis, SnapshotGroup, SnapshotItem, SnapshotNature } from './types';

const sort = <T extends SnapshotItem>(items: T[]) => items.sort((a,b) => a.order-b.order || a.code.localeCompare(b.code) || a.key.localeCompare(b.key));
function sumItems<T extends SnapshotItem>(sets: T[][]): T[] {
  const map = new Map<string,T[]>(); for (const set of sets) for (const item of set) map.set(item.key,[...(map.get(item.key) ?? []),item]);
  return sort([...map.values()].map(values => ({...values[0],amount:values.reduce((s,v)=>s.add(v.amount),ZERO)})));
}
export function aggregateSnapshots(snapshots: AnalyticalSnapshot[]): AnalyticalSnapshot {
  if (!snapshots.length) throw new Error('Cannot aggregate an empty snapshot set.');
  const bases = sumItems(snapshots.map(s=>s.bases)) as SnapshotBasis[];
  for (const basis of bases) {
    const occurrences=snapshots.flatMap(s=>s.bases.filter(b=>b.key===basis.key)); basis.groups=sumItems(occurrences.map(b=>b.groups)) as SnapshotGroup[];
    for (const group of basis.groups) {
      const groups=occurrences.flatMap(b=>b.groups.filter(g=>g.key===group.key)); group.natures=sumItems(groups.map(g=>g.natures)) as SnapshotNature[];
      for (const nature of group.natures) nature.items=sumItems(groups.flatMap(g=>g.natures.filter(n=>n.key===nature.key)).map(n=>n.items));
    }
  }
  return {...snapshots[0],amount:snapshots.reduce((s,v)=>s.add(v.amount),ZERO),bases,lineage:snapshots.flatMap(s=>s.lineage)};
}
