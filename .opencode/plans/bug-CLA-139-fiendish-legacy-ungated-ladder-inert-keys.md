# Bug CLA-139 — Fiendish Legacy: lv-ladder un-gated, runtime keys inert (two-channel twin), chooser one-shot

## Title
Fiendish Legacy (Tiefling): cantrip + poison resistance grant work live, but ladder spells (lv3/lv5) render at lv1/lv3 un-gated, the handler's `_fiendishLegacy*` runtime keys have ZERO consumers (real channel = race.subrace — CLA-118 two-channel twin), and the chooser is one-shot (no legacy switch lane).

## Overview
Verified 2026-10-04, test-campaign. Created **TieflingTest** lv1→3 2024 Tiefling (subrace "Abyssal Tiefling" via creation wizard step-4; no legacy chooser at creation) / Sorcerer.

## Expected Behavior (races.json:880)
Choose legacy (Abyssal/Chthonic/Infernal) → lv1 benefit (cantrip, resistance); ladder spells gated lv3/lv5; spellcasting ability per legacy.

## Actual Behavior
1. PASS: lv1 cantrip row `Poison Spray 30ft +1 1d12` + cast ledger `final:12`; `Resistances: Poison` LIVE: Wizard lv20 Poison Spray raw 30 → **15 applied** (resisted via race-rules consumer applyDamage.js:39/:230).
2. FAIL(a) ladder un-gated (CLA-118 twin): lv1 shows `Ray of Sickness (1)` castable row (spell's own level passes slot filter); lv3 shows `Hold Person (2)` too — both ladder spells granted simultaneously; no `level<=` gate in applyLineageFeatureSpells (spellCalc2024.js:166 — same site as CLA-118 FAIL(b)).
3. FAIL(b) two-channel: fiendishLegacyHandler.js:3-7 writes `_fiendishLegacy{Selection,Ability,Cantrip,Level3,Level5}` — grep: ZERO consumers; real grants come from `race.subrace.name` — runtime keys inert decorations; all five stamped level-agnostically at lv3.
4. FAIL(c) chooser one-shot: FiendishLegacyModal radio click reverted (React synthetic) → confirm wrote "Abyssal"; reopen = "already selected" — no switch lane exists (handler design).
5. Creation wizard: no legacy chooser — only subrace combobox.

## Steps to Reproduce
1. Create lv1 Tiefling/Abyssal Tiefling Sorcerer → sheet shows Ray of Sickness at lv1 (bug a).
2. Pick legacy via special-actions row → reopen → "already selected" (bug c). GET change-data keys exist but are read by nothing (bug b).

## Likely Location
- `spellCalc2024.js:166 applyLineageFeatureSpells` — add level gate (shared fix w/ CLA-118).
- Handler keys vs race.subrace: unify channels (handler should drive or be removed).
- Add legacy-switch affordance.

## Notes
- New-char damage silently fails until currentHitPoints seeded (sheet HP hidden-input → native setter → Enter; applyDamage.js:387). Edit-mode Level field = input whose previousElementSibling starts "Level *".
- TieflingTest kept lv3 (registry). Admin cleared GET-empty. Verified 2026-10-04.
