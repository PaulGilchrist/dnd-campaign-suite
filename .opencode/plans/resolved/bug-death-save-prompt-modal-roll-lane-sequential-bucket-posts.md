# Bug: DeathSavePromptModal roll lane still issues sequential whole-bucket POSTs (residual of the sheet-lane roll race family)

## Summary
`bug-death-save-roll-lane-sequential-bucket-posts` collapsed the SHEET roll lane (`DeathSavingThrows.rollDeathSave`) into a single `setRuntimeBatch` (2026-11-19 fix run, wire-verified). The sibling producer — `handleRoll` in `src/components/common/DeathSavePromptModal.jsx` — was NOT part of that fix and still fires up to FOUR sequential whole-bucket `setRuntimeValue` POSTs per roll: `deathSaves` (:241), `deathFailures` (:242), `isDead` on a fatal roll (:244), `currentHitPoints` on a NAT 20 (:249). Worse, the NAT-20 `death-save-result` window event makes the HP write happen TWICE with independently-ordered snapshots: once from the `CharHitPoints` listener (`CharHitPoints.jsx:111`, and `Initiative.jsx:702` for monsters) and once from the modal's own :249 write. A stale track snapshot landing after the listener's HP-restored snapshot leaves a standing creature still wearing pre-roll failures (the exact divergence shape witnessed on the sheet lane pre-fix).

## Steps to reproduce
Mechanism steps (stochastic race, code-confirmed; the sheet-lane twin was wire-witnessed 2026-11-19 with the identical POST shape — a stale intermediate body carrying `isDead:1` + 2/3 track, and `currentHitPoints:1` + stale track):
1. In `test-campaign`, arm a death-save prompt for a player (drop their bucket `currentHitPoints` to 0 via the sheet editor, then the prompt arms through the save-prompt lane).
2. Wrap `window.fetch` onto `window.__posts` (playbook wire-capture recipe), press `Roll Death Save` in the `.dsp-overlay` with forced `Math.random` for a fatal roll.
3. Read `__posts`: ≥3 sequential whole-bucket POSTs to the char key, with intermediate bodies missing the later fields.

## Expected behavior
One roll = one merged `setRuntimeBatch` (mirroring `DeathSavingThrows.rollDeathSave` post-fix and `handleRemoveDead`), and a decision on the duplicate HP restore between the modal's own write and the `death-save-result` listeners (single writer or merged body — one commit = one POST = nothing to interleave).

## Actual behavior
Sequential per-key `setRuntimeValue` calls, each a full-mirror bucket POST with its own SSE echo; on NAT 20 the HP field is additionally written by a second producer (the window-event listeners), widening the reorder window.

## Likely location (confident — code-read)
`src/components/common/DeathSavePromptModal.jsx` — `handleRoll()` writes at lines 241-250; second HP producer at `src/components/char-sheet/char-summary/CharHitPoints.jsx:110-111` and `src/components/initiative/Initiative.jsx:697-704`.

## Suggested fix
Collapse the four writes into one `setRuntimeBatch` (tracks + `isDead:1` when fatal + `currentHitPoints` when `restoredToHp !== null`), keeping `sendDeathSaveResult` / the `death-save-result` dispatch / `clearDeathSavePrompt` / the finality row in their current order (mirror the sheet lane's fix in `DeathSavingThrows.jsx`). Then decide the listener-duplication: either the modal stops writing HP (listeners own it — but Initiative's lane only covers the combat board) or the listeners skip when the acting producer already merged HP (e.g. a `hpWritten:true` flag on the event detail). Add a wire-shape pin (fetch spy against the real store module, one POST per terminal roll) like `DeathSavingThrows.roll-single-write.test.jsx`.

## Severity
Data integrity risk — same class ruled unacceptable by the adjacent fixes (whole-bucket last-writer-windover leaving DEAD/track/HP divergence via SSE echo); intermittent, self-healing on the next write.

## Origin
Filed 2026-11-19 by the `bug-death-save-roll-lane-sequential-bucket-posts` fix run while scoping that fix (sheet lane fixed here; modal lane left standing, matches the app-exploration map's carried DeathSavePromptModal priority target).

## Resolution
**FIXED 2026-11-19.** The guess was accurate and the race was additionally WITNESSED live pre-fix (test-campaign, GM card drop-to-0 arm, forced `Math.random`, fetch spy sliced by index):

- **Fatal leg** (bucket forged to 2 failures via scoped PATCH, roll 5): TWO sequential whole-bucket `POST /EvasiveFighter` — the first body carried the third-failure track `deathFailures:[t,t,t]` beside a stale `isDead:0` (the exact last-writer-windover intermediate), the second carried `isDead:1`.
- **NAT 20 leg** (Initiative view mounted, bucket forged to 1+1): THREE sequential whole-bucket POSTs — the FIRST was the `Initiative.jsx` listener's own `currentHitPoints:1` write dispatched at `DeathSavePromptModal:229` BEFORE the modal wrote its own tracks (body: restored HP beside PRE-roll tracks `[t,f,f]/[t,f,f]`), then the modal's `deathSaves` POST, then its `deathFailures` POST; its own `:249` HP write was valuesEqual self-skipped because the listener had already lifted the mirror — proof the two HP producers race for who stamps the bucket and in what snapshot order.

**Fix (sheet-lane twin pattern, `DeathSavingThrows.rollDeathSave` post-`af8dc4a83`):** `handleRoll` collapses to ONE `setRuntimeBatch` per roll (both tracks, `+isDead:1` fatal, `+currentHitPoints` when `restoredToHp !== null`), issued after the finality row and immediately before `clearDeathSavePrompt` — `sendDeathSaveResult` / the `death-save-result` dispatch / `clearDeathSavePrompt` / the finality row keep their order and shape, and the log lane (page-singleton roll row + finality pair) is byte-unchanged.

**Single-writer decision (duplicate HP producer):** the MODAL owns the HP write; the listeners skip it via an `hpWritten:true` flag on the dispatched event detail (present only when the restore rides the batch — non-restoring rolls' detail stays byte-identical). Why not "listeners own it": both listeners are view-mount-conditional (CharHitPoints only while that sheet is open, Initiative only while the board view is mounted — neither is guaranteed at roll time, and a missed nat-20 restore leaves a standing creature at 0), whereas the modal is by construction the one component always present when a prompt roll resolves — same law that makes the sheet lane write HP itself. The Initiative lane keeps its NON-bucket work even when the flag is set: the `combatSummary`-row `currentHp` mirror stamp (`displayCreatureUtils` reads bucket-first but the persisted cs byte is what the row fallbacks/clear census consume) rides `storage.set` as its own lane; the CharHitPoints chip face is untouched. Flagless bare-restore events (any future non-merging producer) keep the historical listener-owns-HP behavior verbatim — the promptId-matched slot machines (`relentlessRageService`, `reactionSaveHealHandler`) are self-owned prompt-scoped lanes, untouched.

**Dual-ruleset:** no 2024 twin — `deathSaveRules.js` and this modal are the single shared lane for both rulesets (grep: no `deathSaveRules2024`, no second dispatcher of `death-save-result`).

**Files changed:**
- `src/components/common/DeathSavePromptModal.jsx` — merged `setRuntimeBatch` + `hpWritten` detail flag.
- `src/components/char-sheet/char-summary/CharHitPoints.jsx` — listener skips its HP POST when `detail.hpWritten`.
- `src/components/initiative/Initiative.jsx` — listener skips the bucket POST when `detail.hpWritten` (keeps cs-row stamp).
- `src/components/common/DeathSavePromptModal.roll-single-write.test.jsx` — NEW wire-shape pin (real store + real savePromptService + fetch spy; the CharHitPoints co-mount is the "HP written exactly once" oracle). Both terminal legs verified RED against the pre-fix lane (2 and 3 bucket POSTs) before the fix.
- `src/components/common/DeathSavePromptModal.test.jsx` / `.finality-rows.test.jsx` / `.cross-tab.test.jsx` — write assertions migrated from the retired per-key `setRuntimeValue` shape to the merged batch (no-legacy policy).
- `src/components/char-sheet/char-summary/CharHitPoints.death-save-chip.test.jsx` + `src/components/initiative/initiative-callbacks.test.jsx` — hpWritten skip pins (chip survives / NPC cs stamp survives, zero bucket POST).
- `docs/test-setup-playbook.md` — MODAL-ROLL-LANE SINGLE-WRITER LAW appended to the death-save full-rig §bullet (incl. the log-GET-plain-array probe trap).

**Verification (all test-campaign, :5173):** post-fix live fatal roll = EXACTLY ONE char-bucket POST, one body carrying `isDead:1` + `deathFailures:[t,t,t]` + `deathSaves` + preserved `currentHitPoints:0`; live NAT 20 roll (Initiative listener mounted) = EXACTLY ONE char-bucket POST with `currentHitPoints:1` + both cleared tracks, plus the single `combatSummary` mirror POST (cs lane intact); prompt cleared (DELETE trio), `GET /change-data` byte-consistent both legs; log census pattern-identical (roll row then finality row on the fatal; roll row only on nat20 — sheet-lane parity). The monster-board lane re-lived honestly: on-board `NPC 1` nat-20 → one bucket POST + cs-row `currentHp:1` stamped + card renders 1. Adjacent lanes re-lived: sheet-lane roll (`DeathSavingThrows`) still one merged POST with track paint, DEATH badge + `Clear death state` still one POST (`isDead:0` + reset tracks, HP 0 preserved). Console 0 errors. Unit: new pin 3/3 (+red-proof pre-fix), modal suite 53, char-summary 708, common 728, initiative 883, event-contract neighbors (relentlessRage/reactionSaveHeal/logged-roll/rules/service) 141 — all green; `npm run lint` zero warnings; `no-timers-guard` OK. Cleanup: closed-tab `admin/clear-change-data` + `admin/clear-log` → 200, GET-verified `{}` / `[]`.
