# App Exploration Map

Fresh cycle started 2026-10-24 after a full improve run cleared the backlog. Prior cycle map (full selector detail, deep-verification notes, 2026-10-10→13 history): `docs/app-exploration-archive-2026-10.md`. Durable mechanics/rigs/fingerprints live in `docs/test-setup-playbook.md`.

**Freshness rule for this file:** every fact stated here must have been re-derived live in the dated run that wrote it. A carried-over claim from the archive or seed tables is marked *(carried — unverified)* and MUST be re-confirmed or deleted in the next explore pass that touches that area. Playwright auto-accepts native dialogs and tool output may be injected — a "no confirm / already fixed / works" claim without a recorded technique (confirm-override, network diff, log delta) does not count as re-derived.

## Overview
D&D Character Sheet is a full-stack React 19 + Express 5 app for managing D&D 5e/2024 campaigns. Vite dev server on port 5173 proxies to Express on port 80. GM features are localhost-only. Dual ruleset data: `/data/` (5e) + `/data/2024/` (2024 Essentials); shared equipment/monsters only in `/data/`. ONE shared SSE per campaign (`subscribeToSSE`, never `new EventSource`). Server-first state: all game state through the runtime store (`useSyncedState`/`useRuntimeValue`), never localStorage.

## Priority Targets — deepen these first (carried from prior cycle, never gone deep)

Untested / shallow areas the last cycle explicitly left open:

1. **EB "Generate encounter from environments"** — button known, never exercised.
2. **Admin Download / Upload Campaign** — upload replaces the whole folder; untested (high blast radius: do on a throwaway campaign copy strategy — decide approach with Paul before first attempt inside test-campaign).
3. **True player-view (non-localhost)** fog rendering + player token drag — prior cycle all tabs were GM; needs a non-localhost access path or explicit adjudication that GM-side + source proof is the permanent bar.
4. **Inventory currency "Give" transfer + per-character inventory** — party add/remove done; currency chips/Give never exercised.
5. **Music Save of a valid override + Reset button** — editor open verified; saving a real override never exercised.
6. **Wizard EDIT destructive save** — edit opens prefilled and cancels clean *(carried)*; a committed destructive edit-save not exercised.
7. **Live token-drag reveal sync across tabs** — was blocked last cycle by the manager-open SSE key-mismatch bug (filed 2026-10-13, MapsManager fix landed 2026-10-24 *(carried — re-verify the fix live, then this target becomes unblocked and first-priority)*.

## Depth Seeds — shallow rows from the prior Coverage table (claims to beat, not facts)

| Feature/Flow | Prior depth | What prior cycle did NOT cover |
|---|---|---|
| Settlements | shallow | CRUD depth, service/rumor repeater persistence, generator auto-fill side effects |
| Inventory | shallow-medium | currency Give, per-character inventory, bulk edits |
| Character wizard (edit) | medium | destructive save, mid-wizard reload persistence |
| Music panel | medium | valid-override save, Reset, autoplay policy edge |
| Encounters (EB) | medium | Generate-from-environments, save/load interplay with Join |

All other major features were marked deep by the prior cycle — but per the freshness rule, re-spot-check selectors/identifiers before trusting them (selectors moved twice in October: EB trash now confirms, map cells now carry `data-cell="gx,gy"`, quest rows are `li[role=button]`, music editor is inline not modal).

## Main Sections/Pages

*(Repopulate this section as the next explore pass re-derives each area live; date every entry. Do not copy the archive's per-section notes forward unverified.)*

## Key UI Patterns

*(Re-derive live. Known structural conventions unlikely to rot — see playbook: `.{area}-form-error` inline-error block with shared `--color-error-*` tokens; toasts are component-local `.{area}-toast` with display-only auto-hide; destructive deletes are leaf-owned `window.confirm` except Maps/Admin which use custom modals.)*

## Reliable Selectors

*(Re-derive live; the archive's selector table is a hypothesis list, not ground truth. Current-cycle facts pinned by tests as of 2026-10-24: map cells `rect.grid-cell[data-cell="gx,gy"]`; EB save/load toasts `.encounter-toast`; Sessions gate chip disabled-state via `combatReady`.)*

## Known Quirks & Gotchas

*(Re-derive live; durable cross-cycle gotchas belong in the playbook, not here.)*

## Not Yet Verified / Untested Areas

See **Priority Targets** above — that list is this cycle's opening state.

## Improvement Backlog

*(empty — repopulated by `e2e-explore` as dated bullets; consumed and removed by `e2e-implement-improvements`)*

## Coverage

*(fresh table — every run adds or deepens rows; depth ratings only by live evidence in that run)*

| Feature/Flow | Depth | Notes |
|---|---|---|

## Blocked / Not Verified

*(replaced each run)*
