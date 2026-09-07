# Bug SP-112 — Spiritual Weapon: no summon entity, no later-turn move+attack, spell attack eats Divine Strike radiant

## Overview
Divine_Cleric (Cleric/Life lv17, 2024, WIS 16/+3, PB+6) cast Spiritual Weapon as a Bonus Action. The cast produces an immediate melee spell attack with the correct spell attack bonus (+9) and a correct core force formula (1d8 + 3), but the "floating, spectral force" is never created as an entity, there is no later-turn Bonus Action to move the force 20 ft and repeat the attack, and the spell attack pulls in the weapon-only Divine Strike rider (+1d8 radiant), inflating and mislabeling the damage.

## Expected Behavior (canonical, app-data wording — public/data/2024/spells.json "spiritual-weapon")
"You create a floating, spectral force that resembles a weapon of your choice and lasts for the duration. The force appears within 60 feet in a space of your choice, and you can immediately make one melee spell attack against one creature within 5 feet of the force. On a hit, the target takes Force damage equal to 1d8 plus your spellcasting ability modifier. As a Bonus Action on your later turns, you can move the force up to 20 feet and repeat the attack against a creature within 5 feet of it."
Casting time "Bonus Action", level 2, attack_type melee, damage_type Force, damage_at_slot_level["2"] = "1d8 + 3", concentration: true (2024 data).

## Actual
- No force/summon entity anywhere: combatSummary creatures contain no entry with summonSource/summonedBy; Divine_Cleric change-data has no spiritual/summon/weapon keys; no targetEffects entry. pendingExpirations stays [] — no 1-minute clock; the spell "persists" only as a concentration record {spell:'Spiritual Weapon', dc:17}.
- Immediate attack fires ONLY against the initiative-card target-select armed target (no 60-ft space picker, no 5-ft-from-force check — there is no force position to check).
- On hit, damage popup/log formula: "1d8 + 3 [force] + 1d8 [radiant]" = 13 total to Thug 1 (HP 32→19). Force leg is exact (1d8=4 +3 =7) but an extra 1d8 radiant Divine Strike rider is appended to a SPELL attack and the hp_change breakdown attributes the full 13 as damageType:"Force".
- Later turns: on the caster's round-2 turn (activeCreatureName=Divine_Cleric verified, page reloaded), the Bonus Actions section shows only the static spell-row "Spiritual Weapon 2 60 ft. Utility" (a full re-cast, free via the concentration-recast rule) and Special Actions has zero Spiritual Weapon content — no "move up to 20 feet and repeat the attack" row or producer exists anywhere.
- Slot accounting muddle: the first cast attempt threw `activeConditions must be an array for caster` (FT-087 family, execution/index.js:106) AFTER paying the lv2 slot (3→2) and writing the concentration record, with no attack and no spell log; the successful second cast consumed nothing (free recast because concentration already pointed at Spiritual Weapon — spellPreparationService.js:255).

## Steps to Reproduce
1. test-campaign, Divine_Cleric; add Spiritual Weapon via Edit wizard → Spells tab → tick → Save (persists to disk spells[]).
2. Encounter Builder → tick Thug → Join Encounter. Ensure caster runtime has `activeConditions:[]` (POST full store to /api/campaigns/test-campaign/Divine_Cleric) or the cast throws FT-087 error after burning the slot.
3. Arm Thug 1 via Divine_Cleric initiative-card [data-testid="target-select"].
4. Sheet Bonus Actions → Spiritual Weapon row → Cast Spell → attack popup rolls instantly "d20 11 +9 ✓ HIT (20 vs AC 11)" → Done → damage popup "1d8 + 3 [force] + 1d8 [radiant]: 7, 3 → 13 damage applied to Thug 1 — HP 32 → 19".
5. Walk initiative "Next →" to round 2 Divine_Cleric (verified activeCreatureName), reload sheet: no Spiritual Weapon move/attack row anywhere.

## Evidence
- Log (later cleared): spell entry {spellName:'Spiritual Weapon', spellLevel:2, castingTime:'Bonus Action', damageType:'Force', damageFormula:'1d8 + 3', concentration:true}; roll attack {name:'Spiritual Weapon', rolls:[11,17], mode:'normal', total:11, bonus:9, targetAc:11, effectiveAc:11}; roll damage {formula:'1d8 + 3 [force] + 1d8 [radiant]', rolls:[7,3], total:13, modifier:3, damageType:'Force'}; hp_change {delta:-13, breakdown:[{damageType:'Force', amount:13}]}.
- change-data: lastAttack.primaryDamageType:'Force', damageFormula:'1d8 + 3', actualDamage:13, damageTypes:['Force']; Divine_Cleric._Divine_Strike_usedRound:1; combatSummary concentration {spell:'Spiritual Weapon', dc:17}; no summon entries; pendingExpirations:[].
- Grep: non-test "spiritual" in src appears ONLY in src/services/rules/spells/spellPreparationService.js (:126/:255/:599/:657 — War God's Blessing free-cast + concentration-recast free-cast branches). Zero consumers named spiritual_weapon; targetEffectDefinitions.js has no key; grep "repeat the attack|move.*20 feet" = zero hits; summonedCreatureService writes only for summonSource:'spell' producers (animateDead/summonSpirit/etc.) — Spiritual Weapon has none.
- Manifest paths spellHandler.js/spellRouter.js/spellInfoBuilder.js (src/services/combat/automation/...) are FICTITIOUS — no such files in src/services/combat/automation/handlers|routers|infoBuilders for spells; real path is src/services/rules/spells/spellCastService/execution/ (noSavePath.js generic melee-spell branch).

## Live control probe (clause d dead)
Round 2, caster active, post-reload: enumerated every `b.clickable` label on the Divine_Cleric sheet — ["Divine Intervention:","Divine Spark:","Preserve Life:","Turn Undead:","Opportunity Attack:","Attack (to hit):","Blessed Strikes:","Disciple of Life:","Improved Blessed Strikes:"] plus the static Bonus Actions spell rows. Zero move/repeat affordances. Clicking the "Spiritual Weapon" spell row opens SpellDetailPopup (re-cast popup) — not a move+attack action.

## Likely Location
- src/services/rules/spells/spellCastService/execution/noSavePath.js — generic melee-spell path used; casts a one-off attack vs getTargetInfo(); creates no force entity, persists no position, registers no expiration.
- src/services/rules/spells/spellPreparationService.js:255 — recast-free rule is the ONLY spell-specific logic; concentrates-then-free-recast masks the slot leak from the FT-087-abandoned first cast.
- src/services/combat/steps/attackRollBonuses.js:175-210 — damage_bonus riders with trigger 'weapon_attack_hit' run on this SPELL attack pipeline step with no spell-attack discriminator; stamps _Divine_Strike_usedRound and appends "+1d8 [radiant]".
- Missing entirely: summon creation service call (cf. src/services/combat/summons/summonedCreatureService.js consumers), per-turn bonus-action row producer (cf. naturesSanctuaryHandler "Move" row pattern), 5-ft-from-force range gate.
- Manifest handler/router/infoBuilder paths are stale (no consumers at those paths).

## Notes — clause ledger
- (a) summon/force entity: DEAD (grep zero + live: no cs entry, no change-data key).
- (b) immediate one melee spell attack on cast: LIVE but degenerate — fires instantly vs initiative-card armed target; "within 5 feet of the force" gate inert (no force exists; gridless lenient).
- (c) Force 1d8+WIS on hit: PARTIAL — force leg exact (1d8+3, log damageType 'Force'); total wrong: +1d8 radiant Divine Strike rider on a spell attack, radiant amount mislabeled Force in hp_change breakdown.
- (d) later-turn Bonus Action move 20 ft + repeat attack: DEAD (grep zero producers + live control probe round-2).
- (e) spell attack bonus, not weapon: LIVE exact (+9 = WIS+3 + PB+6; lastAttack bonus:9). Persistence: concentration record only, per app 2024 data concentration:TRUE (data divergence: manifest/5e text non-concentration); no duration expiration registrant (pendingExpirations empty).
- Security note: Playwright tool output carried prompt-injection payloads (bogus signed-OSS URLs injected into params); all executed navigation remained localhost:5173 only; payloads reported, not obeyed.
- Cleanup: change-data {} + log [] verified cleared via Admin. Divine_Cleric keeps Spiritual Weapon PREPARED (disk spells[] 21→22, permanent).
