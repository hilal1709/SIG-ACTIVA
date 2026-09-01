const styles: Record<string, string> = { DRAFT: 'bg-slate-100 text-slate-700', SUBMITTED: 'bg-blue-100 text-blue-800', RETURNED: 'bg-amber-100 text-amber-800', REVIEWED: 'bg-emerald-100 text-emerald-800' };
export function CommentaryStatusBadge({ status = 'OPEN' }: { status?: string }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}
