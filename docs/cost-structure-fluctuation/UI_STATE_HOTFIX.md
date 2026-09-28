# Cost Structure UI / State Hotfix

This hotfix addresses production issues observed during the Company 2000 golden E2E gate:

- `/cost-structure/monthly` now restores the standard SIG ACTIVA Sidebar and Header shell.
- Phase D work queue shows only non-zero UNMAPPED COAs as actionable blockers.
- Zero-amount UNMAPPED COAs remain explicit but are shown as non-blocking informational rows/counts.
- Re-running Phase D readiness after a successful calculation no longer downgrades a ready `CALCULATED` or `COST_STRUCTURE_RECONCILED` period back to `SOURCE_RECONCILED`.

No accounting formula, mapping master, schema, or database migration is changed by this hotfix.
