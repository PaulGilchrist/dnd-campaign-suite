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
