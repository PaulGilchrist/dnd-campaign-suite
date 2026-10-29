# Concentration prompt stays live on passive tabs after resolution — stale client can re-roll the save (duplicate saves/results per damage event)

## Summary
When a PC takes damage while concentrating, a concentration-save prompt (`concentrationPrompt-<Target>` change-data key) is queued and `ConcentrationPromptModal` opens on EVERY connected client. Once one client rolls and clears the prompt, the other clients' modals never close — and their "Roll Con Save" button still works, producing a SECOND save roll and a second `roll/concentration-save` log entry for the same damage event. A stale second roll that fails would also process a concentration break for a save the first (canonical) resolution succeeded, and result consumption is window-local (`window.dispatchEvent('concentration-result')`), so the winning tab's outcome is not broadcast coherently.

## Steps to reproduce
1. In test-campaign (two localhost tabs, both signed in on the same campaign; dev:locked), on the Initiative board with the 12 PCs.
2. Tab A: EffectAdder on ElderPaladin → Concentration tab → spell `Hold Person`, DC 14 → Apply. (Concentration badge appears on both tabs.)
3. Encounter Builder: join a Goblin; arm its initiative-card target-select on ElderPaladin; open its card and roll Scimitar until it HITS; click Done on the hit popup. Damage lands (6 slashing) → `concentrationPrompt-ElderPaladin` queued (dc re-armed to RAW max(10, dmg/2) = 10) and the `Concentration Check` modal (`.cnp-overlay`) opens on BOTH tabs.
4. Tab A: click **Roll Con Save** → result panel shows CONCENTRATION MAINTAINED (total 27 vs DC 10, incl. +5 aura). Click **Done**. Server key `concentrationPrompt-ElderPaladin` is deleted (GET change-data → null); Tab A's modal closes.
5. Tab B: observe — the modal is still open with an ACTIVE **Roll Con Save** button, >10 s after resolution, zero reload (window marker proves no navigation).
6. Tab B: click **Roll Con Save** → it rolls AGAIN (observed second roll total 11 vs DC 10) and the campaign log now contains TWO `roll` / `rollType:"concentration-save"` entries for the one damage event (totals 27 and 11).

## Expected behavior
When the prompt key is resolved/deleted by any client, every other client's prompt modal should close (or at minimum its Roll button should be inert), exactly once per damage event — one save, one result, one log row.

## Actual behavior
- Tab B's `.cnp-overlay` never mirrored the resolution (still open at 10 s; never auto-closed).
- Tab B's stale Roll executed a full second adjudication: new d20, new `concentration-save` log row, second POST of `concentrationResult-ElderPaladin`, second `clearConcentrationPrompt` DELETE (against an already-deleted key).
- Console: no errors on either tab during the double-resolve.

## Likely location
Confident (code read + live proof):
- `src/components/common/ConcentrationPromptModal.jsx` — `handleEvent` (line ~74) discards every event with `data == null`: `if (!event.key || event.data == null) return;`. The server DOES broadcast prompt removal — `server/routes/campaigns-changedata.js:243` publishes `change-<campaign>-<key>` with `null` on DELETE — so the dismissal signal arrives and is ignored. The local `prompts[]` queue can only shrink via a user's own Dismiss/Done clicks; there is no cross-client removal path.
- Result plumbing is window-local: `handleRoll` dispatches `window.dispatchEvent(new CustomEvent('concentration-result'))` consumed only in `Initiative.jsx:486` and `useLoggedDiceRollEventHandlers.js:582` on the clicking tab, so the canonical break/maintain adjudication does not propagate coherently either.
- Secondary observation (code-read, not walked live): **Dismiss** (`handleDismiss` → `advance()` only) never DELETEs the server prompt key — a dismissed prompt leaves `concentrationPrompt-<Target>` persisted in change-data as a stale orphan.

## Suggested fix
In `ConcentrationPromptModal.handleEvent`, handle the null-data echo for prompt keys: when `event.key` starts with `change-<campaign>-concentrationPrompt-` and `event.data == null` (or carries a `promptId` that differs), drop every queued prompt for that targetName whose `promptId` is NOT the fresh one. Optionally also compare `promptId` on non-null events (upsert by targetName+promptId). Guard `handleRoll` against a server-side 404/no-op clear (prompt already consumed): e.g. stamp a `concentrationResult-<Target>` seen-key and refuse a second roll for the same `promptId`. For the minor leak, make `handleDismiss` call `clearConcentrationPrompt` when the queue empties (or never, if Dismiss means "player will answer later" — but then it should at least survive reload; pick one semantics).
`server/routes/campaigns-changedata.js` DELETE broadcast is already correct — no server change needed.

## Severity
Data integrity risk — a duplicate failed save on any connected client can break concentration that the canonical resolution maintained, and every re-roll corrupts the combat log with phantom saves for one damage event. (Log-noise + adjudication-double-spend class.)

## Resolution
**Fixed 2026-10-29.** Passive-tab concentration prompts now mirror cross-client resolution: the DELETE null-echo closes every other client's check, a resolved-promptId stamp refuses re-rolls, and Dismiss clears the server key — one save, one result, one log row per damage event, live re-proven two-tab. Diagnosis in the bug file confirmed exactly: `ConcentrationPromptModal.handleEvent` returned early on `event.data == null`, silently discarding the server's cross-client DELETE broadcast (`server/routes/campaigns-changedata.js` publishes `change-<campaign>-<key>` with `null` on DELETE — verified live: null echo arrives, no network/server change needed).

### Repro (pre-fix, live two-tab dev:locked, test-campaign)
Walked the full bug-file repro: EffectAdder Hold Person DC 14 on ElderPaladin → EB Goblin join → armed own-card target-select → Scimitar chip HIT + Done → 6+ dmg lands, `concentrationPrompt-ElderPaladin` queued (dc re-armed to RAW 10), `.cnp-overlay` on BOTH tabs. Tab A Roll → MAINTAINED 29 vs DC 10 → Done → server key GET-verified DELETED, Tab A closed. 12+ s later Tab B: overlay still open, Roll button ACTIVE, `__noReload` marker intact (zero reload). Tab B clicked Roll → fresh d20 (18 → total 28), SECOND `roll/concentration-save` log row for the one damage event. Bug confirmed live end-to-end.

### What changed
`src/components/common/ConcentrationPromptModal.jsx` only (no server change; single lane shared by both rulesets — `sendConcentrationPrompt` has exactly one producer, `applyDamage.js`, and there is no 2024 twin of the modal):
1. **Null-echo close (the core fix):** `handleEvent` now routes `data == null` events on `change-<campaign>-concentrationPrompt-<Target>` to a removal pass: drops that target's queued checks that lack a locally-stamped result. This mirrors the established sibling doctrine (`App.jsx` `applyStoreUpdate` delete-on-null from the travel EventDialog cross-tab fix, and `savePromptCleared`/`biPromptCleared` promptId-scoped removal). Checks already adjudicated on THIS client keep their result panel so the acting tab's Roll → panel → Done flow is untouched (the acting tab also receives its own echo).
2. **Re-roll guard:** `resolvedPromptIdsRef` stamps every submitted promptId (own roll completion + `concentrationResult-<Target>` SSE echo via new `handleResultEvent`); `handleRoll` refuses an already-resolved promptId (prunes the stale entry) and `rollingPromptIdsRef` makes a same-tick double-click fully inert (no double result POST, no double roll).
3. **Dismiss orphan leak (secondary observation, fixed):** `handleDismiss` now calls `clearConcentrationPrompt` before advancing — byte-for-byte the `SavePromptModal.handleDismiss` semantics (un-rolled dismissal is a client-wide answer: DELETEs the key, whose null echo now closes every other client; no stale `concentrationPrompt-<Target>` orphan survives, and the next damage event no longer overwrites a hidden orphan).

### Verification
- **Regression test:** NEW `src/components/common/ConcentrationPromptModal.cross-tab.test.jsx` (6 tests): null-echo closes passive queue; own-echo preserves acting result panel; other-target echo ignored; result-echo stamp refuses re-roll (zero rollD20/sendConcentrationResult); double-click submits exactly once; Dismiss clears server key. `npx vitest run` → 6/6.
- **Touched folders:** `src/components/common` 48 files/536 tests green; `src/services/combat/conditions` 18 files/823 tests green. `npm run lint` → zero warnings.
- **Live re-verification (fresh two-tab dev:locked run, clean baseline change-data `{}` + log `[]`):** re-ran the exact repro. Tab A Roll → MAINTAINED 24 vs DC 10 → Done → key DELETED; **Tab B auto-closed ≤6 s with zero reload (`__noReload` marker alive), exactly ONE `concentration-save` row (24)**. The stale-Roll path is unreachable — no modal, no button. Adjacent legs: (a) second damage event → Dismiss on Tab A → server key DELETED, Tab B auto-closed, zero extra saves spent, cs `concentration` (Hold Person) intact; (b) third event → single-tab roll end-to-end: result panel shown, still visible 5 s later (survives own DELETE echo), Done closes, badge `Hold Person DC 10` + exactly 2 log rows for 2 rolled events. Console: zero errors on both tabs all run.
- **Cleanup:** closed tabs, POST `/admin/clear-change-data` + `/admin/clear-log` from quiet, GET-verified `{}` / `[]` / combatSummary null (Goblin join removed with it).

