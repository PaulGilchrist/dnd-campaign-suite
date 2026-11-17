# Bug: Wild Shape chooser Cancel leaves a ghost shape_shift buff (spellcasting silently blocked)

## Summary
Clicking the `Wild Shape:` row on the druid sheet writes the `shape_shift` buff (with `blocksSpellcasting: true`) into the shared runtime store BEFORE the beast chooser opens. If the chooser is then dismissed with **Cancel** — with or without a beast selected — the buff is never reverted. The druid is left in a ghost "under Wild Shape" state: spellcasting is refused, yet no beast form exists, no use was consumed, and no activation was logged. The state persists on the server and broadcasts via SSE to every tab.

## Steps to reproduce
Start from a fresh state in **test-campaign** (Wild_Sage_Druid NOT shifted, `wildShapeUses` > 0):

1. Open the Wild_Sage_Druid sheet. Confirm clean: `GET /api/campaigns/test-campaign/change-data` → `Wild_Sage_Druid.activeBuffs` does NOT contain a `shape_shift` entry.
2. Click the `Wild Shape:` row on the sheet → the beast chooser (`.sp-overlay`, "Choose a beast form (CR 1 or lower)") opens.
3. Press **Cancel** in the chooser WITHOUT selecting a beast. (Same result if you first click a beast card, e.g. Cat, then Cancel — the card click itself is local-only.)
4. `GET /api/campaigns/test-campaign/change-data` → `Wild_Sage_Druid.activeBuffs` now contains `{name:'Wild Shape', effect:'shape_shift', blocksSpellcasting:true, ...}`. `wildShapeUses` is unchanged; the campaign log has no new rows.
5. On the same sheet, click any spell row (e.g. `Guidance`) → `Cast Spell` → the cast is REFUSED with popup "Wild Shape — Guidance cannot be cast while Wild_Sage_Druid is under Wild Shape — no Spellcasting is allowed." and a `shape_shift_refused` automation row lands in the log — despite the druid never having transformed.
6. The only way out is clicking `Wild Shape:` again, which now shows the chooser is suppressed and instead toggles OFF (popup "Wild Shape toggled OFF") and logs "deactivated Wild Shape."

Witnessed three times live (2026-11-17 run EG): row-click→Cancel (no selection), beast-select→Cancel, and a mid-tick commit attempt where the confirm click landed on the still-disabled `.sp-roll-btn` (buff armed, everything else silently skipped).

## Expected behavior
Cancel on the beast chooser is a zero-write action (consistent with every other chooser lane in the app: HoH picker Cancel zero-write, EffectAdder Escape zero-write, "Cancel disarms" on the Wild Shape chooser itself). The druid's `activeBuffs` should be byte-identical before open and after cancel.

## Actual behavior
- `activeBuffs` gains a full `shape_shift` buff (blocksSpellcasting true) with zero log rows and zero use consumption.
- The spell lane then refuses all casts with a `shape_shift_refused` audit row blaming a Wild Shape that was never activated (misleading audit trail for other players — the log shows "Guidance blocked — under Wild Shape" with no preceding "activated Wild Shape" row).
- SSE broadcasts the buff to every connected tab (shared store), so a GM dismissing the chooser on the GM screen silently blocks the player's sheet.

## Likely location
Confident (read the code after confirming live):
- `src/services/automation/handlers/buffs/buffHandler.js` — `handleShapeShift()` (:398-446): runs `toggleBuff(...)` BEFORE returning the `wild_shape_select` popup payload (comment at :395 shows the pre-toggle is deliberate so the same row acts as the release toggle when `wasActive`), but nothing reverts it if the popup is dismissed.
- `src/components/char-sheet/CharSheet.modals.jsx:46-61` — the `wild_shape_select` branch wires `onCancel={() => setPopupHtml(null)}` — pure close, no rollback of the pre-toggle.
- `PolymorphSelectionModal.jsx:209` `handleSelect` is local state only (verified the beast-card click itself writes nothing).

## Suggested fix
Roll back the pre-toggle on dismissal: in `CharSheet.modals.jsx`'s `wild_shape_select` `onCancel`, call the same `toggleBuff(playerStats.name, action.name, auto, campaignName)` again (toggles OFF) — or better, have `handleShapeShift` NOT pre-arm and instead let `onWildShapeConfirm` apply the buff, keeping the OFF-leg detection on the row handler (`formActive` check at :399 already reads the store, so the release-toggle behavior survives). Whichever lane is chosen, also run `cleanupWildShape(...)` on cancel for symmetry (it is what the OFF leg calls). Add a test pinning "row click → chooser Cancel ⇒ activeBuffs unchanged, zero log rows" alongside the existing `buffToggle` tests.

## Severity
Data integrity risk — a Cancelled action mutates shared server state, silently disables a player's entire spell lane until someone knows to press the feature row again, and writes misleading refusal audit rows that reference a Wild Shape that was never taken.

## Resolution (2026-11-17, fix run)

**FIXED.** Reproduced live first in test-campaign: row-click → chooser → Cancel (no selection) ⇒
server `Wild_Sage_Druid.activeBuffs` gained the full `shape_shift` buff (`blocksSpellcasting: true`),
`wildShapeUses` unchanged, campaign log 0 rows — exactly as filed.

Root cause confirmed as guessed: `handleShapeShift` pre-armed the buff via `toggleBuff(...)`
BEFORE returning the `wild_shape_select` chooser payload, and the modal's `onCancel` only closed.

**Chosen fix: the bug file's "better" option — no pre-arm, buff applied on confirm.**
Cancel is now zero-write BY CONSTRUCTION (nothing to roll back), mirroring the established
chooser lanes: `monsterShapeShift.js` (chip → chooser writes nothing; `declineShapeShiftSelection`
zero-write) and `polymorphService.confirmPolymorphTransform` (all writes on confirm). The
rollback-on-onCancel alternative was rejected: it still writes twice (arm + un-arm SSE flashes),
and a tab close mid-chooser would still leave the ghost.

Deviation from the suggested fix: `cleanupWildShape(...)` is NOT run on cancel — it itself
performs writes (activeBuffs rewrite, tempHp 0, cs storage set), which would violate the
zero-write Cancel contract; with no pre-arm there is nothing to clean.

Dual-ruleset check: both `public/data/classes.json` and `public/data/2024/classes.json` druid
`shape_shift` automations carry NO `target: 'willing_creature'`, so `resolveWillingTargetName`
always resolves to the druid — the confirm-leg buff write to `stats.name` is byte-equivalent to
the old pre-arm for both rulesets. Single handler serves both.

### Files changed
- `src/services/automation/handlers/buffs/buffHandler.js` — `handleShapeShift`: ON leg returns the
  chooser payload with zero store writes/zero log rows (early-return on `!formActive`); OFF leg
  keeps `toggleBuff` + `cleanupWildShape` + deactivation log (release-toggle behavior unchanged;
  `formActive` already read the store, so clicking the row while shifted still toggles OFF).
- `src/components/char-sheet/CharSheet.jsx` — `handleWildShapeConfirm` is now the ONLY writer of
  the shape_shift buff: filter-same-name-then-append via the shared `computeToggledBuffs`
  (same idiom as `handleDashSpeedBonus`; idempotent against double-confirm), byte-identical to
  what `toggleBuff` used to stamp, then `activateWildShape` as before (form, spend, log).
- `src/services/automation/handlers/buffs/buffHandler.wild-shape.test.js` — the three ON-leg tests
  that pinned the (buggy) `toggleBuff` pre-arm now pin zero-writes (`toggleBuff`/`setRuntimeValue`/
  `addEntry` NOT called) + chooser payload echo.
- `src/components/char-sheet/CharSheet.actionHandlers.test.jsx` — Wild Shape confirm fixture now
  carries the production `automation` bytes (the confirm leg reads them).
- `src/components/char-sheet/CharSheet.wild-shape-chooser.test.jsx` — NEW regression suite:
  Cancel ⇒ popup closed, zero store writes, zero log rows, activeBuffs untouched; Confirm ⇒
  exact shape_shift buff bytes stamped then `activateWildShape` dispatched; double-confirm
  replaces (never duplicates) the same-named buff and preserves other buffs.

### Verification
- Live re-run in test-campaign on :5173 (fresh Admin clears before the run):
  - row-click → chooser → **Cancel**: server change-data byte-identical (no `activeBuffs` key at
    all), `wildShapeUses` unchanged, log 0 rows. (Ghost before the fix: full buff.)
  - **beast-selected → Cancel** and **Escape-dismiss** controls: also zero writes, zero log rows.
  - Spell lane after cancel: `Guidance` → Cast Spell cast normally (`spell` log row; no
    `shape_shift_refused` — pre-fix it was refused with the ghost armed).
  - Normal confirmed Wild Shape still works: chooser → Cat → confirm ⇒ shape_shift buff
    (byte-identical to pre-fix activation), `wildShapeUses` 4→3 consumed, `wild_shape`
    targetEffects row, combatSummary beast marks (`beastName: Cat`), and log row
    "Wild_Sage_Druid activated Wild Shape as Cat (CR 0)."
  - Adjacent OFF-leg sanity: row-click while shifted ⇒ "Wild Shape toggled OFF" popup +
    "Wild_Sage_Druid deactivated Wild Shape." log row, buffs/te/cs stripped, uses NOT refunded.
- Tests: new file 3/3 pass; touched folders (buffs handlers + char-sheet) all pass; full suite
  `npm run test:run` 3356 files / 35974 tests passed; `npm run lint` zero warnings;
  `node .opencode/plans/no-timers-guard.mjs` OK.
- Cleanup: change-data cleared to `{}` and log to `[]` via Admin after verification.
