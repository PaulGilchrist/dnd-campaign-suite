# Bug MA-0642 — Drow Elite Warrior "Hand Crossbow": fail-by-5 unconscious rider inert (missing save_margin data field)

## Overview
MA-0642 (Drow Elite Warrior, `drow-elite-warrior`, actions[2] "Hand Crossbow") is the byte-shape twin of MA-0639 (Drow Hand Crossbow, `drow`, attack row fixed 2026-09-20). The app-side save-margin machinery is fully LIVE (MA-0639 fix: `parseSaveMarginClause` in `MonsterCardHelpers.js:285` reading the structured `action.save_margin` key → threaded via `MonsterCardModal.jsx:881/1293` buildSaveOptions/buildAbilitySaveRollContext → `saveProcessing.applySaveMarginRider` at `saveProcessing.js:488`, armed at `:863` only when `context.saveMargin` is non-null). This row never authored the `save_margin` field, so the parser returns null and the unconscious rider is inert-by-construction. The base poisoned save rider works exactly as expected; only the "fails by 5 or more → also unconscious" RAW clause is unenforced.

## Expected (canonical clause)
"If the saving throw fails by 5 or more, the target is also unconscious while poisoned in this way."
A DC 13 Constitution save failing with (13 − saveTotal) ≥ 5 must grant UNCONSCIOUS in addition to POISONED.

## Actual (live, test-campaign, 2026-09-20)
- **Attack chip (+7):** live and clean — nat17+7=24 vs AC12 HIT; ONE `roll damage` entry formula "1d6 + 4" total=8 piercing, `finalDamage 8 == |hp_change −8|` (Bandit maxHp staged 999, unclamped); NO save rides the attack chip (no save log, top-level targetEffects null — §114/§156 two-chip fork honored).
- **Save chip (DC 13 CON):** live, NPC-inline auto-roll seam; warding_bond rig `saveBonus:-3` folded into saveTotal live (`wardingBondSaveBonus:-3` on victim entries — §167):
  - nat20 (pre-rig, +0) total=20 → `saveResult:"success"` — zero conditions applied, no poisoned, no unconscious. ✓
  - nat15 total=12 → fail by 1 (<5): `condition applied Poisoned` (sourceAbility "Hand Crossbow", source meta), unconscious ABSENT. ✓ per spec.
  - **nat11 total=8 → fail by 5:** `condition applied Poisoned` ONLY — unconscious ABSENT. ✗ RAW violation.
  - **nat10 total=7 → fail by 6:** Poisoned ONLY, unconscious ABSENT. ✗
  - **nat6 total=3 → fail by 10:** Poisoned ONLY, unconscious ABSENT. ✗
- Runtime/change-data truth after fail-by-≥5 saves: `Bandit 1.activeConditions == ["poisoned"]`; `lastAttack.saveConditions == ["poisoned"]`; whole-log "unconscious" scan hits only `hp_change.isUnconscious:false` and the description snapshot string — zero unconscious grants anywhere.

## Steps to reproduce
1. localhost:5173, select `test-campaign`; EB-join "Drow Elite Warrior" + "Bandit" (exact td anchor).
2. Stage victim: full-store cs POST maxHp/currentHp 999; stamp `Bandit 1.activeBuffs [{effect:'warding_bond',saveBonus:-3}]` via full-store POST (folds live into saveTotal per §167).
3. Arm Bandit 1 on the attacker's OWN initiative card select; open attacker card.
4. Click "DC 13 Constitution" save chip; on any fail-by-≥5 roll (nat ≤ 11 with −3 rig), observe: `condition applied Poisoned` logs, but no unconscious condition ever applied (logs, activeConditions, lastAttack all poisoned-only).

## Likely Location
**DATA — one field.** `public/data/monsters.json` → `drow-elite-warrior` actions[2] lacks `save_margin: {"fails_by": 5, "also": "unconscious"}`.
The code consumer is already live: `parseSaveMarginClause` (`src/components/encounter/MonsterCardHelpers.js:285`) arms ONLY on the structured `save_margin` dict (prose never parsed); `saveProcessing.applySaveMarginRider` (`src/hooks/combat/saveProcessing.js:488/863`) grants unconscious on (saveDc − saveTotal) ≥ failsBy after the base grant, with ONE merged addExpiration clock.
The fixed Drow twin (MA-0639, commit c3287c828, index `drow`, Hand Crossbow row) carries byte-identical description prose and DOES author `save_margin:{fails_by:5,also:"unconscious"}` — disk twin-diff confirmed this session; adding the same one field completes MA-0642.

## Notes
- Advisory: victim save log prints `dcSuccess:"half"` (MV-20 default) but riderOnly save chips strip the damage formula — zero hp_change on save successes observed, so no live half-leak; `dc_success:"none"` remains the honest copy fix.
- Save-chip popup prints cosmetic "DC Unknown" (attacker-dupe surface, §138); victim `roll save` entry carries saveDc:13 truth.
- Attacker-side dupe `roll save` entry carries raw d20 with bonus:0 (§96); victim entry is machine truth.
- "Wakes up if it takes damage / shake awake" stays §69 advisory-unbuilt (wake-on-damage zero consumer).
- No monsters.json/code edits performed — verification only. Cleanup done: admin clear-change-data + clear-log, GET verified `{}` / `[]`.
