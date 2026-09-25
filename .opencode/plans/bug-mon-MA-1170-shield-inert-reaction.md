# MA-1170 — Mind Flayer Arcanist Shield: prose-only reaction row, zero automation = fully inert (FAIL(b)/DATA+CODE-GAP)

## Overview
Mind Flayer Arcanist's `Shield` reaction (`public/data/monsters.json`, `reactions[0]`) carries only `name`/`trigger`/`description` — no `automation` dict, no `usage`/`uses`, no `acBonus`. The gated-reaction chip gate keys **solely** on `automation.effect`, so the row renders as plain inert prose. Additionally, unlike the parry twins (MA-1140), the gated-reaction registry contains **no `shield` effect at all** — even authoring `automation.effect:'shield'` alone would arm a chip that resolves to `null`. This is MA-1140/MA-0681 family FAIL(b) plus a consumer gap (§no-consumer family).

## Expected (authored row — task target verbatim)
```json
{"id":"MA-1170","monster":"Mind Flayer Arcanist","monsterIndex":"mind-flayer-arcanist","actionIndex":0,
 "actionName":"Shield","category":"reactions","actionType":"other",
 "trigger":"The mind flayer is targeted by a spell",
 "description":"The mind flayer casts Shield in response to that spell's trigger, using the same spellcasting ability as Spellcasting."}
```
RAW (2024 Monster Core): reaction when targeted by a spell → casts Shield, +5 AC against the triggering attack roll (AC 16 → 21 vs that attack).

## Actual
- **CHECK 1 — STATIC disk:** `public/data/monsters.json` mind-flayer-arcanist `reactions[0]` keys = `['name','trigger','description']` ONLY. No `automation`, no `usage`, no `uses`, no `acBonus`, no `"reactive"` — no structured keys of any kind. Trigger/description byte-match the task row. Monster AC 16.
- **CHECK 2 — consumers:**
  - `getGatedMonsterReaction` src/components/encounter/MonsterCardHelpers.js:1556-1559 — `action?.automation?.effect` ONLY → null for this prose row.
  - `GatedReactionSlot` src/components/encounter/MonsterAction.jsx:164-169 — `if (!def) return null` → zero chip affordance.
  - `MonsterCardModal.jsx:2139` — `if (!getGatedMonsterReaction(action)) return;` click guard.
  - `resolveMonsterGatedReaction` MonsterCardHelpers.js:1622-1669 dispatches ONLY: counterspell, hellish_rebuke, parry, split, heal, attack, portent, limited_foresight, elemental_absorption, redirect_attack, jinx_negate, feather_fall. **No `shield` branch.**
  - `GATED_MONSTER_REACTIONS` registry MonsterCardHelpers.js:956-1095 — **no `shield` key** (only fa-shield ICONS on counterspell/parry lines — not the effect).
  - PC-side Shield consumer EXISTS: `getShieldAcBonus` src/hooks/combat/loggedDiceRollUtils.js:49-53 (`activeBuffs.some(b => b.effect==='shield') ? 5 : 0`), read generically against ANY target name at src/hooks/combat/useLoggedDiceRollAttack.js:481 (`acTargetName`). Producer of `effect:'shield'` is PC-only: `src/services/automation/handlers/shieldHandler.js:39` (PC Shield spell). Non-test grep of `effect:'shield'` producers: tests + shieldHandler only — **no monster-side producer; the +5 AC channel is live but unreachable from any monster reaction row**. MonsterCardModal computes only `shieldOfFaithBonus` (:1141-1142, :1711) for monsters — no Shield reaction.
- **CHECK 3 — LIVE (test-campaign header-verified):** + NPC join Mind Flayer Arcanist 143/143 AC16 + Bandit 11/11 AC12, round 1, GET-combatSummary-proof. Card open (.mc-overlay): Shield row HTML = `<div class="mc-action"><strong>Shield.</strong><span>The mind flayer casts <strong>Shield</strong> in response to that spell's trigger, …</span></div>` — buttons=0, role=button=0, mc-dice-link=0, tabindex=0, input/select/a=0. Center-row fresh-rect click probe ×2 (rects identical 918.5,1033.26,640×35.69): log delta 0→0, zero popups, card stays open. Zero affordance + zero delta = FAIL(b) per MA-1140 codification. Trigger realistically unreachable via UI anyway: no monster spell-target pipeline arms/gates any monster reaction on "targeted by a spell".
- **CHECK 4 — NUMBERS:** "+5 AC" / "10 AC" absent from row text AND disk row — no authored `ac_bonus` anywhere. The only number ever attached to this reaction (RAW +5) never exists in data or DOM. Inert text = FAIL(b)/DATA twin of MA-1140 ("adds 5 to its AC" also un-encoded there).

## Cosmetic (§162 family)
Authored `trigger` string "The mind flayer is targeted by a spell" is NOT rendered in the row innerText (row shows name + description only) — GM must consult source book. Cosmetic-only; does not change verdict.

## Steps to Reproduce
1. test-campaign → Initiative → `+ NPC` → autocomplete exact-click "Mind Flayer Arcanist" + "Bandit".
2. Click Arcanist `.creature-avatar` → card opens AC 16 / HP 143.
3. Scroll to Reactions: "Shield." row — pure prose `<strong>`+`<span>`; DOM audit buttons/role=button/dice-links all 0.
4. Click row center ×2 → nothing happens, log unchanged (`GET /api/campaigns/test-campaign/log` count 0→0), no popup.
5. No pathway exists to fire Shield: no gated chip, no resolver branch, no registry effect, and no monster-triggered spell-target event pipeline.

## Likely Location
- **DATA (root cause):** `public/data/monsters.json` mind-flayer-arcanist `reactions[0]` — missing `automation` block + `acBonus`.
- **CODE GAP (secondary, unlike parry twins):** no `shield` effect in `GATED_MONSTER_REACTIONS` (MonsterCardHelpers.js:956) and no `def.effect === 'shield'` resolver branch in `resolveMonsterGatedReaction` (:1622+) — data-only fix would arm a chip that resolves null.

## Fix (per MA-1140 fix shape + new shield effect branch)
Data — on mind-flayer-arcanist `reactions[0]`:
```json
"automation": {"type":"reaction","trigger":"targeted_by_spell","effect":"shield","acBonus":5},
"usage": "At Will", "uses": 999, "maxUses": 999
```
Code — mirror the MA-0341 parry press-over-pending shape:
1. `GATED_MONSTER_REACTIONS.shield = { effect:'shield', trigger:'targeted_by_spell', label:'Shield', icon:'fa-shield' }`.
2. Resolver branch `def.effect === 'shield'`: gate on campaign `lastAttack` identity (spell-origin attack, this monster as `targetName`, pending-Done window per MA-0341/MA-0329 lineage) + 1/round latch (`_shield_usedRound`, MA-0013 shape) + At-Will sentinel (§60); stamp `activeBuffs {effect:'shield', acBonus:5}` — **zero new AC math needed**: `getShieldAcBonus` (loggedDiceRollUtils.js:49, +5) already folds via `useLoggedDiceRollAttack.js:481` against any target name; consumption/cleanup rides `attackPostProcessing` (parry_consumed lineage).
`acBonus` MUST be **5** (RAW Shield). CamelCase automation keys per MA-0643/0681 byte-shape convention.

## Precedents
MA-1140 Marilith Parry FAIL(b) (prose-only reaction, gated chip needs automation.effect → zero affordance; MA-0341 fix template), MA-0681 Elemental Absorption FAIL(b) same family, MA-0544/MA-0548 inert-reaction twins, MA-1120 Mage Protective Magic (counterspell consumer cite). Shield is the first reaction in the family with **no registry effect entry at all** — new pitfall for the playbook.

## Registry suggestion
```
"MA-1170": {"actionName":"Shield","actionType":"other","verdict":"FAIL(b)-DATA+CODE-GAP inert reaction (MA-1140 twin + no-shield-effect gap)",
"note":"mind-flayer-arcanist reactions[0] keys name/trigger/description only, AC16, no automation/usage/acBonus; live card Shield row strong+span only, buttons/role=button/diceLinks=0, center-row fresh-rect clicks x2 log delta 0-0 zero popups; gate getGatedMonsterReaction Helpers:1556 automation.effect ONLY -> GatedReactionSlot MonsterAction.jsx:164 null; NO 'shield' effect in GATED_MONSTER_REACTIONS:956 nor resolveMonsterGatedReaction:1622 dispatch — data-only fix arms null-resolving chip; PC-side shield channel live unreached: getShieldAcBonus loggedDiceRollUtils:49 +5 via useLoggedDiceRollAttack:481 acTargetName generic, producer shieldHandler.js:39 PC-only; trigger not rendered §162 cosmetic; fix automation{type:reaction,trigger:targeted_by_spell,effect:shield,acBonus:5}+At Will 999 + registry shield entry + resolver stamp {effect:'shield'} activeBuffs MA-0341 shape"}
```
