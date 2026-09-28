import type { WorkbookStyleBlueprint } from './types';
import { company2000StyleBlueprint } from './company-2000';
import { company7000StyleBlueprint } from './company-7000';

const registry: Readonly<Record<string, WorkbookStyleBlueprint>> = {
  '2000': company2000StyleBlueprint,
  '7000': company7000StyleBlueprint,
};

export function getWorkbookStyleBlueprint(companyCode: string) {
  const blueprint = registry[companyCode];
  if (!blueprint) throw new Error(`Static workbook style blueprint tidak tersedia untuk company ${companyCode}.`);
  return blueprint;
}
