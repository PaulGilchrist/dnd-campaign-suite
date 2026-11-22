# Bug: campaign-store ghost keys survive campaign switch (AI config leaks across campaigns, console mounts live in a campaign with no aiConfig)

## Summary
When you switch campaigns in the same tab **without a page reload**, campaign-level runtime-store keys that exist in campaign A but not in campaign B persist in the shared `stores` Map under `characterKey = 'campaign'`. The GM's Admin panel for the new campaign then renders the OLD campaign's AI config — endpoint, model, and a fully mounted live referee console — even though the new campaign has `aiConfig` absent server-side. Any consumer write from that ghost face would POST the old campaign's values into the new campaign's change-data.

## Steps to reproduce
1. In `test-campaign`, seed an AI config (or use the Admin AI panel): `POST /api/campaigns/test-campaign/aiConfig` body `{"value":{"mode":"suggest","endpoint":"http://localhost:8001/v1","model":"capture-mock","provider":"openai"}}`.
2. In the same browser tab, sidebar → **Campaigns** (selection screen), then select `qa-starter` (a fresh throwaway with no change-data).
3. Open **Admin** in qa-starter.
4. Observe the AI config row: the endpoint input reads `http://localhost:8001/v1`, the Model select reads `capture-mock`, and the live AI ask console is mounted — although `GET /api/campaigns/qa-starter/aiConfig` returns `{"value":null}` (verified live via curl while the ghost face was up).
5. Wait 5+ seconds: the ghost never resolves. A full page reload fixes it (Admin then honestly hides the config row).

Control probe (run live 2026-11-22): the server answers `{"value":null}` for qa-starter's aiConfig at the same moment the UI displayed `:8001` — the delta is purely client-side; no disk/server leak.

## Expected behavior
Selecting a campaign must reset the client runtime store's campaign scope to that campaign's own change-data snapshot: keys absent from the new snapshot must not remain readable (or must be evicted), so the Admin AI panel shows the new campaign's real state (off/unset → collapsed row, no console, no traffic, per the `aiConfigLive` doctrine in `AiRefereeSection.jsx:11`).

## Actual behavior
The Admin panel shows the previous campaign's full AI config and mounts the live console for the new campaign. Console error output: none — it fails silently as a UI lie. Network: the ghost is never re-fetched or cleared (no request clears `campaign`-store keys on switch).

## Likely location (confident — code-read + live-proven face)
- `src/hooks/runtime/useRuntimeState.js:4` — `const stores = new Map()` keyed by `characterKey` only; `'campaign'` is a single global bucket shared by ALL campaigns.
- `src/App.jsx:317-326` `seedCampaignRuntimeData` — select-time hydration is seed-if-absent & skip-null (`if (!campaignStore.has(key) && value != null)`); it NEVER evicts keys absent from the new snapshot, and nothing clears the `'campaign'` store on switch.
- `src/hooks/runtime/useSyncedState.js` — the effect deps are `[characterKey, propertyName, store]`; `campaignName` is not a dep and the store object is identity-stable, so consumers like `AiRefereeSection.jsx:74` (`useSyncedState('campaign', 'aiConfig', null, campaignName)`) never re-read on campaign swap.

This is the ROOT MECHANISM of the already-known cleanup pain ("clear → re-enter surfaces select-rehydrated keys" two-pass law in the exploration map / playbook): the same never-evicted store explains both the admin-clear resurrection face and this cross-campaign leak.

## Suggested fix
On campaign selection (where `fetchCampaignChangeData`/`seedCampaignRuntimeData` runs, `App.jsx:595-602`), REPLACE the `'campaign'` store with the snapshot instead of seed-if-absent: `replaceRuntimeObject('campaign', serverData)` already exists and implements adopt-and-evict for character buckets (see `App.jsx:139-143` full-replace law). Mirror that semantics for the campaign store, then `notify('campaign')` so mounted consumers re-read. Caveats to check first:
- Keys the client puts in the `'campaign'` store that are NOT server change-data (locally derived/feature keys — audit `getStore('campaign').set(...)` producers, e.g. `campaignKeys.js` consumers) must be preserved or re-seeded, otherwise a full replace would evict them; if such keys exist, evict only keys previously hydrated from the snapshot (track the select-time key set) rather than the whole store.
- The seed-if-absent arm likely exists to protect values written earlier in the same select pass (SSE rehydration ordering) — re-verify the admin-clear two-pass scenario afterwards: with a replace-based seed the second clear pass should become unnecessary.

## Severity
Data integrity risk. The server gates writes on server-side config (a ghost-console ask would honestly 403/refuse with AI_OFF), but a GM pressing **Save AI config** on the ghost face persists the previous campaign's endpoint/model into the wrong campaign, and the UI misrepresents which campaigns have AI enabled — campaign switching without reload is the normal GM flow.

## Resolution
FIXED 2026-11-22 (live-verified in test-campaign + qa-starter throwaway).

**What was actually wrong** (root cause confirmed against the "Likely location", with one sharpening):
- Confirmed: `useRuntimeState.js` keeps ONE global `stores` Map and `'campaign'` is a single campaign-agnostic bucket; `App.jsx` `seedCampaignRuntimeData` was seed-if-absent & skip-null (never evicted); `useSyncedState` deps omit `campaignName`.
- **Sharpening the diagnosis**: the select-seed effect that called `seedCampaignRuntimeData` is gated on `computedCharacters.length > 0` — so for a fresh ZERO-character campaign (exactly the `qa-starter` repro) the change-data GET never even ran. A replace-based fix bolted onto that gate would have kept failing the witnessed face. The rescope therefore lives on its own gate.
- Producer audit (caveat 1 from the bug file): every non-test writer into the `'campaign'` store goes through a POSTing lane (`setRuntimeValue('campaign', …)` per-key POST; music via the `/music` change-data route; travel/loot save + DELETE). There are NO client-only campaign-store keys — a full adopt-and-evict is honest; no key-set tracking needed.

**Fix** (`src/App.jsx`):
- `seedCampaignRuntimeData` → `hydrateCampaignRuntimeData`: ADOPTS-AND-EVICTS the selected campaign's change-data snapshot via the existing `replaceRuntimeObject` (the same full-replace law the character-bucket SSE echoes follow), with null-valued snapshot entries left unadopted (never a stored null — the null-echo REMOVE doctrine). `replaceRuntimeObject` notifies on change, which wakes mounted consumers — so `useSyncedState` needed NO change (the store Map is mutated in place; its registered listener re-reads on notify).
- New effect gated on the ENTER seam `[campaignName, showCampaignSelection]` (campaign armed + picker left) runs it — works for zero-character campaigns and re-runs on same-campaign re-select, so the Admin-clear → re-select seam re-reads server truth in ONE pass (the select-rehydrated two-pass law retires).
- `fetchCampaignChangeData` now returns `null` on fetch failure (vs `{}`): "unknown" must not evict the live scope; server-first callers treat null as "no snapshot".
- Stale comment references renamed in `savePromptService.js`, `campaignKeys.js`, `campaignKeys.victory-stamp.test.js`.

**Files changed**: `src/App.jsx`; test-harness migrations for the new select-seam `replaceRuntimeObject` call (`src/App.runtime-events.test.jsx` spy-slate clear + mock-export additions in `App.map-navigation`, `App.state-transitions`, `App.map-activate`, `App.map-unavailable`, `App.map-self-heal`, `App.map-deactivated-advisory`, `App.upload-input`, `App.loading-overlay`, `App.post-restore`); comment-only: `src/services/combat/conditions/savePromptService.js`, `src/services/automation/common/campaignKeys.js`, `src/services/automation/common/campaignKeys.victory-stamp.test.js`. New test: `src/App.campaign-store-rescope.test.jsx` (5 pins).

**Verification**:
- Live repro re-run pre-fix (same tab, no reload): test-campaign Admin showed the seeded aiConfig (real); switched to `qa-starter` → Admin showed ghost endpoint `http://localhost:8001/v1` + Model `capture-mock` + mounted `Ask AI referee` console while `GET /qa-starter/aiConfig` = `{"value":null}` — never self-resolved.
- Post-fix live: same no-reload switch now lands the honest face — "AI Referee not configured", Mode=`off`, NO endpoint/model values, NO console, and a B→A round trip re-hydrates A's real config (eviction not sticky). qa-starter's server aiConfig stayed `null` the whole session (zero ghost writes). Console: only the honest `/api/ai/models` 502s from the dead capture-mock fixture.
- `npx vitest run src/App.campaign-store-rescope.test.jsx` 5/5 (and 3/5 FAIL against a seed-if-absent probe — genuine regression locks); touched folders 26 files / 288 pass; `npm run lint` clean; `no-timers-guard` OK.
- Cleanup: Admin Clear Change Data + Clear Campaign Log on test-campaign (change-data `{}` + log `[]`, files absent cold); qa-starter API-deleted; `campaigns/` back to the 5 baseline folders.
