'use client';

import CostModuleFrame from '@/app/components/CostModuleFrame';

export default function MonthlyCostStructureLayout({ children }: { children: React.ReactNode }) {
  return (
    <CostModuleFrame title="Cost Structure Bulanan">
      {children}
    </CostModuleFrame>
  );
}
