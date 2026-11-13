# Bug: Hand of Healing result modal claims “N HP restored” when its own audit row records “(Already at full HP)” — zero restored

## Summary
When Warrior-of-Mercy `Hand of Healing` heals a target already at max HP, the Focus Point is spent, the campaign-log row honestly annotates `(Already at full HP)`, but the result modal the player/GM actually sees reads e.g. `1d12 + 7 + 2: 10 +9= 19 HP restored`. The two views of the same event disagree, and the UI face over-reports healing.

## Steps to reproduce
In test-campaign with a combat board that includes an at-full-HP PC whose runtime mirror is at max (e.g. `EvasiveFighter` on a freshly-selected campaign — bucket absent → mirror 112/112; the combatSummary row HP is NOT the heal lane, the bucket mirror is):

1. Use a Monk whose subclass is Warrior of Mercy in the fixture set-up (canonical Disciplined_Monk is Open Hand; subclass swap per playbook §2 — or any Mercy fixture). Reload + re-select so the sheet derives the `Hand of Healing:` Bonus-actions row.
2. Open the Monk sheet → click `Hand of Healing:` → target-chooser (`#hand-of-healing-target-modal-title`) → pick the at-full target → `Heal`.
3. Result modal renders: `Healing—EvasiveFighter (112 / 112 HP)` + `1d12 + 7 + 2: 10 +9= 19 HP restored`.
4. `GET /api/campaigns/test-campaign/log`: the `ability_use` row for the same event reads `Disciplined_Monk expended 1 Focus Point to use Hand of Healing on EvasiveFighter: 1d12 + 7 + 2 = 19 (Already at full HP).`
5. CONTROL: target a damaged, bucket-hydrated character (e.g. `AasimarTest` at `currentHitPoints:116` via scoped PATCH + reload/re-select) → the same flow restores for real (modal `134 / 143`, log `(Regained 18 HP)`) — so the lane works; only the full-target copy face is dishonest.

## Expected behavior
The result modal should mirror the audit row’s honesty: show `0 HP restored (target already at full HP)` (or equivalent), and ideally warn BEFORE the Focus spend that the target is at max. The header `(112 / 112 HP)` at step 3 already telegraphs the futility — the commit proceeds silently.

## Actual behavior
Modal copy claims 19 HP restored; zero HP was restored; Focus Point consumed; no inline warning. The log and the UI disagree. (Cosmetic sibling in the same string: `10 +9= 19` — the formula shows `1d12 + 7 + 2` but the evaluated form fuses the two bonuses as `+9=` with odd spacing.)

## Likely location
Confident: `src/components/char-sheet/modals/shared/HandOfHealingModal.jsx` (~line 162 renders `result.healAmount`, the pre-clamp roll total). `src/services/automation/handlers/healing/healingHandler.js` `performMonkHeal` computes BOTH `healAmount` (roll sum) and `actualHeal` (clamped, used for the honest `(Already at full HP)` annotation via `healDesc`) but the modal payload only carries `healAmount`.

## Suggested fix
Include `actualHeal` (and/or the `healDesc` annotation) in the `handOfHealing` modal payload in `healingHandler.js` (~line 251) and render it in `HandOfHealingModal.jsx` instead of the raw `healAmount`; e.g. “= 0 HP restored (already at full HP)”. Optional guard: the picker stage already knows each target’s current/max HP (SecondaryTargetModal `showHp`) — offer a confirm or at least an inline hint when the chosen target is at max before spending Focus.

## Severity
**Minor UX issue** escalating to **data-trust risk**: the log (GM’s record of resource spend) and the player-visible modal tell different stories about the same heal. Not a silent-write defect — the authoritative row is honest.
