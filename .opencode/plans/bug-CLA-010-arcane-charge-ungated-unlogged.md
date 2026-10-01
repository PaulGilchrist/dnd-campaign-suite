# Bug — CLA-010 Arcane Charge: standalone action with no Action Surge linkage, zero uses tracking, zero logging

## Title
CLA-10 Arcane Charge fires ungated, unlogged, and untethered from its Action Surge trigger

## Overview
Verified 2026-10-01 E2E (test-campaign, EvasiveFighter lv18 → temp Eldritch Knight, Bandit 1 joined). The feature is implemented as a free-floating teleport action with a confirm popup, but none of the RAW/manifest trigger/resource gates exist, and the press never logs. Per the strict trichotomy (automation fires but ignores rule gates / zero log = BUG, cf. CLA-004 precedent), filed FAIL.

## Expected Behavior (canonical app data)
`public/data/2024/classes.json` Fighter `majors[2]` Eldritch Knight lv15:
- Trigger: "When you use Action Surge, teleport up to 30 feet before or after the additional action."
- Row automation: `{type:'arcane_charge', distance:'30 ft', casting_time:'1 action'}`.
App rule: every automation must log to the campaign log when triggered.

## Actual Behavior
- Arcane Charge press → `.sp-modal` "Teleport up to 30 ft…" → Teleport → popup "Arcane Charge: Teleported 30 ft to an unoccupied space you can see." (screenshot `.opencode/plans/cla-010-teleport-confirm.png`). Teleport text delta is live.
- ZERO campaign-log entries for the teleport (final log = join+initiative only) — ArcaneChargeModal confirm never calls addEntry.
- ZERO uses/once-per-short-rest tracking (no counter row; no change-data resource key).
- ZERO trigger gate: fired successfully on AberrantSorcerer's turn with NO Action Surge used that turn; surge press itself opens no teleport affordance (data models zero linkage).
- No position/te marker (gridless — §70 advisory family, acceptable in itself).

## Steps to Reproduce
1. test-campaign, EvasiveFighter lv18, wizard step-7 → Eldritch Knight, Save, wait 15s.
2. EB join Bandit, Join Encounter.
3. On any creature's turn (surge not required), click "Arcane Charge:" row → Teleport → Done.
4. Campaign log: no arcane_charge entries; change-data: no uses key. Repeat unlimited.

## Likely Location
- `src/services/automation/handlers/class-sorcerer/arcaneChargeHandler.js` (mis-filed under sorcerer) → `automation/index.js:389` → `automationRouter.js:204 pushTo('actions')` → `useCharActionsAutomation.js:262` → `ArcaneChargeModal.jsx` (rendered via `CharActionModals.SecondaryModals.jsx:374`).
- Action Surge linkage would need hooking into the Action Surge use path (see bug-CLA-004-action-surge-pinned-round-once-per-turn-latch.md for the surge latch state).

## Notes / design options
- Option A: gate ArcaneChargeModal behind actionSurgeUsedThisTurn state (blocked until CLA-004 round-stamp fix lands — same getCurrentCombatRound() campaignName-less pin defect).
- Option B (cheap): add `ability_use` log on teleport confirm + uses-per-rest tracking mirroring Action Surge counters; keep teleport advisory.
- Manifest source paths stale (classFeatureHandler family); real chain above.
- Checkpoint: `.opencode/plans/checkpoint-CLA-010.md`.
