# CLA-086 Disciple of Life — Cure Wounds upcast burns higher slot but resolves at base level

## Overview
Divine_Cleric (Life Domain lv17, 2024, test-campaign) casting Cure Wounds upcast to Level 3 via the sheet cast modal's "Cast at Level" radio consumes a **Level 3** spell slot, but the spell executes at its **base Level 1**: dice under-resolve (2d8 instead of 6d8) and Disciple of Life pays **+3 (2+1) instead of +5 (2+3)**. Base-level lv1 cast is exact. Passive fold, consumer, lv1 scaling, logs, and cantrip slot-gate all verified live — the defect is the upcast slot-level lost between the gated confirm flow and execution.

## Expected
App data `public/data/2024/classes.json` Cleric → Life Domain → Disciple of Life:
> "When a spell you cast with a spell slot restores Hit Points to a creature, that creature regains additional Hit Points on the turn you cast the spell. The additional Hit Points equal 2 plus the spell slot's level." (automation `{type:'passive_rule', effect:'bonus_healing', bonusExpression:'2 + spell_slot_level'}`)

App data `public/data/2024/spells.json` Cure Wounds `heal_at_slot_level`: `"3": "6d8 + MOD"`.

Casting at selected Level 3 with a Level 3 slot consumed (WIS +3, Supreme Healing lv17 maximizes dice):
- heal = max(6d8)=48 + 3 + (2+3)=5 → **+56**
- ledger formula `6d8 + 3 + (5 Disciple of Life)`, bonusDetails `[{Disciple of Life, 5}]`
- slot accounting: lv3 3→2, lv1 untouched

## Actual
Selected "Level 3 6d8 + 3 3 slots" radio (verified `checked:true` pre-cast). Ledger (GET /api/campaigns/test-campaign/log):
```
hp_change EvasiveFighter delta:22 currentHp:42 maxHp:94 isHealing:true
formula:"2d8 + 3 + (3 Disciple of Life)" bonusDetails:[{name:"Disciple of Life",amount:3}] note:"Cure Wounds"
```
- EF healed 20→42 (+22 = 2d8max+3+3 DoL) — **base-level dice and base-level DoL bonus**.
- change-data: `spell_slots_level_3 3→2` (consumed at upcast level), `spell_slots_level_1` held at 2.
- Confirm-flow cast log stamp also prints `spellLevel: 1` (same stale key).

So the app pays a lv3 slot and delivers a lv1 spell: −34 HP shortfall, DoL +3 instead of +5, violating "2 plus the spell slot's level" against the slot actually expended.

## Steps (verified 2026-10-02, http://localhost:5173, test-campaign)
1. Initiative board seeded with all PCs; EF HP input (card spinbutton, trusted fill+Enter) → 40/94.
2. Divine_Cleric sheet → Cure Wounds row → radio "Level 1" → Cast Spell → picker radio EvasiveFighter → "Cast Cure Wounds".
   → PASS half: `hp_change` delta **22** (2d8max 16 + WIS 3 + DoL **3**), lv1 slot 4→3 *(baseline 4 after reseed; a first attempt aborted on §138 caster-`activeConditions`-missing zero-sum, hydrated via initiative-card Add→Deafened→Apply)*.
3. EF HP input → 20/94 (missing 74, no clamp risk).
4. Same cast, radio "Level 3" (checked:true) → target EF →Cast.
   → slot lv3 3→2 burns, but heal = +22 at lv1 with DoL +3 (this bug).
5. (Gate proof) EF → 0 HP; Spare the Dying cantrip → stable at 0, `spellLevel:0`, zero slot consumed, zero DoL entry — slot gate correct.

## Likely Location
Slot **consumption** and slot **resolution** disagree on which key carries the upcast level in the gated confirm flow:
- `src/hooks/combat/useConfirmableFlow.js` `createConfirmHandler` (~L79-92): consumes correctly — `const upcastLevel = pending.spell.upcastLevel; prepareSpellCast(..., { isUpcast, upcastLevel })` — but then `applyFn(pending, result)` without threading upcastLevel into metaCtx (ungated lane `useSpellMetamagicGates.js:134-136` has the backfill `if (!metaCtx.slotLevel && upcastLevel) metaCtx.slotLevel = upcastLevel`; the confirm-flow lanes lack it).
- `src/hooks/combat/spellGateHelpers.js` `makePending` (~L96-104): `spellLevel: spell.level || 0` — ignores `spell.upcastLevel` (the spell object from SpellDetailPopup DOES carry `isUpcast`/`upcastLevel`; see `SpellDetailPopup.jsx` handleCast).
- `src/hooks/combat/useSpellMetamagicFlow/useSimpleSpellHandlers.js` `runCureWounds` (~L227-231): `d.onExecute(pending.spell, { targetName, slotLevel: pending.spellLevel })` → execution `resolveGenericHeal` (`execution/index.js` ~L421-428) `metaCtx?.slotLevel || spell.level` → lv1.
- `runHealingWord` (~L212-215) passes `slotLevel: pending.spellLevel` into `triggerHealingWord` — **same seam, lv3-upcast Healing Word presumed identically broken (not probed)**.
- Secondary (code-read, unprobed): `createSkipHandler` (~L125) `rollbackSpellSlot(..., pending.spellLevel || 0)` would refund a lv1 slot while the lv3 slot was the one consumed — skip-after-upcast inflation risk.

Minimal fix template (CLA-312 gateLevel pattern already in repo): in `runCureWounds`/`runHealingWord` use `pending.spell?.upcastLevel || pending.spellLevel`; or stamp it in `createConfirmHandler` metaCtx before `applyFn`; `makePending` could carry `spellLevel: spell.upcastLevel || spell.level` but that also changes confirm-log `spellLevel` stamps for every gated spell — pick one owner, keep single source of truth.

## Notes
- Host: Divine_Cleric lv17 Life Domain disk-verified (`public/campaigns/test-campaign/Divine_Cleric.json` subclass {'name':'Life Domain'}, WIS 16). Cure Wounds castable row present WITHOUT disk `spells[]` edit — Life domain-spell runtime fold.
- Passive fold fiber-probed live: `automation.passives` carries `{Disciple of Life, passive_rule, bonus_healing, '2 + spell_slot_level'}` (+ Supreme Healing `maximize_healing_dice` — heals are dice-maximized at lv17; DoL flat bonus unaffected by maximize).
- §CLA-012 Abjuration→Arcane Ward worry: N/A — ward belongs to DivinationWizard, not this cleric. Blessed Healer (Life lv6) rides the lane with a `delta:0` self-entry (caster at full HP) — correct othersOnly behavior, harmless.
- Cosmetic carry-on: gated cast log `targetName:"AasimarTest"` picker-default stamp (machine truth = hp_change.targetName); cast `spellLevel` log stamp reads the same stale `pending.spellLevel`.
- lv1 lane ledger shape: ONE merged `hp_change` entry (`formula` string + `bonusDetails[]`), not two entries.
- §138 abort fingerprint reproduced: first sheet-cast threw `activeConditions must be an array for caster`, burned lv1 slot 4→3 zero-sum; re-cast OK after Add→Deafened→Apply hydration on initiative card.
- Cleanup: Long Rest on cleric, admin-cleared change-data {} + log [], board re-seeded defaults; registry annotated.
