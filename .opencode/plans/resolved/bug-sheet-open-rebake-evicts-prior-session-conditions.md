# Bug: fresh-tab sheet open can silently replace a character's change-data bucket, evicting prior-session runtime conditions

## Summary

Runtime `activeConditions` that a monster save lane granted in an EARLIER browser session (server-side truth confirmed via GET) vanish from the change-data bucket when a freshly-loaded tab selects the campaign and opens that character's sheet. The eviction lands ~2–8 s after the sheet mount as a FULL-STORE bucket REPLACEMENT — the same write also re-bakes `currentHitPoints` to the sheet-derived value — consistent with the sheet/campaign mount full-store re-bake racing the SSE connect-snapshot replay and winning with a disk/derived-only snapshot. Silent: zero log rows, zero console errors. Conditions granted in the SAME tab session survived every identical reload→select→open ride (4/4), which is the control face.

## Steps to reproduce

1. In `test-campaign` (GM tab, dev pair on :80/:5173), pre-select seed the victim via full-store POST so the save fail is guaranteed:
   `POST /api/campaigns/test-campaign/Wild_Sage_Druid` `{value:{activeBuffs:[{name:'Protection from Evil and Good',effect:'protection_from_evil_and_good'},{effect:'warding_bond',saveBonus:-30}], protectionFromEvilAndGoodWardedTypes:[...], activeConditions:[], hitPoints:200, currentHitPoints:200}}`.
2. Select campaign → Initiative → EB-join **Lamia** → open her stat block → arm target `Wild_Sage_Druid` → press the Corrupting Touch `[data-kind=save]` chip → Roll Save → failed save grants `activeConditions:['cursed','poisoned']` (ward blocks `charmed`).
3. **Without touching the WSD sheet**, GET `/api/campaigns/test-campaign/change-data` → confirm `Wild_Sage_Druid.activeConditions === ['cursed','poisoned']`.
4. Reload the tab (`page.goto`), click `test-campaign` to select, then within a few seconds click `Wild_Sage_Druid` in the sidebar (open her sheet). Wait ~6–8 s.
5. GET change-data again → `Wild_Sage_Druid.activeConditions` is `[]` (or the key is gone) and `currentHitPoints` has been re-baked from the curl-seeded 200 to the sheet-derived HP — i.e. the whole bucket was REPLACED. `ElderPaladin.activeConditions` (never sheet-opened) is untouched.

Observed 2/2 on prior-session grants (this run's short-rest ride and a dedicated bisect ride); one control ride that re-granted in-tab after the reload kept the conditions 8 s post-mount. The race window (SSE connect-replay of `change-<campaign>-<Char>` vs the mount re-bake) makes it flaky, not safe.

## Expected behavior

Opening a character sheet never silently evicts server-side runtime state. A sheet mount that needs to seed derived values must merge (scoped PATCH) or skip its full-store POST while the SSE connect replay for that bucket has not yet been adopted — never replace the bucket with a disk/derived snapshot that lacks runtime keys like `activeConditions`.

## Actual behavior

Step 5 GET shows the conditions silently gone (`[]`), HP re-baked to the sheet snapshot value, no `condition removed`/any log row, no console error. A curse that rules say persists ("until the curse ends") is erased by a player simply reloading and opening their own sheet. The bucket-replace also matches the documented §45/§32 law (full-store POST replaces; name-arrays merge) — the mount POST carries no `activeConditions`, so the server's `['cursed','poisoned']` is dropped.

## Likely location

Sheet/campaign mount write lane — guessing between two known siblings, both in the documented "full-store snapshot re-bake" family (GC-era pitfall: "after ANY sheet mount, the loaded tab's full-store snapshot re-bakes `activeCreatureName` over a post-load curl flip"):
- `seedCampaignRuntimeData` in `src/App.jsx` (app-load seeds `combatSummary`/`__campaign__`/`<Char>` within ~2.5 s — ops addendum).
- The sheet-mount `useSyncedState`/`setRuntimeObject` initial sync in `src/components/char-sheet/CharSheet.jsx` / `char-summary/CharSummary.jsx` (mount snapshot re-bake).
The race counterpart is the SSE connect snapshot replay (`server/routes/sse.js:27-34` replays all keys on every connect; §49).

## Suggested fix

Find the mount path that POSTs the character's FULL-STORE bucket (grep `seedCampaignRuntimeData` in App.jsx and any sheet-mount effect calling `setRuntimeObject`/full-store `POST /:campaign/:name`). Either (a) suppress the write when a server bucket already exists and the client mirror has not yet adopted the SSE replay for that key (`has()` guard, same pattern as `deleteRuntimeKey` idempotence), or (b) convert the seed to a scoped `PATCH /:campaign/:name` (server merges fields, name-keyed arrays merge per-record) so absent runtime keys can never be evicted. Investigation needed: instrument one fresh-load ride (log every POST the tab makes in the first 8 s) to name the exact producer before changing it.

## Severity

Data-integrity risk — routine user flow (reload, open your sheet) can silently destroy persisted adjudicated state (conditions, buffs) for the reopened character; flaky but 2/2 on the prior-session-grant face, and a 2024 Lamia curse is explicitly indefinite. Not "broken feature" because the lane mostly works — it works until the race lands.

## Resolution

**FIXED 2026-11-10 (fix run).**

### What was actually wrong

The "Likely location" guesses (`seedCampaignRuntimeData` / `CharSummary` mount seed) were both wrong. Stack-trace instrumentation of a fresh-load ride named the producer exactly: the persistence effect in **`CharConditions.jsx`** (the SP-109-era effect that saves `activeConditions` on mount/dep-change). `CharSheet` survives a sidebar character switch, so when the user switched INTO the victim character the effect re-ran with the PREVIOUS character's stale component state (typically `[]`) while the store mirror was ALREADY hydrated with the victim's server-granted `['cursed','poisoned']` (SSE connect replay adopted ~70 ms after campaign select — long before the write). The old SP-109 guard only skipped the UN-hydrated face (`!Array.isArray(raw) && empty state`), so the hydrated-but-stale face fell straight through to `setRuntimeValue(name, 'activeConditions', <stale>)`, and every `setRuntimeValue` POSTs the FULL store bucket as a server-side REPLACE — evicting the curse in total silence. The follow-on full-store POSTs (CharSheet `fanaticalFocusUsed`/`hitPoints` mount writes) then merely carried the already-emptied store. Live rides showed the eviction landing 31–9532 ms after the sheet click depending on component warmth — the "2–8 s after mount" figure was this same write, not a slower producer. Both suspect lanes from the bug file (App `seedCampaignRuntimeData`, CharSheet mount `hitPoints` re-bake) are local-only-seeded or superset-carrying and were exonerated by the trace: with the mirror hydrated, their snapshots keep `activeConditions` intact.

### Fix (minimal)

`src/components/char-sheet/char-summary/CharConditions.jsx`: the persist effect now echoes **the store's own content** instead of component state — `raw = getRuntimeValue(name,'activeConditions'); if (!Array.isArray(raw)) return; saveConditions(name, campaign, raw)`. Every genuine user edit already persists at its own handler (`handleConditionSave` calls `saveConditions` directly), so this lane is adoption-only: in production the echo is a `valuesEqual` no-op (same array reference → `setRuntimeValue` skips the POST entirely) and a foreign/stale list can no longer leave this lane. The SP-109 un-hydrated guard semantics are preserved (un-hydrated store ⇒ zero writes) and the hydrated-empty benign write-through is unchanged. No 2024 twin needed — CharConditions is ruleset-agnostic.

### Verification

- **Repro before fix (live, isolated Playwright contexts):** prior-session-grant face reproduced — real Lamia Corrupting Touch lane granted `['cursed','poisoned']` (GET + `condition applied` row), then fresh load → select → open WSD sheet → server `activeConditions: []` + `hitPoints` re-baked to 143, zero log rows, and the STORE-MUTATION TRAPPER caught the exact producer stack (`setRuntimeValue ← saveConditions ← CharConditions mount effect`, 31 ms post-click, 2/2 rides incl. a third via the poisoned-instrumentation first ride).
- **Re-verify after fix:** 3 fresh load→select→open rides (one preceded by a full real-grant session, one including a WSD→ElderPaladin→WSD switch re-ride of the exact producer lane): `activeConditions` stayed `['cursed','poisoned']` at 5 s and 9 s post-mount, badges rendered "Cursed, Poisoned", and the instrumented POST log shows **zero** `activeConditions:[]` bucket replaces against the victim. Same-session control stays green (re-grant through the lane: conds dedup-stable, PFEG `automation blocked` + `condition applied` rows intact); zero console errors.
- **Regression test:** `src/components/char-sheet/char-summary/CharConditions.staleSwitch.test.jsx` (4 tests) pins switch-with-hydrated-bucket, switch-from-empty-state, un-hydrated-switch-writes-nothing + post-switch hydration echo, and the handler-persistence lane. `npx vitest run src/components/char-sheet` → 569 files / 5452 tests passed (incl. all CharConditions sibling suites). `npm run lint` → clean (zero warnings). `node .opencode/plans/no-timers-guard.mjs` → OK.
- **Exit hygiene:** all Playwright rig tabs closed/blanked; admin API two-pass clears GET-verified `change-data {}` + `log []`; overlays `[]`; combat board swept with change-data; zero character-file writes.

