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

## Resolution
**FIXED 2026-11-13.** The "Likely location" was confirmed exactly: `performMonkHeal` computed `actualHeal` (clamped) for the honest log annotation but the `handOfHealing` modal payload only carried `healAmount` (pre-clamp roll sum), and `HandOfHealingModal` rendered that as “N HP restored”.

**Changes:**
- `src/services/automation/handlers/healing/healingHandler.js` — `performMonkHeal` payload now carries `actualHeal` alongside `healAmount` (payload gains the field; no behavior change to the write/log lane, which was already honest).
- `src/components/char-sheet/modals/shared/HandOfHealingModal.jsx` — result stage renders `result.actualHeal` (not `healAmount`) as the bold “HP restored” number, appends `(Already at full HP)` when zero (mirroring `healDesc`/audit-row wording), and the cosmetic fused-`+9=` spacing is fixed to ` = ` (matching the `HealingPoolModal` sibling’s `.healing-total` style). `healAmount` is no longer destructured by the component (payload keeps it — pinned by maintained lane `healingHandler.monk.test.js` #1811).
- Dual-ruleset: single shared `healingHandler.js`/modal serves both 5e and 2024 (only `focusLabel` branches) — one fix covers both; no sibling module needed changing.
- **Optional pre-spend warning: SKIPPED deliberately.** The picker rows are built from `collectTouchTargets` → `combatSummary` creature rows, which heal writes NEVER touch (stale-row HP is a separately-filed backlog item — live repro showed every row at `1/1` while the bucket mirror was at max). An “at max” hint/confirm built on that stale source would itself be dishonest; it should land after the row-vs-bucket source fix.
- Existing tests updated to the widened payload contract: `HandOfHealingModal.test.jsx` (baseProps/resolved props carry `actualHeal`), `.cla159.test.jsx` + `.dialog-semantics.test.jsx` (mock payloads carry `actualHeal`).

**New regression tests:**
- `src/components/char-sheet/modals/shared/HandOfHealingModal.restored-hp-honesty.test.jsx` — locks the copy: actualHeal 0 → `0 HP restored (Already at full HP)` and the roll sum must NOT surface; partial → clamped amount only; full landing → amount, no annotation.
- `src/services/automation/handlers/healing/healingHandler.monk-actual-heal-payload.test.js` — locks payload `actualHeal` propagation (0-clamped + partial) and the honest audit-row annotation.

**Verification:**
- Live repro BEFORE fix (test-campaign, Warrior-of-Mercy swap on Disciplined_Monk per playbook §2, board from fresh campaign select): modal `1d12 + 7 + 2: 7 +9= 16 HP restored` on `EvasiveFighter (112 / 112 HP)` while the `ability_use` row said `= 16 (Already at full HP)`; focus 20→19; bucket untouched.
- Live re-run AFTER fix on :5173 (same steps: sheet row → picker → target → Heal): full-HP face renders `1d12 + 7 + 2: 5 +9 = 0 HP restored (Already at full HP)` — mirrors the log row. CONTROL (AasimarTest seeded `currentHitPoints:116`/143): modal `= 12 HP restored`, header `128 / 143`, log `(Regained 12 HP)`, bucket GET `128` — all agree.
- Tests: new files 6/6 pass; `npx vitest run src/services/automation/handlers/healing` 17 files/180 pass; `npx vitest run src/components/char-sheet/modals/shared` 99 files/566 pass; `npm run lint` clean (zero warnings).
- Exit state: Disciplined_Monk.json restored byte-exact (md5 `ba4d456c4ab7605d7ca4246a17cfe58f`); change-data `{}` + log `[]` after admin clears; `git status --porcelain public/campaigns/` empty.
