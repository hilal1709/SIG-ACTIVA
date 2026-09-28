'use client';
import { useMemo, useState } from 'react';
import CompanyPeriodGroup from './company-period-group';
import { availableYears, filterPeriods, groupPeriods, latestYear } from './explorer-utils';
import MonthlyFilterBar from './monthly-filter-bar';
import type { MonthlyPeriod } from './types';

export default function MonthlyPeriodExplorer({ periods }: { periods: MonthlyPeriod[] }) {
  const companies = useMemo(() => [...new Set(periods.map((p) => p.companyCode))].sort(), [periods]);
  const [company, setCompany] = useState('ALL');
  const [year, setYear] = useState<number | null>(() => latestYear(periods));
  const [status, setStatus] = useState('ALL');
  const years = availableYears(periods, company);
  const visible = groupPeriods(filterPeriods(periods, company, year, status));
  const selectCompany = (next: string) => { setCompany(next); const nextYears = availableYears(periods, next); if (year === null || !nextYears.includes(year)) setYear(nextYears[0] ?? null); };
  return <div className="min-w-0 space-y-4"><MonthlyFilterBar companies={companies} years={years} company={company} year={year} status={status} onCompany={selectCompany} onYear={setYear} onStatus={setStatus} />
    {Object.keys(visible).length === 0 ? <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">Belum ada periode Cost Structure untuk filter ini.</div> : Object.entries(visible).sort(([a], [b]) => a.localeCompare(b)).map(([code, items]) => <CompanyPeriodGroup key={code} companyCode={code} periods={items} />)}
  </div>;
}
