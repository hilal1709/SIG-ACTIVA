import 'server-only';

import { prisma } from '@/lib/prisma';

export function getActiveCostCompanies() {
  return prisma.costCompany.findMany({
    where: { active: true },
    orderBy: { companyCode: 'asc' },
  });
}

export function getCostGroupsForCompany(companyCode: string) {
  return prisma.costGroup.findMany({
    where: {
      active: true,
      company: {
        companyCode,
        active: true,
      },
    },
    orderBy: { displayOrder: 'asc' },
  });
}
