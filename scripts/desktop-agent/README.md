# SIG Activa Desktop Agent — phase 5 pilot

One Windows PowerShell 5.1 agent, not an SAP extractor. Existing SAP engines remain unchanged. It polls the generic /api/desktop-agent endpoint with a per-device bearer token and dispatches typed jobs to a locally controlled catalog. HPP_EXTRACT is the first implemented server handler. Other modules will add their own server job handler and local catalog entry; no new agent installation is required. No arbitrary remote command, script download, credential collection or SAP posting.

## Start the pilot
- Apply only the reviewed additive phase 5 SQL through the established Supabase migration authority (not the legacy Prisma chain).
- Open HPP → SAP Data Sync as ADMIN_SYSTEM. Register a device and copy the token once. Agent tokens are hashed on the server.
- Copy catalog.example.json to catalog.json locally. Keep Synthetic until the real adapter is verified.
- Run Windows PowerShell 5.1, as the interactive SAP user, without administrator installation:

  powershell.exe -NoProfile -File .\Run-DesktopAgent.ps1 -BaseUrl https://YOUR-APP -CatalogPath .\catalog.json

Enter the device token at the secure prompt. For a one-shot poll add -Once. For later unattended startup use -TokenFile <private path> -SaveToken once, then omit -SaveToken; Windows DPAPI binds it to that user/machine. Execution policy and SAP GUI scripting authorization must already permit the local scripts. Do not bypass company policy. Optional protected preview bypass: authorized owner supplies a local DPAPI-encrypted SecureString file via -PreviewBypassFile. Do not put secrets in Git or chat.

## Reuse existing SAP script
The HPP extraction script already developed is not recreated. Its exact launcher path, accepted period/year parameters and final output location have not been recovered from the accessible files. Once identified, set HPP_EXTRACT mode to LocalAdapter and adapterPath to a reviewed local wrapper. The wrapper invokes the original BAT/VBS/PS1 with its existing parameters, waits for completion, verifies fresh output, converts its workbook Lembar1 to the normalized monthly result and exits. No need to edit the extraction logic. The agent passes only -RequestPath and -ResultPath; JSON request has year, period, scope {code,name,plant}[]; response has year, period, mode SAP_SCRIPT, rows {code,name,plant,cogm,deliveryQty}[] with exact scope/descriptions, decimals as invariant strings or null. Do not silently normalize units, missing data or formulas. Use output from the original SAP extraction, not synthetic fixtures. Limit 1000 rows/3 MB, <25 minutes. No real adapter claimed verified yet.

## Operational boundaries
One running HPP job per device, one open job per period. 30-minute lease, cancelled/expired jobs cannot overwrite current jobs. Network response retry uses same lease and payload; no automatic SAP rerun. Poll every 15 seconds when idle; running script may look offline. Review required, synthetic mode never publishable; real-source publication is disabled by default unless HPP_AGENT_SAP_PUBLISH_ENABLED=true is explicitly set after golden reconciliation. Device revocation cancels open jobs. Cancel on web does not kill a running local process; do not start another runner on same SAP session. Scope uses latest published baseline in same year, at/before requested month. Add new material scope via controlled Excel baseline. Local output can contain confidential data; keep in private user folder and retain according to company policy. Schedule only in logged-in interactive session; no automatic scheduling configured.

Acceptance: role restrictions, machine authentication, exact scope and decimals, duplicate job/lease, revoked device, stale review, synthetic blocked publish, isolated Windows smoke test and real SAP golden reconciliation. Server code must be built and DB migration verified before connecting the agent. Other modules are not yet connected.
