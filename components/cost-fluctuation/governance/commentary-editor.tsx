'use client';
import { useState } from 'react';
import { commentaryActions, type GovernancePermissions } from '@/lib/cost-fluctuation/governance/presentation';
import { CommentaryStatusBadge } from './commentary-status-badge';

export type CommentaryView = { id: number; analysisKey: string; status: string; reason: string; reviewerNote?: string | null; preparedBy?: { id: number; name: string }; reviewedBy?: { id: number; name: string }; history?: Array<{ id: number; version: number; status: string; reason: string; reviewerNote?: string | null; createdAt?: string }> };

export function CommentaryEditor({ analysisKey, commentary, permissions, currentUserId, busy, onAction }: { analysisKey: string; commentary?: CommentaryView; permissions: GovernancePermissions; currentUserId?: number; busy: boolean; onAction: (action: 'draft'|'submit'|'return'|'review', payload?: string) => Promise<void> }) {
  const [reason, setReason] = useState(commentary?.reason ?? '');
  const [note, setNote] = useState('');
  const actions = commentaryActions(commentary?.status, permissions, commentary?.preparedBy?.id, currentUserId);
  return <aside className="space-y-4 rounded-xl border bg-white p-5" aria-label="Commentary workflow">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-medium uppercase text-slate-500">Exact analytical target</p><p className="break-all font-medium">{analysisKey}</p></div><CommentaryStatusBadge status={commentary?.status} /></div>
    {commentary?.status === 'RETURNED' && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Returned by checker.</strong><p>{commentary.reviewerNote}</p><p className="mt-1 text-xs">Edit and save to return this item to DRAFT before submitting again.</p></div>}
    {actions.immutable && <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">Reviewed commentary is immutable. Its approved explanation remains audit-visible.</div>}
    {actions.makerCheckerBlocked && <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">Maker/checker control: the preparer cannot return or review the same submitted commentary.</div>}
    <label className="block text-sm font-medium">Explanation<textarea className="mt-1 block min-h-32 w-full rounded border p-3 disabled:bg-slate-50" maxLength={5000} value={reason} disabled={!actions.canEdit || busy} onChange={(event) => setReason(event.target.value)} placeholder="Explain the business driver; accounting values cannot be edited here." /></label>
    {actions.canCheck && <label className="block text-sm font-medium">Checker note<textarea className="mt-1 block min-h-20 w-full rounded border p-3" maxLength={5000} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="Required when returning" /></label>}
    <div className="flex flex-wrap gap-2">{actions.canEdit && <button disabled={busy} className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => onAction('draft', reason)}>Save draft</button>}{actions.canSubmit && commentary && <button disabled={busy} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => onAction('submit')}>Submit to checker</button>}{actions.canCheck && <><button disabled={busy || !note.trim()} className="rounded bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => onAction('return', note)}>Return with note</button><button disabled={busy} className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => onAction('review', note)}>Mark reviewed</button></>}</div>
    {!permissions.canPrepare && !permissions.canReview && <p className="text-sm text-slate-500">Read-only access: your role cannot prepare or check commentary.</p>}
    {!!commentary?.history?.length && <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">Audit history ({commentary.history.length})</summary><ol className="mt-2 space-y-2">{commentary.history.map((item) => <li key={item.id} className="rounded bg-slate-50 p-2 text-sm"><strong>v{item.version} · {item.status}</strong><p className="whitespace-pre-wrap text-slate-700">{item.reason}</p>{item.reviewerNote && <p className="text-amber-800">Note: {item.reviewerNote}</p>}</li>)}</ol></details>}
  </aside>;
}
