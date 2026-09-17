# BUG MA-0341 — Bandit Captain "Parry" reaction: advertised trigger/effect, zero automation

**Verdict: FAIL** (ungated inert reaction row, MA-0284/0329 class)

## Row
- id MA-0341 | Bandit Captain (`monsterIndex: bandit-captain`) | category reactions | actionIndex 0 | name Parry | manifest actionType "attack" (cosmetic only — render keys off `attack_bonus`/`automation`, neither present)
- Advertised: "Trigger: hit by a melee attack roll while holding a weapon. Response: +2 AC against that attack."

## Grep null-proof (monster path)
- `grep -rni parry src/` → single non-test hit: `src/services/automation/handlers/class-fighter-rogue/executeActionManeuvers.js:478` — PLAYER-side Battle Master Parry (damage reduction die+STR/DEX). NOT the monster path; different mechanic (AC vs damage), no reuse.
- `GATED_MONSTER_REACTIONS` (`src/components/encounter/MonsterCardHelpers.js:507-516`) contains ONLY `feather_fall` + `counterspell`. No `parry` entry.
- `getGatedMonsterReaction` (:567) reads `action.automation.effect` → Bandit Captain Parry has no `automation` → returns `null`.
- `MonsterAction.jsx` `GatedReactionSlot` (:135-140) returns `null` without def → no affordance chip ever rendered.
- Disk `public/data/monsters.json` reactions[0] keys: `["name","description"]` — no `trigger`, no `automation`, no `attack_bonus`.

## Live affordance dump (test-campaign, EB join, card open)
- Reactions section DOM: `<div class="mc-action"><strong>Parry.</strong> <span>Trigger: …</span></div>` — `querySelectorAll('button,[role="button"],.mc-dice-link').length === 0`. Nothing clickable on the row.

## Live hit-probe (null-proof)
- ElderPaladin Longsword attack vs Bandit Captain 1: lastAttack `d20:17, bonus:11, total:28, targetAc:15, effectiveAc:15, hit:true, weaponType:"melee", attackName:"Longsword"`.
- No AC bump: effectiveAc stayed 15 (RAW would need 17 to re-evaluate hit).
- No GM "use Parry?" prompt (UI grep zero), no reaction log entry (`log grep parry → []`), no reaction-consumed state on creature (combatSummary Bandit Captain keys contain no reaction/uses fields).
- cs grep: "parry" appears ONLY as static card text echo (`combat-ui-viewingMonster`); `acBonus` matches are unrelated `coverAcBonus:0`.

## Conclusion
Trigger + effect fully advertised in text; no consumer, no affordance, no state, no automation fires when the monster is hit by melee. Parry is purely decorative.

## Cleanup
Admin "Clear Change Data" + "Clear Campaign Log" (native confirms, test-campaign). Verified `change-data → {}`, `log → []`.
