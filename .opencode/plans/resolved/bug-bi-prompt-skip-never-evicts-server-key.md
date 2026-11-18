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

## Resolution
**FIXED.** Reproduced live first, exactly per the repro steps: seeded `HeroesFeastBard-biPrompt` → modal mounted with entrance focus on `.sp-roll-btn` → Skip closed it but `GET change-data` still showed the FULL stale payload → reload + re-select + 6 s settle → the "Combat Inspiration - Defense" modal **resurrected with `focusPulled: true`**. Confirmed.

What was actually wrong (vs the original guess): the diagnosis was right about the local-only clear, but the *suggested* `deleteRuntimeKey(targetName, 'biPrompt', …)` could not have worked — `deleteRuntimeKey` composes its wildcard-DELETE URL from the **propertyName only** (`/api/campaigns/<c>/<propertyName>`, built for `characterKey='campaign'` callers), while the producer wrote `biPrompt` INSIDE the character bucket via `setRuntimeValue(targetName, …)` — so the wildcard DELETE route can never target a bucket-nested key at all (and `biPrompt` bare would collide across creatures). Worse, App.jsx `handleChangeKeyEvent` intercepted every character-bucket echo carrying a `biPrompt` key and DROPPED the whole bucket update (never mirrored it), so the writer tab's own mirror was untrustworthy for a bucket-replace evict.

The implemented fix instead makes the BI lane match its ALREADY-WORKING siblings (save/concentration/death-save/flesh-to-stone prompt lanes in `savePromptService.js` — one dedicated top-level wildcard key per prompt, evicted by wildcard DELETE):

- `src/services/combat/prompts/bardicInspirationPromptUtils.js` — prompts now ride the top-level `<name>-biPrompt` key through the CAMPAIGN store: `sendBardicInspirationDefensePrompt` writes `<target>-biPrompt`, `sendBardicInspirationOffensePrompt` writes `<attacker>-biPrompt` (so the offense rider lane named in the bug file evicts identically), and `clearBardicInspirationPrompt` is now `deleteRuntimeKey('campaign', '<name>-biPrompt', campaignName)` — wildcard DELETE + null echo + local mirror evict, fail-loudly on refusal (the OA-marker doctrine). The dead `biPromptCleared` constant and the zero-caller `clearBardicInspirationPromptState` alias were deleted (no-legacy doctrine; the bug file explicitly sanctioned deleting the dead handshake over fabricating a producer).
- `src/services/automation/common/campaignKeys.js` — `isCampaignKey` registers the dynamic `-biPrompt` suffix (pendingOAs/lastCombatResult echo-misroute family): value echoes mirror into every mounted tab's campaign store, and the DELETE null echo is a REMOVE, never a stored null — so nothing replays.
- `src/components/common/BardicInspirationReactionModal.jsx` — `handleEvent` keeps the single canonical `<name>-biPrompt` raw-payload branch (the shape the SSE snapshot replays and the synthetic rig proved live); the dead bucket-`{biPrompt:…}` branch and the zero-producer `handleClearedEvent` handshake were deleted. Null (eviction-echo) payloads stay inert — dismissal remains the local Skip/Resolve path.
- `src/App.jsx` — removed the dead `biPrompt`-bucket echo interception + `pendingPromptIdRef`/`biPromptCleared` plumbing (it silently dropped WHOLE character-bucket echoes while a prompt was pending) and the `key !== 'biPrompt'` seeding exclusion in `seedCharServerKeys`.
- Dual-ruleset check: the lane is ruleset-agnostic (single `bardicInspirationPromptUtils`, shared by 5e and 2024 callers) — no sibling module needs the fix. Logging: the defense Skip/Resolve lanes logged nothing before and still log nothing (no game action commits on Skip; the offense USE lane keeps its existing `ability_use` row in `attackRollRiders.js` — untouched).

Tests updated/added (all co-located, house conventions):
- `src/services/combat/prompts/bardicInspirationPromptUtils.test.js` — REWRITTEN as the regression lock against the REAL `useRuntimeState` module with fetch stubbed: pins the exact POST write URLs/bodies (`<target>-biPrompt` / `<attacker>-biPrompt`), and — the filed bug — that clearing issues exactly one wildcard `DELETE /api/campaigns/test-campaign/<name>-biPrompt` (a local-only clear with zero fetches fails here), evicts the mirror, never touches `biPromptCleared`/the character bucket, is idempotent (has()-guard, no honest-404 churn), and writes nothing for a never-issued prompt.
- `src/components/common/BardicInspirationReactionModal.test.jsx` — prompt fixtures moved to the canonical raw-payload wildcard-key echo; the three dead `biPromptCleared` tests deleted; malformed-event table pins the DELETE null echo and the retired handshake shape as inert.
- `src/App.runtime-events.test.jsx` — the old "suppresses character-store writes while a BI prompt is pending" contract (the latent bucket-clobber the move eliminates) replaced by the resurrection lock: `<name>-biPrompt` echoes mirror into the campaign store and the null evict echo REMOVES them.
- `src/hooks/combat/useLoggedDiceRollAttack.misc-effects.test.js` — the never-auto-prompt guard filter widened to the new `<name>-biPrompt` write vocabulary.

Verification:
1. Live repro re-run BEFORE fix (test-campaign, :5173): resurrection confirmed (modal remounted after Skip + reload + re-select, focus pulled).
2. Live re-verification AFTER fix, full original repro: seed → mount + entrance-focus pull → **Skip → client fires `DELETE /api/campaigns/test-campaign/HeroesFeastBard-biPrompt` (200) → `GET change-data` shows the key ABSENT** → reload + re-select + 6 s settle → **modal does NOT remount** (`resurrected: false`). Adjacent legs re-lived clean: "Use Reaction & Roll" resolves (rolls 1d8=7, dispatches `{promptId, used:true, biRoll}` to the rider handshake, evicts the key); a second prompt re-arms and mounts normally after an evict; console 0 errors.
3. `npx vitest run` on the new test (6/6), the touched-area slices (`src/services/combat` + `src/services/automation` + `src/hooks/runtime`: 725 files / 10,487 tests, all green; `src/App.*` + `src/components/common`: 836 green), full suite run post-change. `npm run lint` zero warnings; `no-timers-guard` OK.
4. Run hygiene: test-campaign change-data + log cleared CLOSED-TAB two-pass headless, GET-verified `cd={}` + `log=[]`, disk files ABSENT (baseline restored); the pre-fix stale `HeroesFeastBard-biPrompt` key was swept by the same clear.

## Summary (commit text)
Fix BI prompt resurrection: Combat Inspiration prompts now ride the top-level `<name>-biPrompt` campaign wildcard key (matching the save/concentration/death-save prompt lanes) and Skip/Resolve evicts it with a wildcard DELETE (drain-to-evict) instead of a local-only Map.delete; registered the dynamic key in campaignKeys so null evict echoes REMOVE it on every tab; deleted the zero-producer `biPromptCleared` handshake and the App.jsx bucket-echo interception; regression-locked with real-module fetch-wire tests (skip MUST fire the DELETE) and re-verified live end-to-end.
