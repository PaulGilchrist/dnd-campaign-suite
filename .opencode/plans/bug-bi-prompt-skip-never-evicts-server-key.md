# Bug: Answered/skipped Bardic Inspiration prompts resurrect on every SSE connect — the clear lane is local-only

## Summary
Dismissing a Bardic Inspiration prompt via the in-modal **Skip** (or resolving it) does not evict the `<Char>-biPrompt` change-data key server-side — `clearBardicInspirationPrompt()` is a pure local `Map.delete()` with no fetch. The persisted key is replayed by the SSE snapshot on every connect, so the already-answered "Combat Inspiration" modal **resurrects and steals entrance focus on every tab reload / campaign re-select / SSE reconnect**, and will keep doing so until the admin change-data clear. The designed cross-tab dequeue handshake (`*-biPromptCleared`) has zero producers in the codebase.

## Steps to reproduce
1. In `test-campaign` with a mounted localhost tab, seed a BI prompt exactly as the playbook rig documents:
   `POST /api/campaigns/test-campaign/HeroesFeastBard-biPrompt` `{"value":{"promptId":"gk-bi-1","mode":"defense","targetName":"HeroesFeastBard","attackerName":"Goblin","attackRoll":15,"bonus":3,"effectiveAc":12,"dieSize":8}}`
2. The `.sp-overlay` "Combat Inspiration - Defense" modal mounts and pulls focus to `button.sp-roll-btn` (verify `activeElement` is inside the overlay).
3. Press **Skip** — the overlay unmounts and focus restores to the pre-open anchor (this half works — the entrance-focus tier is healthy).
4. `GET /api/campaigns/test-campaign/change-data` — observe `HeroesFeastBard-biPrompt` still present with the FULL stale payload.
5. Reload the tab (`http://localhost:5173`), re-select `test-campaign`, wait ~6 s for select-settle + SSE snapshot replay.
6. Observe the "Combat Inspiration - Defense" modal (same promptId/goblin copy) mounted again, focus pulled into it, in a campaign state where the prompt was already dismissed.

## Expected behavior
Skip (and Use Reaction & Roll) should evict the prompt server-side (a `deleteRuntimeKey`-style wildcard DELETE, mirroring the concentration lane's "last answered prompt key is fully deleted, never written back empty", or a real `biPromptCleared` write that consumers can honor). After dismissal, replaying a fresh SSE connection must NOT remount an answered prompt.

## Actual behavior
Step 4: the key survives with its full payload (verified twice, minutes after Skip). Step 6: the stale modal resurrects on the fresh load with entrance focus pulled inside it (`focusPulled: true`). No DELETE/POST request to any prompt lane fires on Skip — the only server writes on Skip are zero.

## Likely location
Confident (code read + live):
- `src/services/combat/prompts/bardicInspirationPromptUtils.js` — `clearBardicInspirationPrompt()` does `getStore(targetName).delete(PROMPT_KEY)` and NOTHING else: no `fetch`, not even the `deleteRuntimeKey` companion it should be using (contrast `useRuntimeState.js` `deleteRuntimeKey`, which has the fail-loudly res.ok check precisely because local-only deletes stranded markers before — the OA-marker bug family, owner ruling 2026-11-10).
- The resurrection consumer: `src/components/common/BardicInspirationReactionModal.jsx` `handleEvent` branch 2 (key-suffix `^(.+)-<Char>-biPrompt$`) re-enqueues any replayed payload on every fresh component instance (`processedPromptIdsRef` is per-mount).
- Dead handshake: `handleClearedEvent` and `App.jsx:186` honor `*-biPromptCleared` payloads, but grep shows NO code anywhere writes that server key.
- The Use-Reaction path only evicts IMPLICITLY (nested-bucket shape) via `clearBardicInspiration`'s full-store POSTs — and `setRuntimeValue`'s `valuesEqual` early-return (null→null writes are skipped, no POST) means even that can silently no-op.

## Suggested fix
Route `clearBardicInspirationPrompt` through `deleteRuntimeKey(targetName, 'biPrompt', campaignName)` (wildcard DELETE + null echo; the modal already ignores null payloads as dismissal, so the local `advance()` stays the UI close path) — the same drain-to-evict pattern the concentration and OA-marker lanes use. Additionally, either give the `biPromptCleared` consumers a real producer (write the cleared marker before/with the DELETE) or delete the dead branches. Worth checking whether offense-mode resolution through `attackRollRiders.js` suffers the same non-eviction on the attacker key.

## Severity
Data integrity risk — every dismissed BI prompt leaves a resurrection-prone key in shared state that re-arms an adjudication modal (with a live Reaction prompt UI) on every subsequent load of ANY tab in the campaign until an admin clears change-data; also breaks the cross-tab dismissal doctrine (other tabs never learn the prompt was answered).
