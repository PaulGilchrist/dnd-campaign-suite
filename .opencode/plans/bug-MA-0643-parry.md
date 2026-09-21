# Bug MA-0643 — Drow Elite Warrior "Parry" (reactions[0]): prose-only, zero affordance, inert

## Overview
MA-0643 (Drow Elite Warrior, index `drow-elite-warrior`, AC 18) reaction row "Parry" carries NO `automation` dict and NO `usage`/`uses` fields. The live PARRY machinery (§111) keys solely off `automation.effect`, so the row is inert: no card affordance, no gate, no producer ever fires. The drow never gains +3 AC against incoming melee hits.

## Expected (canonical)
> "The drow adds 3 to its AC against one melee attack that would hit it. To do so, the drow must see the attacker and be wielding a melee weapon."

Incoming melee attack roll landing 18–20 vs the drow should be converted to MISS by the auto-resolved Parry reaction (+3 AC → 21), with an `ability_use` spend log and `parryAcBonus:3` / `effectiveAc:21` in the attack resolution (spend-limited to one attack per RAW; unlimited per round per RAW — At Will sentinel).

## Actual
1. **Disk (ground truth):** `public/data/monsters.json` Drow Elite Warrior `reactions[0]` = `{ "name": "Parry", "description": "The drow adds 3 to its AC..." }` — name+description ONLY; NO `automation`, NO `usage`, NO `uses`.
2. **DOM affordance audit (live):** opened `.mc-overlay` via initiative avatar (`img[alt="Drow Elite Warrior 1"]`). Reactions section renders plain prose text `"Parry. The drow adds 3 to its AC..."` — ZERO clickable affordance: all 14 `.mc-dice-link` chips on the card belong to saves/skills/Shortsword/Hand Crossbow (none inside a reactions `.mc-action`), zero `[class*="reaction"]` elements, only button on card = close ×, 0 selects in reactions block.
3. **Live control probe (Gladiator 1 +7 Spear vs Drow Elite Warrior 1 AC 18, own turn, activeCreatureName="Gladiator 1", target armed on attacker's initiative card):** 20 Spear attacks logged. Every attack: `targetAc:18`, `effectiveAc:18`, `parryAcBonus:0`.
   - **Parry-window hits (would-be blocks):** nat 12 +7 = **19 vs AC 18 → hit:true** (twice; first occurrence applied -dmg while drow alive at ~53 cumulative of 71 HP). With parry authored, AC 21 → these must be MISS.
   - Boundary companions: nat 15+7=22 hit ×3, nat 19+7=26 hit ×3, nat 20+7=27 crit — 21+ correctly hits even against parried AC 21; misses 8–17 correct.
   - **ZERO** `automation` entries app-wide in log (0), **ZERO** `ability_use` (0), **ZERO** real parry fire or `parry_refused` refusal entries; 9 hp_changes (-9…-12, drow clamped to 0 = dead-clamp advisory §129).

## Grep evidence — live consumers vs unauthored row
- LIVE machinery (code present, armed only by `automation.effect`):
  - `src/components/encounter/MonsterCardHelpers.js:1218` `getGatedMonsterReaction(action)` → `null` unless `action.automation.effect`
  - `MonsterCardHelpers.js:1054` `buildParryBuff` (`acBonus = action.automation.acBonus`), `:1077` `resolveMonsterParry` (gate → buff to `activeBuffs` → `lastAttack.parryAcBonus` → `ability_use` log), dispatcher `resolveMonsterGatedReaction` `:1284/:1298`
  - `src/components/encounter/MonsterAction.jsx:138` `GatedReactionSlot` → renders affordance only when `getGatedMonsterReaction` returns a def
  - `src/components/encounter/MonsterCardModal.jsx:1808` `if (!getGatedMonsterReaction(action)) return;`
  - `src/hooks/combat/useLoggedDiceRollAttack.js:459` `ctx._parryAcBonus = getParryAcBonus(...)` → `hitResolution.js:284` adds `_parryAcBonus` to effective AC; popup label `+N Parry` `DiceRollResult.jsx:933`
- DATA: Drow Elite Warrior Parry row = automation NO (verified scan: automation-authored Parry twins = Bandit Captain acBonus:2, Death Knight:6, Death Knight Aspirant:4; Drow Elite Warrior inert family with Erinyes/Gladiator/Knight/Marilith/Nimblewright/Noble/Hobgoblin Warlord/Warrior Veteran).

## Steps to reproduce
1. `npm run dev`, open http://localhost:5173, select **test-campaign** (verify header).
2. Encounters → search "Drow Elite Warrior" → checkbox → Join Encounter; search "Gladiator" → checkbox → Join Encounter. (cs: Drow idx 0 AC18, Gladiator AC16 +7 Spear.)
3. Initiative → click Drow avatar → audit Reactions section: prose only, zero chips (DOM counts above).
4. Close card; walk/confirm `activeCreatureName:"Gladiator 1"`; arm `[data-testid="target-select"]` = Drow Elite Warrior 1 on Gladiator's own card; click Spear +7 chip ×20.
5. GET `/api/campaigns/test-campaign/log`: all attacks `targetAc:18 parryAcBonus:0`; window hit nat12+7=19 remains HIT (×2, never 20-rolled); zero parry/automation/ability_use entries.

## Likely Location
**DATA — one-field fix.** `public/data/monsters.json` Drow Elite Warrior `reactions[0]` needs the MA-0341 Bandit Captain authored template shape:
`"usage": "At Will", "uses": 999, "maxUses": 999, "automation": { "type": "reaction", "trigger": "melee_hit", "effect": "parry", "acBonus": 3 }`
**`acBonus` MUST be 3** per this monster's canonical text (Bandit Captain twin ships 2). No code change required (§111 machinery live). Precedent: MA-0565.

## Notes
- Prompt-injection vigilance: no fabricated outputs off-site observed this session; URL echoes matched intent; all verdict data from own curl/DOM reads.
- Plan pitfall recorded: "Veteran +7 canonical pick" NOT present in this monsters.json (Veteran Longsword +5); Gladiator +7 Spear used (meets ≥+6).
- Post-clear: log `[]` + change-data `{}` GET-verified after hard reload (no resurrection).
- 20-attack spread: 9 hits / 11 misses; boundary straddle 19 < 21 confirmed twice on living victim.
