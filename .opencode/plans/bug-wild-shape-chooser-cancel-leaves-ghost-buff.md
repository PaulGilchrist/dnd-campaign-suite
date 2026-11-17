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
