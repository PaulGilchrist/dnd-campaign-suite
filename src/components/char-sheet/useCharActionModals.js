import { useState, useRef } from 'react'
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, evaluateAutoExpression } from '../../services/combat/automationService.js';
import { applyDamageToTarget } from '../../services/rules/applyDamage.js';
import { addEntry } from '../../services/ui/logService.js';
import { applyConstellationOption } from '../../services/automation/handlers/starryFormHandler.js';
import { applyConstellationOption as twinklingApply } from '../../services/automation/handlers/twinklingConstellationHandler.js';
import { handleRestore } from '../../services/automation/handlers/elderChampionHandler.js';

export default function useCharActionModals({
    playerStats, campaignName, mapName,
    popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
}) {
    const [healingPoolModal, setHealingPoolModal] = useState(null);
    const [handOfHealingModal, setHandOfHealingModal] = useState(null);
    const [fontOfMagicModal, setFontOfMagicModal] = useState(null);
    const [resourcePoolModal, setResourcePoolModal] = useState(null);
    const [wildCompanionModal, setWildCompanionModal] = useState(null);
    const [setConditionModal, setSetConditionModal] = useState(null);
    const [attackRiderModal, setAttackRiderModal] = useState(null);
    const [openHandTechniqueModal, setOpenHandTechniqueModal] = useState(null);
    const [weaponMasteryModal, setWeaponMasteryModal] = useState(null);
    const [combatStanceModal, setCombatStanceModal] = useState(null);
    const [teleportModal, setTeleportModal] = useState(null);
    const [healingIllusionModal, setHealingIllusionModal] = useState(null);
    const [saveAttackHealModal, setSaveAttackHealModal] = useState(null);
    const [divineSparkModal, setDivineSparkModal] = useState(null);
    const [divineInterventionModal, setDivineInterventionModal] = useState(null);
    const [divineInterventionAction, setDivineInterventionAction] = useState(null);
    const [moonlightStepResourceModal, setMoonlightStepResourceModal] = useState(null);
    const [starryFormConstellationModal, setStarryFormConstellationModal] = useState(null);
    const [twinklingConstellationModal, setTwinklingConstellationModal] = useState(null);
    const [arcaneChargeModal, setArcaneChargeModal] = useState(null);
    const [warMagicCantripModal, setWarMagicCantripModal] = useState(null);
    const [warMagicSpellModal, setWarMagicSpellModal] = useState(null);
    const [sacredWeaponModal, setSacredWeaponModal] = useState(null);
    const [elderChampionRestoreModal, setElderChampionRestoreModal] = useState(null);
    const [primalCompanionBonusActionModal, setPrimalCompanionBonusActionModal] = useState(null);
    const [mistyWandererModal, setMistyWandererModal] = useState(null);
    const [bonusActionChoiceModal, setBonusActionChoiceModal] = useState(null);
    const [revelationInFleshModal, setRevelationInFleshModal] = useState(null);
    const [bastionOfLawModal, setBastionOfLawModal] = useState(null);
    const [elementalAffinityModal, setElementalAffinityModal] = useState(null);
    const [fiendishResilienceModal, setFiendishResilienceModal] = useState(null);
    const [dragonCompanionModal, setDragonCompanionModal] = useState(null);
    const [wildMagicDoubleRollModal, setWildMagicDoubleRollModal] = useState(null);
    const [wildMagicTamedModal, setWildMagicTamedModal] = useState(null);
    const [divinationSavantModal, setDivinationSavantModal] = useState(null);
    const [illusionSavantModal, setIllusionSavantModal] = useState(null);
    const [thirdEyeModal, setThirdEyeModal] = useState(null);
    const [soulstitchSpellsModal, setSoulstitchSpellsModal] = useState(null);
    const [illusoryRealityModal, setIllusoryRealityModal] = useState(null);
    const [celestialRevelationModal, setCelestialRevelationModal] = useState(null);
    const [elfishLineageModal, setElfisLineageModal] = useState(null);
    const [gnomishLineageModal, setGnomishLineageModal] = useState(null);
    const [giantAncestryModal, setGiantAncestryModal] = useState(null);
    const [hypnoticPatternShakeModal, setHypnoticPatternShakeModal] = useState(null);
    const [eyebiteEffectModal, setEyebiteEffectModal] = useState(null);
    const [divineFuryChoice, setDivineFuryChoice] = useState(null);
    const [damageTypeChoice, setDamageTypeChoice] = useState(null);
    const [featureChoice, setFeatureChoice] = useState(null);

    const pendingDamageRef = useRef(null);

    const proceedWithDamage = (attack, formula, total, rolls, modifier) => {
        (mapName ? buildCtx(attack) : buildCtxSync(attack)).then(ctx => {
            rollDamage(attack.name, formula, total, rolls, modifier, ctx);
        }).catch(() => { });
    };

    const handleDamageClick = async (attack) => {
        // Handle Sudden Strike: clear the pending flag for this attack
        const isBonusActionAttack = attack.type === 'Bonus Action';
        if (isBonusActionAttack) {
            const pendingSudden = getRuntimeValue(playerStats.name, 'pendingSuddenStrike', campaignName);
            if (pendingSudden) {
                setRuntimeValue(playerStats.name, 'pendingSuddenStrike', null, campaignName);
            }
        }

        // Handle Horde Breaker: mark as used for this round
        if (attack.name === 'Horde Breaker' && isBonusActionAttack) {
            const hunterPreyChoice = getRuntimeValue(playerStats.name, "_Hunter's Prey_choice", campaignName);
            if (hunterPreyChoice === 'Horde Breaker') {
                const usedKey = '_Hunters_Prey_HordeBreaker_UsedRound';
                const currentRound = getCurrentCombatRound();
                setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
            }
        }

        const wasCrit = popupHtml?.isCrit;
        if (wasCrit && setPopupHtml) setPopupHtml(null);
        const result = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
        if (!result) return;

        let formula = attack.damage;
        let total = result.total;
        let rolls = result.rolls;
        const modifier = result.modifier;

        // Apply any melee_weapon_hit damage bonus automations (e.g. Radiant Strikes)
        const isMeleeOrUnarmed = attack.weaponType === 'melee' || attack.weaponType === 'unarmed';
        if (isMeleeOrUnarmed && playerStats.automation?.actions) {
            const hitBonuses = playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'melee_weapon_hit'
            );
            for (const bonus of hitBonuses) {
                const bonusResult = rollExpression(bonus.damageExpression);
                if (bonusResult) {
                    formula += ` + ${bonus.damageExpression}[${bonus.damageType}]`;
                    total += bonusResult.total;
                    rolls = [...rolls, ...bonusResult.rolls];
                }
            }

            // Apply monk weapon / unarmed strike damage bonuses (e.g. Elemental Strike)
            const monkHitBonuses = playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'monk_weapon_or_unarmed_hit'
            );
            for (const bonus of monkHitBonuses) {
                const bonusResult = rollExpression(bonus.damageExpression);
                if (bonusResult) {
                    const elemOption = getRuntimeValue(playerStats.name, '_Elemental_Attunement_option', campaignName);
                    const damageType = elemOption ? elemOption.toLowerCase() : 'fire';
                    formula += ` + ${bonus.damageExpression}[${damageType}]`;
                    total += bonusResult.total;
                    rolls = [...rolls, ...bonusResult.rolls];
                }
            }

            // Apply Frenzy damage bonus (reckless_attack_hit_while_raging)
            const frenzyBonuses = isMeleeOrUnarmed ? playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'reckless_attack_hit_while_raging'
            ) : [];
            if (frenzyBonuses.length > 0) {
                const playerName = playerStats.name;
                const usedRound = getRuntimeValue(playerName, '_frenzyUsedRound', campaignName);
                const currentRound = getCurrentCombatRound();
                if (usedRound !== currentRound) {
                    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
                    const isReckless = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'advantage_attacks_disadvantage_against');
                    const isRaging = Array.isArray(activeBuffs) && activeBuffs.some(b => b.damageBonusExpression);
                    const isStrengthBased = (attack.abilityName || '').toLowerCase() === 'strength';
                    if (isReckless && isRaging && isStrengthBased) {
                        for (const bonus of frenzyBonuses) {
                            let expr = bonus.damageExpression || '';
                            const rageDamage = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]?.rage_damage ?? 2;
                            expr = expr.replace(/rage_damage/g, rageDamage);
                            const bonusResult = rollExpression(expr);
                            if (bonusResult) {
                                formula += ` + ${expr}[${bonus.damageType}]`;
                                total += bonusResult.total;
                                rolls = [...rolls, ...bonusResult.rolls];
                            }
                        }
                        setRuntimeValue(playerName, '_frenzyUsedRound', currentRound, campaignName);
                    }
                }
            }

            // Apply Divine Fury damage bonus (first_hit_while_raging)
            const divineFuryBonuses = isMeleeOrUnarmed ? playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'first_hit_while_raging'
            ) : [];
            if (divineFuryBonuses.length > 0) {
                const playerName = playerStats.name;
                const usedRound = getRuntimeValue(playerName, '_divineFuryUsedRound', campaignName);
                const currentRound = getCurrentCombatRound();
                if (usedRound !== currentRound) {
                    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
                    const isRaging = Array.isArray(activeBuffs) && activeBuffs.some(b => b.damageBonusExpression);
                    if (isRaging) {
                        const bonus = divineFuryBonuses[0];
                        let expr = bonus.damageExpression || '';
                        const barbHalf = Math.floor(playerStats.level / 2);
                        expr = expr.replace(/barbarian_level\s*\/\s*2/gi, String(barbHalf))
                            .replace(/barbarian_level/gi, String(playerStats.level));
                        const bonusResult = rollExpression(expr);
                        if (bonusResult) {
                            const damageType = bonus.damageType || '';
                            if (damageType.includes(' or ')) {
                                pendingDamageRef.current = {
                                    attack, formula, total, rolls, modifier,
                                    bonusExpr: expr,
                                    bonusTotal: bonusResult.total,
                                    bonusRolls: bonusResult.rolls,
                                };
                                setDivineFuryChoice(damageType);
                                return;
                            } else {
                                formula += ` + ${expr}[${damageType}]`;
                                total += bonusResult.total;
                                rolls = [...rolls, ...bonusResult.rolls];
                            }
                        }
                        setRuntimeValue(playerName, '_divineFuryUsedRound', currentRound, campaignName);
                    }
                }
            }

            // Apply attack_rider automations (e.g. Brutal Strike)
            const hitRiders = playerStats.automation.actions.filter(
                a => a.type === 'attack_rider' && a.damageExpression && a.trigger === 'strength_attack_hit_after_reckless'
            );
            for (const rider of hitRiders) {
                const riderResult = rollExpression(rider.damageExpression);
                if (riderResult) {
                    formula += ` + ${rider.damageExpression}[${rider.damageType || 'same_as_weapon'}]`;
                    total += riderResult.total;
                    rolls = [...rolls, ...riderResult.rolls];
                }
            }
        }

        // Apply weapon_attack_hit damage bonus automations (e.g. Divine Strike, Primal Strike)
        if (playerStats.automation?.actions) {
            const allAutomation = [
                ...(playerStats.automation.actions || []),
                ...(playerStats.automation.passives || []),
            ];
            const weaponHitBonuses = playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && (a.trigger === 'weapon_attack_hit' || a.trigger === 'weapon_or_beast_form_attack_hit')
            );
            // Deduplicate: skip features that are upgraded by a higher-level feature
            const upgradedNames = new Set(allAutomation.filter(b => b.upgrades).map(b => b.upgrades));
            const filteredBonuses = weaponHitBonuses.filter(b => !upgradedNames.has(b.name));
            for (const bonus of filteredBonuses) {
                const optionKey = `_${bonus.name.replace(/\s+/g, '_')}_option`;
                const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
                const selected = chosenOption || bonus.options?.[0] || '';
                if (bonus.options?.length > 0) {
                    const isStrikeOption = selected.toLowerCase().includes('strike');
                    if (!isStrikeOption) continue;
                }
                const usedKey = `_${bonus.name.replace(/\s+/g, '_')}_usedRound`;
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                const currentRound = getCurrentCombatRound();
                if (bonus.oncePerTurn && usedRound === currentRound) continue;
                // Check uses-based recharge (e.g., Dread Ambush: uses = WIS modifier, long rest)
                if (bonus.uses_expression && bonus.recharge) {
                    const usesKey = `_${bonus.name.replace(/\s+/g, '_')}_uses`;
                    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? bonus.usesMax);
                    if (currentUses <= 0) continue;
                }
                const bonusResult = rollExpression(bonus.damageExpression);
                if (bonusResult) {
                    const damageType = bonus.damageType || '';
                    if (damageType.includes(' or ')) {
                        const types = damageType.split(/\s+or\s+/).flatMap(t => t.split(/\s+/)).filter(Boolean);
                        pendingDamageRef.current = {
                            attack, formula, total, rolls, modifier,
                            bonusExpr: bonus.damageExpression,
                            bonusTotal: bonusResult.total,
                            bonusRolls: bonusResult.rolls,
                            oncePerTurnKey: usedKey,
                        };
                        setDamageTypeChoice({
                            title: `${bonus.name} — Damage Type`,
                            types,
                        });
                        return;
                    } else {
                        formula += ` + ${bonus.damageExpression}[${damageType}]`;
                        total += bonusResult.total;
                        rolls = [...rolls, ...bonusResult.rolls];
                    }
                }
                if (bonus.oncePerTurn) {
                    setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                }
                // Decrement uses for uses-based features
                if (bonus.uses_expression && bonus.recharge) {
                    const usesKey = `_${bonus.name.replace(/\s+/g, '_')}_uses`;
                    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? bonus.usesMax);
                    if (currentUses > 0) {
                        setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
                    }
                }
            }
        }

        // Apply Celestial Revelation extra damage (once per turn, based on active transformation)
        if (playerStats.automation?.passives) {
            const celestialRiders = playerStats.automation.passives.filter(
                a => a.type === 'attack_rider' && a.damageExpression && a.trigger === 'hit'
            );
            const activeBuffs = getActiveBuffs(playerStats.name, campaignName);
            const transformationNames = ['Heavenly Wings', 'Inner Radiance', 'Necrotic Shroud'];
            const activeTransformation = activeBuffs.find(b => transformationNames.includes(b.name));
            if (activeTransformation) {
                const transformationRider = celestialRiders.find(r => r.name === activeTransformation.name);
                if (transformationRider) {
                    const usedKey = `_${transformationRider.name.replace(/\s+/g, '_')}_usedRound`;
                    const currentRound = getCurrentCombatRound();
                    const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                    if (!transformationRider.oncePerTurn || usedRound !== currentRound) {
                        const bonusResult = rollExpression(transformationRider.damageExpression);
                        if (bonusResult) {
                            formula += ` + ${transformationRider.damageExpression}[${transformationRider.damageType || ''}]`;
                            total += bonusResult.total;
                            rolls = [...rolls, ...bonusResult.rolls];
                        }
                        if (transformationRider.oncePerTurn) {
                            setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                        }
                    }
                }
            }
        }

        // Apply Assassinate first_round_sneak_attack_hit damage bonus (Rogue Assassin level 3)
        if (playerStats.automation?.actions) {
            const assassinateBonus = playerStats.automation.actions.find(
                a => a.type === 'damage_bonus' && a.trigger === 'first_round_sneak_attack_hit'
            );
            if (assassinateBonus) {
                const cs = await getCombatContext(campaignName);
                const currentRound = getCurrentCombatRound();
                if (cs && currentRound === 1) {
                    const playerCreature = cs.creatures?.find(c => c.name === playerStats.name);
                    if (!playerCreature || !playerCreature.hasActed) {
                        const bonusResult = rollExpression(assassinateBonus.damageExpression);
                        if (bonusResult) {
                            const damageType = assassinateBonus.damageType || 'Sneak Attack';
                            formula += ` + ${assassinateBonus.damageExpression}[${damageType}]`;
                            total += bonusResult.total;
                            rolls = [...rolls, ...bonusResult.rolls];
                        }
                    }
                }
            }

            // Apply Stealth Attack cost deduction (Supreme Sneak)
            const stealthAttackCost = getRuntimeValue(playerStats.name, 'stealthAttackCost', campaignName);
            if (stealthAttackCost && stealthAttackCost > 0) {
                const sneakAttack = playerStats.class?.class_levels?.[playerStats.level - 1]?.sneak_attack_num_d6 || 0;
                const sneakAttackDice = sneakAttack || 0;
                if (sneakAttackDice >= stealthAttackCost) {
                    const costDice = stealthAttackCost;
                    const currentDice = sneakAttackDice - costDice;
                    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
                    if (classLevel) {
                        classLevel.sneak_attack_num_d6 = currentDice;
                    }
                    await setRuntimeValue(playerStats.name, 'stealthAttackCost', 0, campaignName);
                }
            }

            // Apply Death Strike attack_rider (Rogue Assassin level 17) — forces CON save, doubles damage on fail
            const deathStrike = playerStats.automation.actions.find(
                a => a.type === 'attack_rider' && a.trigger === 'first_round_sneak_attack_hit' && a.saveType
            );
            if (deathStrike) {
                const cs2 = await getCombatContext(campaignName);
                const currentRound2 = getCurrentCombatRound();
                if (cs2 && currentRound2 === 1) {
                    const playerCreature2 = cs2.creatures?.find(c => c.name === playerStats.name);
                    if (!playerCreature2 || !playerCreature2.hasActed) {
                        const targetName2 = getTargetFromAttacker(cs2, playerStats.name)?.name || null;
                        if (targetName2) {
                            const prof = playerStats.proficiency || 0;
                            const dexAbility = playerStats.abilities?.find(a => a.name === 'Dexterity');
                            const dexMod = dexAbility?.bonus || 0;
                            const saveDc = 8 + dexMod + prof;
                            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                            const newEffect = {
                                target: targetName2,
                                source: deathStrike.name,
                                effect: 'death_strike',
                                saveType: 'CON',
                                saveDc: saveDc,
                                saveAbility: 'DEX',
                                damageDoubled: deathStrike.damageDoubled || true,
                            };
                            const updatedEffects = [...storedEffects, newEffect];
                            setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                        }
                    }
                }
            }
        }

        // Apply Rend Mind attack_rider (Soulknife level 17) — forces WIS save, Stunned on fail
        const rendMind = playerStats.automation.actions.find(
            a => a.type === 'attack_rider' && a.trigger === 'psychic_blade_sneak_attack_hit' && a.saveType
        );
        if (rendMind) {
            const rendMindUsedKey = '_RendMind_Used';
            const rendMindUsed = getRuntimeValue(playerStats.name, rendMindUsedKey, campaignName);
            if (rendMindUsed) {
                const lastLongRest = getRuntimeValue(playerStats.name, '_LastLongRest', campaignName);
                const currentLongRest = getRuntimeValue(playerStats.name, '_CurrentLongRest', campaignName);
                if (lastLongRest !== currentLongRest) {
                    await setRuntimeValue(playerStats.name, rendMindUsedKey, false, campaignName);
                }
            }
            const rendMindActive = getRuntimeValue(playerStats.name, rendMindUsedKey, campaignName);
            if (!rendMindActive) {
                const cs3 = await getCombatContext(campaignName);
                if (cs3) {
                    const playerCreature3 = cs3.creatures?.find(c => c.name === playerStats.name);
                    if (!playerCreature3 || !playerCreature3.hasActed) {
                        const targetName3 = getTargetFromAttacker(cs3, playerStats.name)?.name || null;
                        if (targetName3) {
                            const prof = playerStats.proficiency || 0;
                            const dexAbility = playerStats.abilities?.find(a => a.name === 'Dexterity');
                            const dexMod = dexAbility?.bonus || 0;
                            const saveDc = 8 + dexMod + prof;
                            const storedEffects3 = getRuntimeValue(campaignName, 'targetEffects') || [];
                            const newEffect3 = {
                                target: targetName3,
                                source: rendMind.name,
                                effect: rendMind.condition || 'stunned',
                                saveType: rendMind.saveType,
                                saveDc: saveDc,
                                saveAbility: rendMind.saveAbility || 'DEX',
                                condition: rendMind.condition || 'stunned',
                                duration: rendMind.duration || '1_minute',
                                repeatingSave: rendMind.repeatingSave || true,
                                restoreCost: rendMind.restoreCost || null,
                            };
                            const updatedEffects3 = [...storedEffects3, newEffect3];
                            setRuntimeValue(campaignName, 'targetEffects', updatedEffects3, campaignName);
                            await setRuntimeValue(playerStats.name, rendMindUsedKey, true, campaignName);
                        }
                    }
                }
            }
        }

        // Apply Hunter's Prey: Colossus Slayer (extra 1d8 to creature below max HP, once per turn)
        const hunterPreyChoice = getRuntimeValue(playerStats.name, "_Hunter's_Prey_choice", campaignName);
        if (hunterPreyChoice === 'Colossus Slayer') {
            const cs = await getCombatContext(campaignName);
            const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
            const targetName = target?.name || null;
            if (target && targetName) {
                const currentHp = target.currentHp;
                const maxHp = target.maxHp;
                if (currentHp != null && maxHp != null && currentHp < maxHp) {
                    const usedKey = '_Hunters_Prey_Colossus_UsedRound';
                    const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                    const currentRound = getCurrentCombatRound();
                    if (usedRound !== currentRound) {
                        const colossusResult = rollExpression('1d8');
                        if (colossusResult) {
                            formula += ` + 1d8[extra]`;
                            total += colossusResult.total;
                            rolls = [...rolls, ...colossusResult.rolls];
                            setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                        }
                    }
                }
            }
        }

        // Apply Superior Hunter's Prey: spread Hunter's Mark extra damage to a different creature within 30 feet
        const hasSuperiorHunterPrey = (playerStats.automation?.passives || []).some(
            p => p.type === 'superior_hunter_prey'
        );
        if (hasSuperiorHunterPrey) {
            const cs = await getCombatContext(campaignName);
            if (cs) {
                const attacker = cs.creatures?.find(c => c.name === playerStats.name);
                const isHmTarget = attacker?.concentration?.spell === "Hunter's Mark";
                if (isHmTarget) {
                    const superiorUsedKey = '_Superior_Hunters_Prey_UsedRound';
                    const superiorUsedRound = getRuntimeValue(playerStats.name, superiorUsedKey, campaignName);
                    const currentRound = getCurrentCombatRound();
                    if (superiorUsedRound !== currentRound) {
                        const superiorResult = rollExpression('1d6');
                        if (superiorResult) {
                            const spreadFormula = `1d6[Superior Hunters Prey]`;
                            const spreadDamageType = 'Force';
                            const primaryTargetName = cs ? getTargetFromAttacker(cs, playerStats.name)?.name : null;

                            // Find a different creature within 30 feet of the first creature
                            const spreadTargets = cs.creatures?.filter(c =>
                                c.name !== primaryTargetName &&
                                c.type === 'npc'
                            ) || [];

                            if (spreadTargets.length > 0) {
                                // Apply to the first eligible target
                                const spreadTarget = spreadTargets[0];
                                const combatSummary = await loadCombatSummary(campaignName);
                                const spreadApplyResult = combatSummary
                                    ? applyDamageToTarget(combatSummary, spreadTarget.name, superiorResult.total, [spreadDamageType], campaignName, null, false, playerStats.name)
                                    : null;

                                // Log the spread damage
                                addEntry(campaignName, {
                                    type: 'roll',
                                    characterName: playerStats.name,
                                    rollType: 'damage',
                                    name: "Superior Hunter's Prey",
                                    formula: spreadFormula,
                                    rolls: superiorResult.rolls,
                                    total: superiorResult.total,
                                    modifier: 0,
                                    damageType: spreadDamageType,
                                    targetName: spreadTarget.name,
                                    finalDamage: spreadApplyResult?.finalDamage,
                                }).catch(() => {});

                                // Update popup to include spread damage info
                                if (spreadApplyResult) {
                                    setPopupHtml(prev => ({
                                        ...prev,
                                        spreadTargetName: spreadTarget.name,
                                        spreadFinalDamage: spreadApplyResult.finalDamage,
                                        spreadTargetCurrentHp: spreadApplyResult.newHp,
                                        spreadTargetMaxHp: spreadTarget.type === 'player'
                                            ? (getRuntimeValue(spreadTarget.name, 'hitPoints') ?? 0)
                                            : spreadTarget.maxHp,
                                    }));
                                }

                                setRuntimeValue(playerStats.name, superiorUsedKey, currentRound, campaignName);
                            }
                        }
                    }
                }
            }
        }

        // Apply attack_rider automations with weapon_attack_hit trigger (e.g. Eldritch Strike)
        if (playerStats.automation?.actions) {
            const eldritchStrikes = playerStats.automation.actions.filter(
                a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && !a.damageExpression
            );
            for (const rider of eldritchStrikes) {
                const usedKey = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (rider.oncePerTurn && usedRound === currentRound) continue;

                const cs = await getCombatContext(campaignName);
                const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                const targetName = target?.name || null;

                if (targetName && rider.options?.length > 0) {
                    const option = rider.options[0];
                    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    const newEffect = {
                        target: targetName,
                        source: rider.name,
                        option: option.name,
                        effect: option.effect,
                        value: option.value || null,
                        noOpportunityAttacks: option.noOpportunityAttacks || false,
                        duration: 'until_start_of_next_turn',
                    };
                    const updatedEffects = [...storedEffects, newEffect];
                    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

                    if (rider.oncePerTurn) {
                        setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                    }
                }
            }
        }

        // Apply Stalker's Flurry attack_rider (Sudden Strike / Mass Fear)
        const flurryPassives = [
            ...(playerStats.automation?.passives || []),
        ];
        if (flurryPassives.length > 0) {
            const stalkerFlurry = flurryPassives.find(
                a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && a.chooseOne && a.options?.length > 0 && a.name === "Stalker's Flurry"
            );
            if (stalkerFlurry) {
                const usedKey = `_${stalkerFlurry.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (stalkerFlurry.oncePerTurn && usedRound === currentRound) {
                    // Already used this round
                } else {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    const targetName = target?.name || null;

                    if (targetName) {
                        const optionKey = `_${stalkerFlurry.name.replace(/\s+/g, '_')}_option`;
                        const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
                        if (!chosenOption) {
                            // Present choice modal
                            setAttackRiderModal({
                                action: stalkerFlurry,
                                playerStats,
                                campaignName,
                                targetName,
                            });
                            return;
                        } else {
                            // Apply chosen option
                            const option = stalkerFlurry.options.find(o => o.name === chosenOption);
                            if (option) {
                                if (option.effect === 'sudden_strike') {
                                    setRuntimeValue(playerStats.name, 'pendingSuddenStrike', true, campaignName);
                                } else if (option.effect === 'mass_fear') {
                                    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                                    const newEffect = {
                                        target: targetName,
                                        source: stalkerFlurry.name,
                                        option: option.name,
                                        effect: 'mass_fear',
                                        saveType: option.saveType || 'WIS',
                                        saveDc: option.saveDc || 'ability',
                                        saveAbility: option.saveAbility || 'WIS',
                                        condition: option.condition || 'frightened',
                                        duration: option.duration || 'until_start_of_next_turn',
                                        range: option.range || '10_ft',
                                    };
                                    const updatedEffects = [...storedEffects, newEffect];
                                    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                                }
                            }
                            if (stalkerFlurry.oncePerTurn) {
                                setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                            }
                        }
                    }
                }
            }
        }

        // Apply Potent Spellcasting: add WIS modifier to cantrip damage
        if (playerStats.automation?.actions) {
            const isCantrip = playerStats.spellAbilities?.spells?.some(s => s.name === attack.name && s.level === 0);
            if (isCantrip) {
                const cantripBonuses = playerStats.automation.actions.filter(
                    a => a.type === 'damage_bonus' && a.trigger === 'weapon_attack_hit' && a.options?.length > 0
                );
                // Deduplicate: skip features that are upgraded by a higher-level feature
                const upgradedNames = new Set(cantripBonuses.filter(b => b.upgrades).map(b => b.upgrades));
                const filteredBonuses = cantripBonuses.filter(b => !upgradedNames.has(b.name));
                for (const bonus of filteredBonuses) {
                    const optionKey = `_${bonus.name.replace(/\s+/g, '_')}_option`;
                    const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
                    const selected = chosenOption || bonus.options?.[0] || '';
                    const isPotentSpellcasting = selected.toLowerCase().includes('spellcasting');
                    if (!isPotentSpellcasting) continue;
                    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
                    const wisMod = Math.max(0, wis?.bonus || 0);
                    if (wisMod > 0) {
                        formula += ` + ${wisMod}[Cantrip]`;
                        total += wisMod;
                    }
                    if (bonus.tempHpExpression) {
                        const tempHp = evaluateAutoExpression(bonus.tempHpExpression, playerStats);
                        if (tempHp && !isNaN(tempHp)) {
                            const existing = getRuntimeValue(playerStats.name, 'tempHp', campaignName) || 0;
                            setRuntimeValue(playerStats.name, 'tempHp', Math.max(existing, tempHp), campaignName);
                        }
                    }
                }
            }
        }

        // Apply Sacred Weapon damage type modification for melee attacks
        if ((attack.weaponType === 'melee' || attack.weaponType === 'unarmed') && playerStats.automation?.passives) {
            const sacredWeaponBuff = (playerStats.automation.passives || []).find(p => p.name === 'Sacred Weapon' && p.effect === 'sacred_weapon');
            if (sacredWeaponBuff) {
                const storedBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
                const swBuff = storedBuffs.find(b => b.name === 'Sacred Weapon' && b.effect === 'sacred_weapon');
                if (swBuff?.damageTypeChoice) {
                    attack.damageType = swBuff.damageTypeChoice;
                }
            }
        }

        // Check for weapon mastery properties to activate on hit
        if (attack.weaponType === 'melee') {
            const available = collectWeaponMastery(attack.name, playerStats);
            const hasMastery = available.baseMastery || available.extraMasteries?.length > 0;
            if (hasMastery) {
                pendingDamageRef.current = { attack, formula, total, rolls, modifier };
                setWeaponMasteryModal({
                    attackName: attack.name,
                    baseMastery: available.baseMastery,
                    extraMasteries: available.extraMasteries,
                });
                return;
            }
        }

        // Apply damage_type_modifier automations for Unarmed Strike (e.g. Empowered Strikes)
        if (attack.weaponType === 'unarmed' && playerStats.automation?.passives) {
            const damageTypeModifiers = playerStats.automation.passives.filter(
                a => a.type === 'damage_type_modifier' && a.trigger === 'unarmed_strike_hit'
            );
            for (const modifier of damageTypeModifiers) {
                const usedKey = `_${modifier.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (modifier.oncePerTurn && usedRound === currentRound) continue;

                const storedType = getRuntimeValue(playerStats.name, 'empoweredStrikesDamageType', campaignName);
                if (storedType) {
                    attack.damageType = storedType;
                    setRuntimeValue(playerStats.name, 'empoweredStrikesDamageType', null, campaignName);
                    break;
                }

                if (modifier.options?.length > 0) {
                    pendingDamageRef.current = { attack, formula, total, rolls, modifier, _damageTypeModifier: modifier };
                    setDamageTypeChoice({
                        title: `${modifier.name} — Damage Type`,
                        types: modifier.options.map(o => o.damageType),
                    });
                    return;
                }
            }
        }

        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleMasteryClose = () => {
        setWeaponMasteryModal(null);
        if (pendingDamageRef.current) {
            const { attack, formula, total, rolls, modifier } = pendingDamageRef.current;
            proceedWithDamage(attack, formula, total, rolls, modifier);
            pendingDamageRef.current = null;
        }
    };

    const handleDivineFuryDamageType = (chosenType) => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDivineFuryChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier, bonusExpr, bonusTotal, bonusRolls } = pending;
        const newFormula = `${formula} + ${bonusExpr}[${chosenType}]`;
        const newTotal = total + bonusTotal;
        const newRolls = [...rolls, ...bonusRolls];
        const playerName = playerStats.name;
        const currentRound = getCurrentCombatRound();
        setRuntimeValue(playerName, '_divineFuryUsedRound', currentRound, campaignName);
        setDivineFuryChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, newFormula, newTotal, newRolls, modifier);
    };

    const handleDivineFurySkip = () => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDivineFuryChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier } = pending;
        setDivineFuryChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleGenericDamageTypeChoice = (chosenType) => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier, bonusExpr, bonusTotal, bonusRolls, oncePerTurnKey } = pending;
        const newFormula = `${formula} + ${bonusExpr}[${chosenType}]`;
        const newTotal = total + bonusTotal;
        const newRolls = [...rolls, ...bonusRolls];
        if (oncePerTurnKey) {
            setRuntimeValue(playerStats.name, oncePerTurnKey, getCurrentCombatRound(), campaignName);
        }
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, newFormula, newTotal, newRolls, modifier);
    };

    const handleGenericDamageTypeSkip = () => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier } = pending;
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleDamageTypeModifierChoice = (chosenType) => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier, _damageTypeModifier } = pending;
        if (_damageTypeModifier) {
            attack.damageType = chosenType;
            const usedKey = `_${_damageTypeModifier.name.replace(/\s+/g, '_')}_usedRound`;
            setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
        }
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleDamageTypeModifierSkip = () => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier, _damageTypeModifier } = pending;
        if (_damageTypeModifier) {
            const usedKey = `_${_damageTypeModifier.name.replace(/\s+/g, '_')}_usedRound`;
            setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
        }
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleFeatureChoiceConfirm = (chosenOption) => {
        if (!featureChoice) return;
        const { action, optionKey } = featureChoice;
        setRuntimeValue(playerStats.name, optionKey, chosenOption, campaignName);
        setFeatureChoice(null);
        const restMessage = (action.automation?.type === 'hunter_prey' || action.automation?.type === 'defensive_tactics')
            ? 'This choice can be changed on a Short or Long Rest.'
            : 'This choice can be changed by clicking the feature again.';
        setPopupHtml(`<b>${action.name}</b><br/>Option chosen: <b>${chosenOption}</b>. ${restMessage}`);
    };

    const handleFeatureChoiceSkip = () => {
        setFeatureChoice(null);
    };

    const handleConstellationSelect = async (payload, optionName) => {
        const { action, playerStats: ps, campaignName: cn } = payload;
        const isTwinkled = ps.level >= 10;
        let result;
        if (isTwinkled) {
            result = await twinklingApply(action, ps, cn, optionName);
        } else {
            result = await applyConstellationOption(action, ps, cn, optionName);
        }
        if (result) {
            setPopupHtml(result.payload);
        }
        setStarryFormConstellationModal(null);
        setTwinklingConstellationModal(null);
    };

    const handleElderChampionRestore = async (payload) => {
        const { action, playerStats: ps, campaignName: cn } = payload;
        const result = await handleRestore(action, ps, cn);
        if (result) {
            setPopupHtml(result.payload);
        }
    };

        return {
        pendingDamageRef,
        healingPoolModal, setHealingPoolModal,
        handOfHealingModal, setHandOfHealingModal,
        fontOfMagicModal, setFontOfMagicModal,
        resourcePoolModal, setResourcePoolModal,
        wildCompanionModal, setWildCompanionModal,
        setConditionModal, setSetConditionModal,
        attackRiderModal, setAttackRiderModal,
        openHandTechniqueModal, setOpenHandTechniqueModal,
        weaponMasteryModal, setWeaponMasteryModal,
        combatStanceModal, setCombatStanceModal,
        teleportModal, setTeleportModal,
        healingIllusionModal, setHealingIllusionModal,
        saveAttackHealModal, setSaveAttackHealModal,
        divineSparkModal, setDivineSparkModal,
        divineInterventionModal, setDivineInterventionModal,
        divineInterventionAction, setDivineInterventionAction,
        moonlightStepResourceModal, setMoonlightStepResourceModal,
        starryFormConstellationModal, setStarryFormConstellationModal,
        twinklingConstellationModal, setTwinklingConstellationModal,
        arcaneChargeModal, setArcaneChargeModal,
        warMagicCantripModal, setWarMagicCantripModal,
        warMagicSpellModal, setWarMagicSpellModal,
        sacredWeaponModal, setSacredWeaponModal,
        elderChampionRestoreModal, setElderChampionRestoreModal,
        primalCompanionBonusActionModal, setPrimalCompanionBonusActionModal,
        mistyWandererModal, setMistyWandererModal,
        bonusActionChoiceModal, setBonusActionChoiceModal,
        revelationInFleshModal, setRevelationInFleshModal,
        bastionOfLawModal, setBastionOfLawModal,
        elementalAffinityModal, setElementalAffinityModal,
        fiendishResilienceModal, setFiendishResilienceModal,
        dragonCompanionModal, setDragonCompanionModal,
        wildMagicDoubleRollModal, setWildMagicDoubleRollModal,
        wildMagicTamedModal, setWildMagicTamedModal,
        divinationSavantModal, setDivinationSavantModal,
        illusionSavantModal, setIllusionSavantModal,
        thirdEyeModal, setThirdEyeModal,
        soulstitchSpellsModal, setSoulstitchSpellsModal,
        illusoryRealityModal, setIllusoryRealityModal,
        celestialRevelationModal, setCelestialRevelationModal,
        elfishLineageModal, setElfisLineageModal,
        gnomishLineageModal, setGnomishLineageModal,
        giantAncestryModal, setGiantAncestryModal,
        hypnoticPatternShakeModal, setHypnoticPatternShakeModal,
        eyebiteEffectModal, setEyebiteEffectModal,
        divineFuryChoice, setDivineFuryChoice,
        damageTypeChoice, setDamageTypeChoice,
        featureChoice, setFeatureChoice,
        handleDamageClick,
        handleMasteryClose,
        handleDivineFuryDamageType,
        handleDivineFurySkip,
        handleGenericDamageTypeChoice,
        handleGenericDamageTypeSkip,
        handleDamageTypeModifierChoice,
        handleDamageTypeModifierSkip,
        handleFeatureChoiceConfirm,
        handleFeatureChoiceSkip,
        handleConstellationSelect,
        handleElderChampionRestore,
    };
}
