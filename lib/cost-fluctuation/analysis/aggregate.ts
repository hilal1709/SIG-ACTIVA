import { ZERO } from './math';
import type { AnalyticalSnapshot, SnapshotGroup, SnapshotItem, SnapshotNature } from './types';

function mergeItems<T extends SnapshotItem>(collections: T[][], children: (value: T) => SnapshotItem[] | undefined, attach: (base: T, values: SnapshotItem[]) => T): T[] {
  const all = new Map<string, T[]>();
  for (const collection of collections) for (const item of collection) all.set(item.key, [...(all.get(item.key) ?? []), item]);
  return [...all.values()].map((values) => attach({ ...values[0], amount: values.reduce((sum, item) => sum.add(item.amount), ZERO) }, mergeItems(values.map((value) => children(value) ?? []), () => undefined, (item) => item))).sort((a, b) => a.order - b.order || a.code.localeCompare(b.code) || a.key.localeCompare(b.key));
}

export function aggregateSnapshots(snapshots: AnalyticalSnapshot[]): AnalyticalSnapshot {
  if (!snapshots.length) throw new Error('Cannot aggregate an empty snapshot set.');
  const groups = mergeItems(snapshots.map((item) => item.groups), (group) => group.natures, (group, natures) => ({ ...group, natures: natures as SnapshotNature[] })) as SnapshotGroup[];
  for (const group of groups) group.natures = mergeItems(snapshots.map((s) => s.groups.find((g) => g.key === group.key)?.natures ?? []), (nature) => nature.items, (nature, items) => ({ ...nature, items })) as SnapshotNature[];
  return { ...snapshots[0], amount: snapshots.reduce((sum, item) => sum.add(item.amount), ZERO), groups, lineage: snapshots.flatMap((item) => item.lineage) };
}
