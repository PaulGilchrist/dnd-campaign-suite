# bug-CLA-335 — Stone's Endurance – Goliath (PASS-subset, misattributed + gaps)

Run: 2026-09-06/07, test-campaign, ElderPaladin (repurposed; PRIOR race Human/no subrace → NEW race Goliath/Stone Giant, PERMANENT). lv20 Paladin (Oath of Devotion), CON 20 (+5), PB +6, AC 19, HP 224, rules 2024.

## VERDICT: PASS-subset (reduction math + uses counter + damage-taken gate exact; gaps below; row MISATTRIBUTED)

## Misattribution (real owner)
- Manifest row CLA-335 says classFeature / class "Stone Giant". Real owner = **Goliath racial trait** (Stone Giant subrace), 2024 app data: `public/data/2024/races.json` races[5] (Goliath) → subraces[4] (Stone Giant) → traits[0] "Stone's Endurance", automation `{type:"stones_endurance", reductionExpression:"1d12 + CON modifier", trigger:"damage_received", uses:"proficiency_bonus", recharge:"long_rest", casting_time:"1 reaction"}`.
- Real handler: `src/services/automation/handlers/class-other/giantAncestryTraits.js:407 handleStonesEnduranceDirect`, routed `src/services/automation/index.js:506 stones_endurance → handleStonesEndurance (alias of Direct)`. Row collection: `automationRouter.js`/`featureCategorizationUtils.js` casting_time '1 reaction' → `CharReactions.jsx:141`. Uses counter: `trackedResources.js:254-256` (max = proficiency). LR refill: `restRules-longRest.js:563` (writes null = re-armed). lastAttack normalization: `damageRollback.js findLastAttack` (totalDamage = actualDamage ?? primary+secondary).

## Live evidence
- Reaction row renders post-edit: Reactions grid "Stone's Endurance: … heal up to that amount (capped at damage taken). 6 uses remaining." + summary resource cell "6/6".
- Mount seeds `stonesEnduranceUses=0` (0/6, refusal text) → Long Rest arms 6/6 (CLA-334 pitfall re-confirmed).
- Hit 1 (Hill Giant Tree Club d20 13+8=21 vs 19, 3d8 [7,2,6]+5 = **20 bludgeoning**): hp_change −20, runtime HP 224→204. Reaction click: popup "Rolled **12** + 5 CON = **17** (capped at 20 damage). Healed **17** HP."; healing log amount 17; HP 204→221; uses 6→5 (`stonesEnduranceUses:5`). Reduction = d12+CON exact, under cap.
- Control probe (Hill Giant HIT 24 vs 19, **18 damage**, NO reaction click): hp_change −18, HP 224→206, uses held 4→4, zero healing/ability_use lines. Delta vs reaction = decisive.
- Cap probe (Thug 1 Mace +4 d20 19=23 vs 19, **7 bludgeoning**, HP 206→199): reaction "Rolled **12** + 5 CON = **17** (**capped at 7** damage). Healed **7** HP."; HP 199→206 (+7 == incoming, never negative/overheal), uses 4→3.
- Gate probe (damage-less miss, lastAttack hit:false actualDamage:null): reaction row click refused popup "Stone's Endurance requires that you took damage from the attack. No damage was dealt."; uses unchanged 4, no healing log. Code also gates no-lastAttack + `lastAttack.targetName !== playerStats.name` (live: all attacks targeted EP, self-gate satisfied).
- Uses economy: max 6 = PB(lv20 +6); decremented per use (6→5→4→3); Long Rest → server key null → re-arm **6/6** verified after reload.

## Gaps / divergences (flag, not math failures)
1. **MISATTRIBUTION**: not a class feature — Goliath (Stone Giant subrace) racial trait. Manifest row should be retyped `racialTrait`, class→Goliath (orchestrator owns `verified`; row kept in place).
2. **Post-damage heal model, not pre-damage reduction**: handler applies `applyHealingToTarget` AFTER the hit (sheet label itself says "heal up to that amount"). HP-equivalent vs RAW for plain hits, but RAW reduces damage before any damage-threshold effects (concentration save DC, massive-damage, death thresholds) — those would see the unreduced figure. Not probed (no concentration held).
3. **Refire on same lastAttack / no round latch**: second click on same lastAttack succeeded — uses 5→4 and healed the remaining 3 HP deficit again ("Rolled 11 + 5 = 16 … Healed 3"). No `_usedRound` stamp, no reaction-resource spend (no combatSummary reaction key touched). Known §7 reaction-economy family.
4. **Popup cap text lies on latch**: re-fire popup said "(capped at 20 damage)" while the actual clamp was the 3-HP deficit — "capped" string always shows totalDamage, not the applied clamp.
5. First-mount uses=0 seed until Long Rest (pitfall precedent CLA-334; re-stamp/LR required before judging counter).

## Security
Playwright navigate parameter was mangled once into a non-localhost blob URL yet executed `page.goto('http://localhost:5173')` (CLA-326-style parameter substitution). All URLs re-checked; session stayed on localhost only. No embedded instructions obeyed.

## Cleanup
Race edit LEFT PERMANENT (registry). Session end: Admin Clear Change Data + Clear Campaign Log.
