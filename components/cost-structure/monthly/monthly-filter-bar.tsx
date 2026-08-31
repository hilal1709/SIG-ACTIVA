'use client';

type Props = { companies: string[]; years: number[]; company: string; year: number | null; status: string; onCompany: (value: string) => void; onYear: (value: number) => void; onStatus: (value: string) => void };
const statuses = ['ALL', 'SOURCE_VALIDATION', 'SOURCE_RECONCILED', 'CALCULATED', 'FINALIZED'];

export default function MonthlyFilterBar(props: Props) {
  const control = 'min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm sm:w-auto';
  return <div className="grid min-w-0 gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex sm:flex-wrap sm:items-end">
    <label className="min-w-0 text-xs font-medium text-muted-foreground">Company Code<select aria-label="Company Code" className={`${control} mt-1 block`} value={props.company} onChange={(event) => props.onCompany(event.target.value)}><option value="ALL">ALL</option>{props.companies.map((company) => <option key={company}>{company}</option>)}</select></label>
    <label className="min-w-0 text-xs font-medium text-muted-foreground">Fiscal Year<select aria-label="Fiscal Year" className={`${control} mt-1 block`} value={props.year ?? ''} onChange={(event) => props.onYear(Number(event.target.value))}>{props.years.map((year) => <option key={year}>{year}</option>)}</select></label>
    <label className="min-w-0 text-xs font-medium text-muted-foreground">Status<select aria-label="Status" className={`${control} mt-1 block`} value={props.status} onChange={(event) => props.onStatus(event.target.value)}>{statuses.map((status) => <option key={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
  </div>;
}
