import { buildBaseAttackContext } from './common/damageRoll.js';
import { getCombatContext, getTargetFromAttacker } from '../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../encounters/combatData.js';
import * as mapsService from '../maps/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem, rangeToFeet } from '../rules/combat/rangeValidation.js';
import { isWithinRange } from '../rules/combat/rangeCheck.js';
import { computeCover } from '../rules/combat/coverService.js';
import { loadNPCs } from '../npcs/npcsService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffs/buffService.js';
import { getWolfAdvantageAgainst } from '../combat/auras/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/auras/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/auras/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/auras/coronaAuraUtils.js';
import { hasAuraOfProtection } from '../combat/auras/auraOfProtection.js';
import { isActive as isAvengingAngelActive, isAuraTarget } from '../automation/handlers/class-cleric-paladin/avengingAngelHandler.js';
import { collectWeaponMastery } from '../combat/automation/automationService.js';
import { resolveDiceExpression } from '../combat/automation/automationExpressions.js';

export function buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, _featRangeEffects) {
    const playerName = playerStats.name;

    return buildBaseAttackContext(playerName, campaignName, attack.damageType).then(async ({ target, targetName, resistanceNotice }) => {

        // Hunter's Lore: reveal full IRV info for Hunter's Mark target
        let hunterLoreNotice = null;
        const lorePassives = playerStats.automation?.passives || [];
        const hasHunterLore = lorePassives.some(p => p.type === 'passive_rule' && p.effect === 'hunter_lore');
        if (hasHunterLore && target) {
            const irvParts = [];
            if (target.vulnerabilities?.length > 0) {
                irvParts.push(`Vulnerabilities: ${target.vulnerabilities.join(', ')}`);
            }
            if (target.resistances?.length > 0) {
                irvParts.push(`Resistances: ${target.resistances.join(', ')}`);
            }
            if (target.immunities?.length > 0) {
                irvParts.push(`Immunities: ${target.immunities.join(', ')}`);
            }
            if (irvParts.length > 0) {
                hunterLoreNotice = irvParts.join('\n');
            }
        }

        // Check for Stunning Strike save advantage (consumed on use)
        let hasSaveAdvantage = false;
        if (targetName) {
            const advKey = `_advantageOn_${targetName}`;
            const storedAdvantage = getRuntimeValue(playerName, advKey);
            if (Array.isArray(storedAdvantage)) {
                const idx = storedAdvantage.indexOf(targetName);
                if (idx !== -1) {
                    hasSaveAdvantage = true;
                    storedAdvantage.splice(idx, 1);
                    setRuntimeValue(playerName, advKey, storedAdvantage, campaignName);
                }
            }
        }

        const innateSorceryBonus = getInnateSorceryBonus(playerName, campaignName);

        // Accumulate advantage/disadvantage counts so they cancel per rules
        let adv = 0;
        let dis = 0;

        let forcedMode = conditionAttackMode !== 'normal' ? conditionAttackMode : undefined;
        let sunderingBonus = 0;
        if (forcedMode === undefined) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const goadEffect = storedEffects.find(
                te => te.effect === 'goad' && te.target === playerName
            );
            if (goadEffect) {
                dis++;
            }
        }
        if (forcedMode === undefined) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const sapEffect = storedEffects.find(
                te => te.effect === 'disadvantage_next_attack' && te.target === playerName
            );
            if (sapEffect) {
                dis++;
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const recklessEffect = storedEffects.find(
                te => te.effect === 'reckless_attack' && te.target === targetName
            );
            if (recklessEffect) {
                adv++;
            }
        }
        if (hasSaveAdvantage && forcedMode === undefined) {
            adv++;
        }
        if (innateSorceryBonus.spellAdvantage && forcedMode === undefined) {
            adv++;
        }

        // Add stance damage bonus (e.g. Rage) if an active combat buff provides one
        let stanceDamageBonus = 0;
        const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
        for (const buff of activeBuffs) {
            if (buff.damageBonusExpression) {
                const resolved = buff.damageBonusExpression === 'rage_damage'
                    ? (playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]?.rage_damage ?? 2)
                    : 0;
                stanceDamageBonus += resolved;
            }
        }

        // Frenzy: extra rage_damage_d6 when reckless, raging, strength-based (once per turn)
        let frenzyDamageFormula = null;
        const frenzyActions = (playerStats.automation?.actions || []).filter(x => x.type === 'damage_bonus' && x.trigger === 'reckless_attack_hit_while_raging');
        if (frenzyActions.length > 0) {
            const frenzyOncePerTurn = frenzyActions[0].oncePerTurn;
            let skipFrenzy = false;
            if (frenzyOncePerTurn) {
                const usedRound = getRuntimeValue(playerName, '_frenzyUsedRound', campaignName);
                const currentRound = getCurrentCombatRound();
                if (usedRound === currentRound) {
                    skipFrenzy = true;
                }
            }
            if (!skipFrenzy) {
                const isReckless = activeBuffs.some(b => b.effect === 'advantage_attacks_advantage_against');
                const isRaging = activeBuffs.some(b => b.damageBonusExpression);
                const attackAbilityName = attack?.abilityName;
                const isStr = attackAbilityName ? attackAbilityName.toLowerCase() === 'strength' : null;
                const strMod = playerStats.abilities?.find(a => a.name === 'Strength')?.bonus ?? 0;
                const dexMod = playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus ?? 0;
                const inferredIsStr = strMod >= dexMod;
                const isStrFinal = isStr !== null ? isStr : inferredIsStr;
                if (isReckless && isRaging && isStrFinal) {
                    const frenzyResolved = resolveDiceExpression(frenzyActions[0].damageExpression, playerStats);
                    if (frenzyResolved) {
                        frenzyDamageFormula = frenzyResolved;
                    }
                    if (frenzyOncePerTurn && frenzyDamageFormula) {
                        setRuntimeValue(playerName, '_frenzyUsedRound', getCurrentCombatRound(), campaignName);
                    }
                }
            }
        }

        // Grant attack advantage if Reckless Attack (or similar buff) is active
        let ramActive = false;
        for (const buff of activeBuffs) {
            if (buff.effect === 'advantage_attacks_advantage_against') {
                adv++;
            }
            if (buff.effect === 'advantage_attacks_and_saves') {
                adv++;
            }
            if (buff.optionName === 'Ram') {
                ramActive = true;
            }
        }

        // Target conditions that grant advantage (blinded, charmed, paralyzed, petrified, restrained, stunned, unconscious, dazed, slow)
        if (targetName && forcedMode === undefined) {
            const targetConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            if (Array.isArray(targetConditions)) {
                const condSet = new Set(targetConditions.map(c => String(c).toLowerCase()));
                if (condSet.has('blinded')) {
                    adv++;
                }
                if (condSet.has('charmed')) {
                    adv++;
                }
                if (condSet.has('paralyzed') || condSet.has('petrified') || condSet.has('stunned') || condSet.has('unconscious')) {
                    adv++;
                }
                if (condSet.has('restrained')) {
                    adv++;
                }
                if (condSet.has('dazed') || condSet.has('slow')) {
                    adv++;
                }
            }
        }

        // Dodge: attackers have disadvantage on attacks against the target
        if (targetName && forcedMode === undefined) {
            const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
            if (Array.isArray(targetBuffs) && targetBuffs.some(b => b.effect === 'dodge')) {
                dis++;
            }
        }

        // Resolve accumulated adv/dis to forcedMode (they cancel per rules)
        if (forcedMode === undefined) {
            if (adv > dis) {
                forcedMode = 'advantage';
            } else if (dis > adv) {
                forcedMode = 'disadvantage';
            }
        }

        // Brutal Strike: override to normal when chosen
        const brutalStrikeNoAdvantage = getRuntimeValue(playerStats.name, '_brutalStrikeNoAdvantage', campaignName);
        if (brutalStrikeNoAdvantage) {
            forcedMode = 'normal';
        }

        // Sacred Weapon: Add Charisma modifier to attack rolls (minimum +1) for melee attacks
        let sacredWeaponBonus = 0;
        const sacredWeaponActive = activeBuffs.some(b => b.effect === 'sacred_weapon');
        if (sacredWeaponActive && (attack.weaponType === 'melee' || attack.weaponType === 'unarmed')) {
            const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
            const chaMod = Math.max(1, cha?.bonus || 0);
            sacredWeaponBonus = chaMod;
        }

        // Blessed Warrior: +2 bonus to attack rolls with melee weapons
        let blessedWarriorBonus = 0;
        const hasBlessedWarrior = activeBuffs.some(b => b.effect === 'blessed_warrior');
        if (hasBlessedWarrior && (attack.weaponType === 'melee' || attack.weaponType === 'unarmed')) {
            blessedWarriorBonus = 2;
        }

        // Brutal Strike: add extra damage dice when active
        let brutalStrikeFormulaPart = null;
        let brutalStrikeRider = null;
        const brutalStrikeActive = getRuntimeValue(playerName, '_brutalStrikeActive', campaignName);
        if (brutalStrikeActive) {
            const allAutomation = [...(playerStats.automation?.actions || []), ...(playerStats.automation?.passives || [])];
            const matchingRiders = allAutomation.filter(
                x => x.type === 'attack_rider' && x.damageExpression && x.trigger === 'strength_attack_hit_after_reckless'
            ).sort((a, b) => {
                const exprA = a.damageExpression || '';
                const exprB = b.damageExpression || '';
                const countA = parseInt(exprA.match(/^(\d+)/)?.[1] || '0', 10);
                const countB = parseInt(exprB.match(/^(\d+)/)?.[1] || '0', 10);
                return countB - countA;
            });
            brutalStrikeRider = matchingRiders[0];
            if (brutalStrikeRider) {
                const diceMatch = brutalStrikeRider.damageExpression.match(/^(\d+)d(\d+)/);
                if (diceMatch) {
                    brutalStrikeFormulaPart = `${brutalStrikeRider.damageExpression} [Brutal Strike]`;
                }

                // Read pre-existing next_attack_bonus effects before adding new ones
                const preExistingEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const preExistingBonusKeys = preExistingEffects.filter(
                    te => te.effect === 'next_attack_bonus' && te.target === targetName
                ).map(te => JSON.stringify(te));

                // Apply chosen effects to targetEffects
                const effectChoices = getRuntimeValue(playerName, '_brutalStrikeEffects', campaignName) || [];
                if (effectChoices.length > 0) {
                    let storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    const riderOptions = brutalStrikeRider.options || [];
                    for (const choiceName of effectChoices) {
                        const option = riderOptions.find(o => o.name === choiceName);
                        if (!option) continue;
                        if (option.effect === 'disadvantage_on_next_save' || option.effect === 'next_attack_bonus') {
                            const newEffect = {
                                target: targetName,
                                source: playerName,
                                option: option.name,
                                effect: option.effect,
                                value: option.effect === 'next_attack_bonus' ? (option.value || 5) : (option.value || null),
                                noOpportunityAttacks: option.noOpportunityAttacks || false,
                                duration: 'until_start_of_next_turn',
                            };
                            storedEffects = [...storedEffects, newEffect];
                        }
                    }
                    setRuntimeValue(campaignName, 'targetEffects', storedEffects, campaignName);
                }

                // Consume pre-existing next_attack_bonus effects (Sundering Blow consumed on this attack)
                if (preExistingBonusKeys.length > 0) {
                    const currentEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    const cleanedEffects = currentEffects.filter(
                        te => !(te.effect === 'next_attack_bonus' && te.target === targetName && preExistingBonusKeys.includes(JSON.stringify(te)))
                    );
                    if (cleanedEffects.length !== currentEffects.length) {
                        setRuntimeValue(campaignName, 'targetEffects', cleanedEffects, campaignName);
                    }
                }
                setRuntimeValue(playerName, '_brutalStrikeActive', null, campaignName);
                setRuntimeValue(playerName, '_brutalStrikeEffects', null, campaignName);
            }
        }

        // Vow of Enmity: Advantage on attack rolls against the vowed creature
        if (targetName && forcedMode === undefined) {
            const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
            if (Array.isArray(targetBuffs) && targetBuffs.some(b => b.effect === 'vow_of_enmity')) {
                forcedMode = 'advantage';
            }
        }

        // Clairvoyant Combatant: Advantage on attack rolls against the bonded creature (on failed save)
        const clairvoyantActive = activeBuffs.some(b => b.effect === 'clairvoyant_combatant');
        if (clairvoyantActive && targetName) {
            const clairvoyantTarget = getRuntimeValue(playerName, 'clairvoyantCombatantTarget', campaignName);
            if (clairvoyantTarget && targetName === clairvoyantTarget && forcedMode === undefined) {
                forcedMode = 'advantage';
            }
        }

        // Avenging Angel: Advantage on attack rolls against Frightened creatures in the aura
        const avengingAngelActive = isAvengingAngelActive(playerName, campaignName);
        if (avengingAngelActive && targetName && forcedMode === undefined) {
            if (isAuraTarget(playerName, targetName, campaignName)) {
                forcedMode = 'advantage';
            }
        }

        const autoDamageFormula = [attack.damage, stanceDamageBonus > 0 ? stanceDamageBonus : null, frenzyDamageFormula, brutalStrikeFormulaPart].filter(v => v !== null).join(' plus ');

        const effectiveHitBonus = attack.hitBonus + sacredWeaponBonus + blessedWarriorBonus + sunderingBonus;
        const hitBonusFormulaParts = [attack.hitBonusFormula];
        if (sacredWeaponBonus > 0) hitBonusFormulaParts.push(`Sacred Weapon (${sacredWeaponBonus})`);
        if (blessedWarriorBonus > 0) hitBonusFormulaParts.push(`Blessed Warrior (${blessedWarriorBonus})`);
        if (sunderingBonus > 0) hitBonusFormulaParts.push(`Sundering Blow (+${sunderingBonus})`);
        const hitBonusFormula = hitBonusFormulaParts.join(' + ');

        const isMelee = attack.weaponType === 'melee' || attack.weaponType === 'unarmed';

        // Invoke Duplicity: Distract grants Advantage on attack rolls while the illusion is active
        if (activeBuffs.some(b => b.effect === 'create_illusion')) {
            if (forcedMode === undefined) {
                forcedMode = 'advantage';
            }
        }

        // Precise Hunter (2024 Ranger level 17): Advantage on attack rolls against Hunter's Mark target
        let advantageReason = undefined;
        const hasPreciseHunter = (playerStats.automation?.passives || []).some(
            p => p.type === 'passive_rule' && p.effect === 'precise_hunter'
        );
        if (hasPreciseHunter && targetName && forcedMode === undefined) {
            const combatSummary = await getCombatContext(campaignName);
            const attackerCreature = combatSummary?.creatures?.find(c => c.name === playerName);
            if (attackerCreature?.concentration?.spell === "Hunter's Mark" && attackerCreature?.concentration?.target === targetName) {
                forcedMode = 'advantage';
                advantageReason = 'Precise Hunter (Hunter\'s Mark)';
            }
        }

        // Aura checks when no map is active — all creatures considered in range
        if (forcedMode === undefined) {
            const noMapWolf = getWolfAdvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapWolf.advantage) {
                forcedMode = 'advantage';
            }
        }
        if (forcedMode === undefined) {
            const noMapDuplicity = getDuplicityAdvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapDuplicity.advantage) {
                forcedMode = 'advantage';
            }
        }
        if (forcedMode === undefined) {
            const noMapLion = getLionDisadvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapLion.disadvantage) {
                forcedMode = 'disadvantage';
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const distractingEffect = storedEffects.find(
                te => te.effect === 'distracting_strike_advantage' && te.target === targetName && te.source !== playerName
            );
            if (distractingEffect) {
                forcedMode = 'advantage';
                const cleanedEffects = storedEffects.filter(
                    te => !(te.effect === 'distracting_strike_advantage' && te.target === targetName && te.source !== playerName)
                );
                if (cleanedEffects.length !== storedEffects.length) {
                    setRuntimeValue(campaignName, 'targetEffects', cleanedEffects, campaignName);
                }
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const vexEffect = storedEffects.find(
                te => te.effect === 'next_attack_advantage' && te.target === playerName && te.vexTarget === targetName
            );
            if (vexEffect) {
                forcedMode = 'advantage';
                const cleanedEffects = storedEffects.filter(
                    te => !(te.effect === 'next_attack_advantage' && te.target === playerName && te.vexTarget === targetName)
                );
                if (cleanedEffects.length !== storedEffects.length) {
                    setRuntimeValue(campaignName, 'targetEffects', cleanedEffects, campaignName);
                }
            }
        }
        if (targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const bonusEffects = storedEffects.filter(
                te => te.effect === 'next_attack_bonus' && te.target === targetName
            );
            if (bonusEffects.length > 0) {
                for (const be of bonusEffects) {
                    sunderingBonus += (parseInt(be.value, 10) || 5);
                }
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const protectionEffect = storedEffects.find(
                te => te.effect === 'protection' && te.target === targetName
            );
            if (protectionEffect) {
                forcedMode = 'disadvantage';
            }
        }
        if (forcedMode === undefined && targetName) {
            const noMapCorona = getCoronaSaveDisadvantage({
                targetName,
                campaignName,
                damageType: attack.damageType,
                skipRangeCheck: true,
            });
            if (noMapCorona.disadvantage) {
                forcedMode = 'disadvantage';
            }
        }

        // Compute critical range from passives (e.g., Improved Critical, Superior Critical)
        let criticalRange = '';
        const passives = playerStats.automation?.passives || [];
        for (const passive of passives) {
            if (passive.type === 'passive_rule' && passive.effect === 'critical_range' && passive.criticalRange) {
                criticalRange = passive.criticalRange;
            }
        }

        // Compute Defensive Duelist AC bonus (2024 rules)
        let defensiveDuelistBonus = 0;
        const defensiveDuelistActive = getRuntimeValue(playerName, 'defensiveDuelistActive', campaignName);
        if (defensiveDuelistActive) {
            defensiveDuelistBonus = Number(getRuntimeValue(playerName, 'defensiveDuelistBonus', campaignName) || 0);
        }

        // Compute Bait and Switch AC bonus (2024 rules)
        let baitAndSwitchBonus = 0;
        const baitAndSwitchActive = getRuntimeValue(targetName, 'baitAndSwitchActive', campaignName);
        if (baitAndSwitchActive) {
            baitAndSwitchBonus = Number(getRuntimeValue(targetName, 'baitAndSwitchBonus', campaignName) || 0);
        }

        // Stroke of Luck: check if the player has the passive available
        const hasStrokeOfLuck = (playerStats.automation?.passives || []).some(
            p => p.type === 'stroke_of_luck'
        );
        const strokeOfLuckUsed = hasStrokeOfLuck ? getRuntimeValue(playerName, 'strokeOfLuckUsed', campaignName) : false;
        const strokeOfLuckAvailable = hasStrokeOfLuck && !strokeOfLuckUsed;

        // Boon of Combat Prowess: check if the player has auto_reroll for attacks (stored in actions/reactions, not passives)
        const allAutomation = [
            ...(playerStats.automation?.actions || []),
            ...(playerStats.automation?.reactions || []),
            ...(playerStats.automation?.passives || []),
        ];
        const hasBoonOfCombatProwess = allAutomation.some(
            p => p.type === 'auto_reroll' && (p.effect === 'convert_miss_to_hit' || p.automation?.effect === 'convert_miss_to_hit')
        );
        const boonOfCombatProwessUsed = hasBoonOfCombatProwess ? getRuntimeValue(playerName, 'boonOfCombatProwessUsed', campaignName) : false;
        const boonOfCombatProwessAvailable = hasBoonOfCombatProwess && !boonOfCombatProwessUsed;

        // Graze: check if the player has Graze weapon mastery for this weapon
        let grazeDamage = false;
        let grazeAbilityName = null;
        let grazeAbilityMod = 0;
        const available = collectWeaponMastery(attack.name, playerStats);
        const hasGraze = available.baseMastery === 'Graze' || available.extraMasteries?.includes('Graze');
        if (hasGraze) {
            grazeDamage = true;
            grazeAbilityName = attack.abilityName || 'Strength';
            const grazeAbility = playerStats.abilities?.find(a => a.name === grazeAbilityName);
            grazeAbilityMod = grazeAbility?.bonus || 0;
        }

        // Boon of Fate: check if the player has the passive available
        const hasBoonOfFate = (playerStats.automation?.passives || []).some(
            p => p.type === 'modify_d20_roll'
        );
        const boonOfFateUsed = hasBoonOfFate ? getRuntimeValue(playerName, 'boonOfFateUsed', campaignName) : false;
        const boonOfFateAvailable = hasBoonOfFate && !boonOfFateUsed;

        // Determine sneak attack eligibility
        let sneakAttackDice = 0;
        const isRogue = playerStats.class?.name === 'Rogue';
        if (isRogue) {
            const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
            // 2024 rules: sneak_attack_num_d6 directly on class level
            // 5e rules: class_specific.sneak_attack.dice_count
            const sneakAttackNumD6 = classLevel?.sneak_attack_num_d6 || classLevel?.class_specific?.sneak_attack?.dice_count || 0;
            const hasSneakAttack = sneakAttackNumD6 > 0;
            const weaponProperties = attack.properties || [];
            const hasFinesse = weaponProperties.some(p => p.toLowerCase() === 'finesse');
            const hasRanged = attack.weaponType === 'ranged';
            const isSneakAttackWeapon = hasFinesse || hasRanged;
            const hasDisadvantage = forcedMode === 'disadvantage';
            const hasAdvantage = forcedMode === 'advantage';
            if (hasSneakAttack && isSneakAttackWeapon && !hasDisadvantage) {
                const sneakUsedRound = getRuntimeValue(playerStats.name, '_SneakAttack_usedRound', campaignName);
                if (sneakUsedRound === getCurrentCombatRound(campaignName)) {
                    sneakAttackDice = 0;
                } else if (hasAdvantage) {
                    sneakAttackDice = sneakAttackNumD6;
                } else {
                    const combatSummary = await getCombatContext(campaignName);
                    if (combatSummary) {
                        const targetCreature = combatSummary.creatures?.find(c => c.name === targetName);
                        if (targetCreature) {
                        const hasAllyInRange = await (async () => {
                            for (const c of combatSummary.creatures) {
                                if (c.name === playerName || c.name === targetName) continue;
                                if (c.type === 'player' || (c.type === 'npc' && c.attitude !== 'hostile')) {
                                    const inRange = await isWithinRange(targetName, c.name, 5);
                                    if (inRange) return true;
                                }
                            }
                            return false;
                        })();
                            if (hasAllyInRange) {
                                sneakAttackDice = sneakAttackNumD6;
                            }
                        }
                    }
                }
            }
        }

        return {
            damageType: attack.damageType,
            resistanceNotice,
            hunterLoreNotice,
            targetName,
            saveDc: attack.saveDc + innateSorceryBonus.saveDcBonus,
            saveType: attack.saveType,
            dcSuccess: attack.saveSuccess,
            attackerName: playerName,
            forcedMode,
            advantageReason,
            autoDamageFormula,
            autoDamageName: attack.name,
            ramActive,
            isMelee,
            isWeaponAttack: attack.isWeaponAttack !== false,
            criticalRange,
            hitBonus: effectiveHitBonus,
            hitBonusFormula,
            sacredWeaponBonus,
            defensiveDuelistBonus,
            baitAndSwitchBonus,
            strokeOfLuck: strokeOfLuckAvailable,
            boonOfCombatProwess: boonOfCombatProwessAvailable,
            boonOfFate: boonOfFateAvailable,
            isPsychicBlade: attack.isPsychicBlade === true,
            playerStats,
            grazeDamage,
            grazeAbilityName,
            grazeAbilityMod,
            weaponType: attack.weaponType,
            weaponName: attack.name,
            sneakAttackDice,
        };
    });
}

export function buildAttackContext(attack, playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects) {
    if (!mapName) {
        return buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects);
    }

    const basePromise = buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects);

    return Promise.all([
        basePromise,
        mapsService.loadMapData(campaignName, mapName),
        loadNPCs(campaignName),
    ]).then(([base, mapData, npcs]) => {
        const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
        if (!attackerPlayer) return base;

        let targetPos = null;
        return getCombatContext(campaignName).then(async cs => {
            if (cs) {
                const target = getTargetFromAttacker(cs, playerStats.name);
                if (target) {
                    const targetPlayer = mapData?.players?.find(p => p.name === target.name);
                    const targetNpc = mapData?.placedItems?.length
                        ? getNearestPlacedItem(mapData.placedItems, target.name, { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY })
                        : null;
                    if (targetPlayer) {
                        targetPos = { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
                    } else if (targetNpc) {
                        targetPos = { gridX: targetNpc.gridX, gridY: targetNpc.gridY };
                    }
                }
            }

            if (targetPos && base.forcedMode === undefined) {
                let mapAdv = 0;
                let mapDis = 0;
                const wolfResult = getWolfAdvantageAgainst({
                    targetPos,
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                });
                if (wolfResult.advantage) {
                    mapAdv++;
                }
                const duplicityResult = getDuplicityAdvantageAgainst({
                    targetPos,
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                });
                if (duplicityResult.advantage) {
                    mapAdv++;
                }
                const lionResult = getLionDisadvantageAgainst({
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                });
                if (lionResult.disadvantage) {
                    mapDis++;
                }
                if (base.targetName) {
                    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    const protectionEffect = storedEffects.find(
                        te => te.effect === 'protection' && te.target === base.targetName
                    );
                    if (protectionEffect) {
                        mapDis++;
                    }
                }
                const coronaResult = getCoronaSaveDisadvantage({
                    targetName: base.targetName,
                    campaignName,
                    mapData,
                    damageType: base.damageType,
                });
                if (coronaResult.disadvantage) {
                    mapDis++;
                }
                base._mapAdv = mapAdv;
                base._mapDis = mapDis;
            }

            // When map is active but target has no position, fall back to no-map aura checks
            if (!targetPos && base.forcedMode === undefined) {
                let mapAdv = 0;
                let mapDis = 0;
                const noMapWolf = getWolfAdvantageAgainst({
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                    skipRangeCheck: true,
                });
                if (noMapWolf.advantage) {
                    mapAdv++;
                }
                const noMapDuplicity = getDuplicityAdvantageAgainst({
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                    skipRangeCheck: true,
                });
                if (noMapDuplicity.advantage) {
                    mapAdv++;
                }
                const noMapLion = getLionDisadvantageAgainst({
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                    skipRangeCheck: true,
                });
                if (noMapLion.disadvantage) {
                    mapDis++;
                }
                if (base.targetName) {
                    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    const protectionEffect = storedEffects.find(
                        te => te.effect === 'protection' && te.target === base.targetName
                    );
                    if (protectionEffect) {
                        mapDis++;
                    }
                }
                const noMapCorona = getCoronaSaveDisadvantage({
                    targetName: base.targetName,
                    campaignName,
                    mapData,
                    damageType: base.damageType,
                    skipRangeCheck: true,
                });
                if (noMapCorona.disadvantage) {
                    mapDis++;
                }
                base._mapAdv = mapAdv;
                base._mapDis = mapDis;
            }

            const numericRange = rangeToFeet(attack.range) || 0;
            const isRanged = numericRange > 8;
            const feats = featRangeEffects || { ignoresMeleeDisadvantage: false, ignoresLongRangeDisadvantage: false, rangeMultiplier: 1, spellRangeBonus: 0 };

            // Improved Illusions: only apply range bonus to Illusion spells with range 10+ feet
            const hasImprovedIllusions = playerStats.automation?.passives?.some(p => p.type === 'improved_illusions');
            const isIllusionSpell = attack.school && attack.school.toLowerCase() === 'illusion';
            const effectiveRangeBonus = (hasImprovedIllusions && isIllusionSpell && numericRange >= 10)
                ? (feats.spellRangeBonus || 0) + 60
                : feats.spellRangeBonus || 0;

            if (targetPos) {
                const effectiveRange = isRanged ? numericRange + effectiveRangeBonus : attack.range;
                const distanceFt = getDistanceFeet(
                    { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    targetPos
                );
                const rangeResult = computeRangeEffect(effectiveRange, distanceFt, feats);
                if (rangeResult.mode === 'disadvantage') {
                    base._rangeDis = (base._rangeDis || 0) + 1;
                    base.rangeReason = rangeResult.reason;
                } else if (rangeResult.mode === 'miss') {
                    base.isAutoMiss = true;
                    base.rangeReason = rangeResult.reason;
                }
            }

            if (isRanged && !base.isAutoMiss && targetPos) {
                const walls = mapData?.walls || new Set();
                let coverResult = computeCover(
                    { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    { gridX: targetPos.gridX, gridY: targetPos.gridY },
                    walls,
                    mapData?.placedItems || [],
                );

                // Check ignore_cover_ranged passive (e.g., Sharpshooter feat bypass cover)
                const hasIgnoreCoverRanged = (playerStats.automation?.passives || []).some(
                    p => p.type === 'passive_rule' && p.effect === 'ignore_cover_ranged'
                );
                if (hasIgnoreCoverRanged) {
                    coverResult = { level: 'none', acBonus: 0 };
                }

                // Check Nature's Sanctuary half cover — any creature in the sanctuary list
                const sanctuaryCreatures = getRuntimeValue(playerStats.name, 'naturesSanctuaryCreatures', campaignName);
                if (sanctuaryCreatures?.includes(base.targetName) && coverResult.acBonus < 2) {
                    coverResult = { level: 'half', acBonus: 2 };
                    base.coverReason = 'Nature\'s Sanctuary';
                }

                // Check Bulwark of Force half cover — any PC with the buff can grant cover to the target
                if (coverResult.acBonus < 2 && mapData?.players) {
                    for (const player of mapData.players) {
                        const bulwarkActive = getRuntimeValue(player.name, 'bulwarkOfForceActive');
                        if (bulwarkActive) {
                            const bulwarkTargets = getRuntimeValue(player.name, 'bulwarkOfForceTargets') || [];
                            if (bulwarkTargets.includes(base.targetName)) {
                                coverResult = { level: 'half', acBonus: 2 };
                                base.coverReason = 'Bulwark of Force';
                                break;
                            }
                        }
                    }
                }

                // Check Smite of Protection half cover (allies within Aura of Protection range)
                const smiteCoverActive = getRuntimeValue(playerStats.name, 'smiteOfProtectionActive', campaignName);
                if (smiteCoverActive && coverResult.acBonus < 2) {
                    const auraSource = getAuraSourceForSmiteCover(playerStats, mapData);
                    if (auraSource) {
                        const inAura = await checkInAuraOfProtection(auraSource, base.targetName, playerStats);
                        if (inAura) {
                            coverResult = { level: 'half', acBonus: 2 };
                            base.coverReason = 'Smite of Protection';
                        }
                    }
                }

                // Check Defensive Duelist AC bonus (2024 rules)
                const defensiveDuelistActive = getRuntimeValue(base.targetName, 'defensiveDuelistActive', campaignName);
                if (defensiveDuelistActive) {
                    const defensiveDuelistBonus = Number(getRuntimeValue(base.targetName, 'defensiveDuelistBonus', campaignName) || 0);
                    if (defensiveDuelistBonus > coverResult.acBonus) {
                        coverResult.acBonus = defensiveDuelistBonus;
                    }
                }

                // Check Bait and Switch AC bonus (2024 rules)
                const baitAndSwitchActive = getRuntimeValue(base.targetName, 'baitAndSwitchActive', campaignName);
                if (baitAndSwitchActive) {
                    const baitAndSwitchBonus = Number(getRuntimeValue(base.targetName, 'baitAndSwitchBonus', campaignName) || 0);
                    if (baitAndSwitchBonus > coverResult.acBonus) {
                        coverResult.acBonus = baitAndSwitchBonus;
                    }
                }

                if (coverResult.level === 'full') {
                    base.isAutoMiss = true;
                    base.coverReason = 'Target has full cover';
                } else if (coverResult.acBonus > 0) {
                    base.coverAcBonus = coverResult.acBonus;
                    base.coverLevel = coverResult.level;
                }
            }

            if (isRanged && !base.isAutoMiss) {
                const nearbyThreats = (mapData?.placedItems || [])
                    .filter(i => i.type === 'npc')
                    .map(i => {
                        const npcData = npcs?.find(n => n.name === i.name || n.name === i.name?.replace(/\s+\d+$/, ''));
                        return { ...i, attitude: npcData?.attitude };
                    })
                    .filter(i => isHostileNPC(i))
                    .map(i => ({ gridX: i.gridX, gridY: i.gridY, name: i.name }));

                const meleeResult = computeMeleeProximityEffect(true, attackerPlayer, nearbyThreats, feats);
                if (meleeResult.mode === 'disadvantage') {
                    base._meleeDis = (base._meleeDis || 0) + 1;
                    base.rangeReason = meleeResult.reason;
                }
            }

            // Resolve accumulated map-based adv/dis counts
            if (base.forcedMode === undefined && (base._mapAdv || base._mapDis || base._rangeDis || base._meleeDis)) {
                const totalMapAdv = base._mapAdv || 0;
                const totalMapDis = (base._mapDis || 0) + (base._rangeDis || 0) + (base._meleeDis || 0);
                if (totalMapAdv > totalMapDis) {
                    base.forcedMode = 'advantage';
                } else if (totalMapDis > totalMapAdv) {
                    base.forcedMode = 'disadvantage';
                }
            }

            return base;
        });
    })
        .catch(() => basePromise);
}

function getAuraSourceForSmiteCover(playerStats, mapData) {
    if (!mapData?.players?.length) return null;
    return mapData.players.find(p => hasAuraOfProtection(playerStats) && p.name === playerStats.name) || null;
}

async function checkInAuraOfProtection(auraSource, targetName, playerStats) {
    const auraRange = hasAuraOfProtection(playerStats) ? 30 : 10;
    return await isWithinRange(auraSource.name, targetName, auraRange);
}
