# Bug: BI prompt twin stays mounted on other tabs after a cross-tab Skip/Resolve (stranded double-answer)

## Summary
`5bf8c89a3` moved Combat Inspiration (BI) prompts onto the top-level `<name>-biPrompt` wildcard key with drain-to-evict, and a resolved prompt no longer resurrects on fresh SSE connects. But `BardicInspirationReactionModal.handleEvent` early-returns on the null cleared-key echo (`if (event.key || event.data == null) return`), so any OTHER tab that has the same prompt mounted **never dequeues it** when a first tab answers it. The stranded twin stays open indefinitely and can be acted on: clicking "Use Reaction & Roll" on it rolls and consumes the Bardic Inspiration die and dispatches a `bardic-inspiration-<mode>-result` event for a prompt that is already resolved server-side.

## Steps to reproduce
1. Two GM tabs on `http://localhost:5173`, BOTH inside `test-campaign` and both fully connected (campaign selected, app booted — the BI modal listener is always-mounted once in a campaign).
2. Seed a pending defense prompt (honest lane: a bard with defense BI granted + a monster attack; synthetic equivalence proven this run):
   `POST /api/campaigns/test-campaign/HeroesFeastBard-biPrompt` body `{"value":{"mode":"defense","promptId":"hl-bi-x1","targetName":"HeroesFeastBard","attackerName":"Goblin","attackRoll":12,"bonus":4,"effectiveAc":18,"dieSize":8}}`
3. BOTH tabs mount the "Combat Inspiration - Defense" overlay (verified: tab 0 via select-snapshot replay, tab 1 via live echo).
4. In tab 0, click **Skip**. Verify eviction worked there: the modal unmounts, and `GET /api/campaigns/test-campaign/change-data` no longer contains `HeroesFeastBard-biPrompt` (the fix itself is good — the wildcard DELETE + null echo fire, and a reload of tab 0 shows no resurrection).
5. Look at tab 1: the "Combat Inspiration - Defense" overlay is **still mounted** with the stale payload ("Attack: d20(12) + 4 = 16 vs AC 18").
6. (Harm face) In tab 1 click **Use Reaction & Roll**: it rolls 1d8, dispatches `bardic-inspiration-defense-result` into a world where no rider waits, and `clearBardicInspiration` spends the bard's die — all for a prompt another screen already dismissed. No warning, no reconciliation. (No second DELETE fires because the store mirror was already evicted by the null echo — `deleteRuntimeKey`'s `store.has` gate — so the divergence is purely client-side, which is also why it stays silent.)

## Expected behavior
A null cleared-key echo for `<name>-biPrompt` (the drain-to-evict broadcast) should REMOVE the matching prompt from every mounted tab's modal queue, exactly like the sibling save-prompt lane: `SavePromptModal.jsx` documents and ships this in "handleEvent's cleared branch (clearedPromptKeysRef doctrine)" (shipped `77cf70cd0` stale-prompt self-evict). The twin should self-evict the moment tab 0's Skip lands.

## Actual behavior
Live-verified this run (2026-11-17, HEAD `ba97305d9`): tab 0 Skip → `DELETE /api/campaigns/test-campaign/HeroesFeastBard-biPrompt` → server key absent → tab 1 `document.querySelector('.sp-overlay')` remains mounted with the stale prompt (header "Combat Inspiration - Defense", same payload). Clicking Use-Reaction on the twin closed it locally and consumed the die with zero server effect. The component's own comment records the intent gap: "A null payload (the drain-to-evict DELETE echo) exits above — dismissal is the local Skip/Resolve path" — it prevents RE-enqueue but never DE-queues.

## Likely location
Confident (code-read + live): `src/components/common/BardicInspirationReactionModal.jsx` `handleEvent` (~lines 42-53) — the `event.data == null` early-return needs a cleared-key branch that dequeues prompts whose key matches `match[1]` instead of returning. The state shape (targetName from the key prefix + promptId) already supports matching. Fix pattern to copy: `SavePromptModal.jsx` cleared-prompt-keys handling (`isSamePrompt` / `clearedPromptKeysRef` doctrine).

## Suggested fix
In `handleEvent`, on `event.data == null` with a key matching `/^(.+)-biPrompt$/`: drop any queued/active prompt for that creature name (compare by the enqueue key captured at mount; clear `activePromptIdRef`/`processedPromptIdsRef` entry as the save lane does) so the next queued prompt can surface. Keep the no-re-enqueue law (null never mounts). Add a two-tab regression pin mirroring the save-lane stale-twin tests.

## Severity
Data integrity risk — the adjudication is shared-table state; a resolved prompt staying actionable on every other tab allows double-consumption of a Bardic Inspiration die / reaction (and a defense-use dispatched on a twin could apply bonus math to the wrong pending attack where a live rider waits). Not silent DATA corruption server-side (eviction itself is honest), but the client queue lies to the player.

## Resolution
FIXED 2026-11-17 (fix run, dev pair :5173 live source, CAMPAIGN_LOCK=test-campaign).

**Root cause — as diagnosed in the bug file:** `BardicInspirationReactionModal.handleEvent` opened with `if (!event.key || event.data == null) return`, so the drain-to-evict null DELETE echo never reached the queue: the store mirror evicted on every tab, but an already-mounted modal on a non-answering tab kept the resolved prompt actionable indefinitely.

**Fix (files changed):**
- `src/components/common/BardicInspirationReactionModal.jsx` — mirrored the `SavePromptModal.jsx` cleared-branch doctrine (no new architecture):
  - `enqueuePrompt` now captures the arrival key as `promptKeySuffix` (`'<name>-biPrompt'`), exactly like `appendSavePrompt` stamps `promptKeySuffix`.
  - `handleEvent` moved the `data == null` check BELOW the `-biPrompt` key match; a null echo on a matching key routes to a new `dequeuePrompt(keySuffix)` that filters the queue by `promptKeySuffix`, resets `activePromptIdRef` when the removed prompt was the active one, and drops the promptId from `processedPromptIdsRef` so a fresh value echo on the revived key can legitimately re-mount (the save lane's clear/revive doctrine). Null never MOUNTS — the no-re-enqueue law from `5bf8c89a3` is untouched (malformed-events pins still pass unchanged).
  - Dual-ruleset: single shared modal for 5e + 2024 (one producer lane via `bardicInspirationPromptUtils`/`attackRollRiders`) — no sibling module needed the fix.
- `src/components/common/BardicInspirationReactionModal.cross-tab.test.jsx` (NEW) — 7 regression pins: defense + offense null echo dequeues the mounted twin; key-exact matching (another creature's clear is inert); no-re-enqueue law (null/undefined never mounts); same-promptId revival on a fresh value echo; evicted active slot lets the next prompt surface without a reconnect; local Skip + own echoed null stays inert (no second consume/DELETE).

**Verification:**
- Live repro CONFIRMED pre-fix (two GM tabs on :5173 in test-campaign): seeded `HeroesFeastBard-biPrompt` (`hl-bi-x1` shape) → both tabs mounted "Combat Inspiration - Defense" → tab 0 Skip fired the wildcard DELETE, tab 0 unmounted, server key absent — tab 1 stayed mounted with the stale "d20(12) + 4 = 16 vs AC 18" payload.
- Live re-verify post-fix (fresh reload both tabs, fresh prompt `hl-bi-verify-1`): both tabs mounted → tab 0 Skip → DELETE fired → **tab 1's overlay self-evicted within the wait window** (`twinEvicted: true`, both tabs `mounted: false`). Sanity legs: fresh prompt still mounts on both tabs; the no-re-enqueue law held over the live lane (seed `hl-bi-verify-2` then external `DELETE` via curl → both tabs evicted and stayed evicted across a dwell, zero re-mounts).
- Tests: new cross-tab file 7/7; BI-lane touched set (modal/cross-tab/prompt-utils/App.runtime-events/AttackResultPopup.bi-defense/useLoggedDiceRollAttack.misc-effects) 99/99; full `src/components/common` folder 73 files / 742 tests green. `npm run lint` clean (zero warnings).
- Cleanup: all seeded `HeroesFeastBard-biPrompt` keys evicted; change-data cache + campaign log cleared via the admin lanes with all tabs closed — GET-verified `{}` / `[]`.
