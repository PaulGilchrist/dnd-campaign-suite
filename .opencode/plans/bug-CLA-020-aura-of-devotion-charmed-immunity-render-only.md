# CLA-020 — Aura of Devotion: Charmed immunity is render-only; no consumer blocks condition application (FAIL-b, CLA-019 twin)

## Overview
2024 Paladin Oath of Devotion lv7 feature (app data `public/data/2024/classes.json:7583`, automation `{type:"passive_buff", target:"allies_in_range", range_expression:"10_ft", conditionImmunity:"charmed", casting_time:"passive"}`). Identical mechanism to CLA-019 Aura of Courage (Frightened): the immunity is COMPUTED by `computeAuraComboEffects()` and RENDERED on the sheet ("Immunities: Frightened, Charmed"), but **no condition-application seam ever consults it**. Live Charm Person DC 16 charms an aura-protected ally PC exactly like the unprotected control — zero differential.

## Expected (canonical)
"You and your allies have Immunity to Charmed condition while in Aura of Protection." A failed WIS save against a Charmed source inside the aura must NOT apply Charmed (refusal/suppressed application), while an unprotected target failing the same save IS Charmed.

## Actual
- Charm lands on aura-protected ally PC with zero refusal:
  - `change-data EvasiveFighter.activeConditions == ["charmed"]` (root) + `activeConditionMeta.charmed {dc:10, ability:"wis"}` + log `condition applied | EvasiveFighter | Charmed` — via `addCondition` (`src/services/combat/conditions/conditionSaveService.js:117-133`), whose `playerIsImmuneToCondition` gate returns false; log contains ZERO "immune" mentions app-side.
  - Unprotected control Thug 1 (EB join, failed real WIS save roll 13+0 vs DC 16, save_result logged `success:false`) `activeConditions == ["charmed"]` + `condition applied ... reason: "Charm Person spell"` → **ZERO delta** vs protected ally (playbook FAIL-b fingerprint, same as CLA-019).
  - Real spell fails: 3 Charm Person casts burned all lv5 Pact slots (GET spell_slots_level_5 3→0); EvasiveFighter saved honestly 18+5=23, host ElderPaladin saved honestly 8+10=18 (+5 aura of protection, +5 WIS? — aura+prof stamped by engine); control Thug 1 failed honestly and was charmed. Protected fail-leg completed deterministically at the SAME add seam (initiative-card EffectAdder Charmed → `addCondition`), mirroring the CLA-019 host-leg methodology.
- Meanwhile the ElderPaladin sheet renders Special Actions row **"Aura of Devotion:"** + canonical prose and **"Immunities: Frightened, Charmed"** (Charmed = live aura merge; disk `immunities: []`) — immunity text stays visible while a protected ally is in fact Charmed. Screenshot `cla020-ef-charmed-badge.png` (EF initiative card badge "Charmed DC 10" live under the Ancients-host aura), `cla020-ep-sheet-aura-devotion.png` (host sheet both rows + Charmed line).

## Steps (repro)
1. test-campaign. Host ElderPaladin lv20 — subclass temporarily swapped Ancients→**Oath of Devotion** (Edit wizard step 7, selectOption + trusted Save, 15 s debounce; Aura of Devotion is a Devotion-major lv7 feature and does NOT render on Ancients).
2. RENDER PASS: Special Actions row "Aura of Devotion:" + "Immunities: Frightened, Charmed".
3. EB join Thug 1 (control); 15 combatants in initiative. Seed HexWarlock (§SP-002: EffectAdder Deafened→Apply→×) — no first-cast crash.
4. HexWarlock lv14 (CHA +3, DC 16; Charm Person already in spells[]) casts Charm Person ×3 (lv5 Pact slots default): EvasiveFighter (23, save), ElderPaladin host (18, save), Thug 1 (13 vs 16, FAIL → `["charmed"]` applied + log).
5. Deterministic protected fail-leg: EvasiveFighter initiative-card EffectAdder → Charmed → Apply → `activeConditions ["charmed"]` lands, no refusal, log entry present.
6. Screenshots captured; cleanup below.

## Likely Location (same root as CLA-019 — do not re-derive)
- `src/services/combat/auras/auraComboEffects.js:29` — `PASSIVE_APPLIERS['Aura of Devotion'] = applyConditionImmunity(passive, acc, 'charmed', name)` — the SAME `applyConditionImmunity` helper as Aura of Courage (:28). Compute layer is correct (unit pins `auraComboEffects.test.js:253-300` cover charmed specifically).
- Consumers of `computeAuraComboEffects`: `CharSheet.jsx:553` (render only → `charSummaryCalc.js:169-171` "Immunities:" merge) + `applyDamage.js:634-639` (**`.resistances` only** — `.immunities` discarded). `immunitySources`: zero consumers outside auraComboEffects + test.
- Condition-apply gates are aura-blind for charmed exactly as for frightened: `playerIsImmuneToCondition` (`automationImmunities.js:122-157`) checks static `playerStats.immunities`, own `passive_immunity`/`condition_immunity_while_active`/`land_resistance`, activeBuffs, PfE&G ward (:56 charmed-aware but ward-only); Aura of Devotion is `type:"passive_buff"` so `automationGrantsImmunity` never matches. Callers all aura-blind: `saveProcessing.js:1062`, `conditionSaveService.js:125`, `handleNpcSaveDamage.js:238`. Charm-specific handlers (`charmPersonHandler.js`, `charmSpellUtils.js`) contain ZERO immunity/aura references — Charmed writes straight through.

## Fix direction
Identical to CLA-019: feed `computeAuraComboEffects().immunities` (self-filtered, range-checked, cannot-act-gated like applyDamage's resistances) into every condition-apply seam (`applyFailedSaveConditions`, `addCondition`, EffectAdder/NPC seams), or extend `playerIsImmuneToCondition` with an aura-context param. Fixing CLA-019 fixes CLA-020 for free — same helper, same seam.

## Notes
- Brief said lv18; app data models Aura of Devotion at **lv7** (canonical 2024 Oath of Devotion). Host lv20 qualifies either way.
- Render half PASSES (row + prose + live radius "(30 ft.)" from lv18 Aura Expansion on the Aura of Protection row, CLA-018 model).
- Session cleanup: subclass RESTORED Ancients (disk GET-verified), Thug 1 removed (cs = 14 PCs), HexWarlock spells[] untouched (Charm Person was already known — no wizard step-14 edit needed), slots+conditions wiped by Admin Full Reset (change-data {} + log [] rechecked quiet).
