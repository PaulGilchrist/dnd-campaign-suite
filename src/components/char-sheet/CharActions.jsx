import React, { useState, useEffect, useRef } from 'react'
import { getCategories } from '../../services/character/featureCategories.js'
import { getActionSpellNames } from '../../services/ui/spellSectionUtils.js'
import { formatRange, signFormatter, getAttackSpellLevel } from '../../services/ui/formatUtils.js'
import { resolveSpellDamageAtLevel, isAutoHitSpell } from '../../services/rules/core/spellDamageUtils.js';
import { collectWeaponMastery } from '../../services/combat/automation/automationService.js';
import { applyPostDamageMasteryEffects, applyMasteryEffect } from '../../services/automation/handlers/combat/weaponMasteryHandler.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js'
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js'
import { rollExpression, rollExpressionDoubled, rollExpressionMaximized } from '../../services/dice/diceRoller.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { computeFeatRangeEffects } from '../../services/character/featRangeService.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js'
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { toggleBuff } from '../../services/automation/common/buffToggle.js';
import { postLogEntry } from '../../services/shared/logPoster.js';
import { SHOW_DICE_ROLL_DELAY } from '../../config/ui-config.js';
import CharActionModals from './CharActionModals.jsx'
import CharActionSpellPopups from './CharActionSpellPopups.jsx'
import CharBonusActions from './CharBonusActions.jsx'
import { executeHandler } from '../../services/automation/index.js';
import { onSpellSelected as onDivineInterventionSpellSelected } from '../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js';
import { getClassFeatures } from '../../services/character/classFeatures.js';
import { addEntry } from '../../services/ui/logService.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'
import { getTargetFromAttacker, getCombatContext, getAttackerTargetName } from '../../services/rules/combat/damageUtils.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { executeSweepingAttack, executeBaitAndSwitchChoice, executeCommanderStrikeChoice, executeRallyChoice } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { activateBulwarkOfForce } from '../../services/automation/handlers/class-sorcerer/bulwarkOfForceHandler.js';
import { activateCoronaOfLight } from '../../services/automation/handlers/class-cleric-paladin/coronaOfLightHandler.js';
import { confirmRadianceOfDawn } from '../../services/automation/handlers/class-cleric-paladin/radianceOfDawnHandler.js';
import { applyBardicInspiration } from '../../services/automation/handlers/class-bard/bardicInspirationHandler.js';
import { endFriendsOnHostileAction } from '../../services/rules/features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getDistanceFeet } from '../../services/rules/combat/rangeValidation.js';
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { buildAttackContext, buildAttackContextSync } from '../../services/automation/contextBuilder.js';
import { buildEmpoweredSpellState, getEmpoweredSpellDescription } from '../../services/rules/spells/empoweredSpellService.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { useActionSpellMetamagic } from '../../hooks/combat/useActionSpellMetamagic.js';
import { useSimpleDamageRoll } from '../../hooks/combat/useSimpleDamageRoll.js';
import { useSpellPositionResolver } from '../../hooks/combat/useSpellPositionResolver.js';
import { useSpellCastExecutor } from '../../hooks/combat/useSpellCastExecutor.js';
import { getWeaponMastery } from '../../services/combat/weaponMasteryUtils.js';
import { handleRestoreRage } from '../../services/character/rageUtils.js';
import useCharActionModals from './useCharActionModals.js';
import useInitiativeEffects from './useInitiativeEffects.js';
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx';
import TacticalMasterModal from './modals/TacticalMasterModal.jsx';

import './CharActions.css'
import { isEqual } from 'lodash';

function resolveCreatureHp(creature, playerStatsForHp) {
    if (!creature) return { currentHp: 0, maxHp: 0 };
    if (creature.type === 'player') {
        const currentHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? getRuntimeValue(creature.name, 'hitPoints') ?? 0;
        const maxHp = getRuntimeValue(creature.name, 'hitPoints') ?? playerStatsForHp?.hitPoints ?? 0;
        return { currentHp, maxHp };
    }
    return { currentHp: creature.currentHp ?? creature.maxHp, maxHp: creature.maxHp };
}

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats) && prevProps.conditionAttackMode === nextProps.conditionAttackMode && prevProps.exhaustionPenalty === nextProps.exhaustionPenalty && prevProps.cannotAct === nextProps.cannotAct;

const CharActions = React.memo(function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, onBuffsChange, characters }) {
    const [actions, setActions] = useState([]);
    const [selectedActionSpell, setSelectedActionSpell] = useState(null);
    const [featRangeEffects, setFeatRangeEffects] = useState(null);
    const autoDamageRollContext = useRef(null);
    const { saveDcBonus: displaySaveDcBonus } = getInnateSorceryBonus(playerStats.name, campaignName);
    const { popupHtml, setPopupHtml } = useDiceRollPopup();

    useEffect(() => {
        computeFeatRangeEffects(playerStats.feats, playerStats.rules, playerStats).then(setFeatRangeEffects).catch((e) => { console.error("[CharActions] Error:", e); });
    }, [playerStats.feats, playerStats.rules, playerStats]);

    useEffect(() => {
        fetch('/data/actions.json')
            .then(response => response.json())
            .then(data => setActions(data))
            .catch(error => console.error('Error loading actions:', error));
    }, []);

    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats.name, campaignName, {
        characters,
        autoDamageSource: 'char-actions',
        autoDamageRoll: async (autoDamage, isCrit) => {
            let autoFormula = autoDamage.formula;
            const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(playerStats).length > 0;
            const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(playerStats) : 0;
            const spellSchool = (autoDamage.autoDamageSchool || '').toLowerCase();
            const isEvocation = spellSchool === 'evocation';
            const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && empEvocIntMod > 0;
            if (shouldApplyEmpoweredEvoc) {
                autoFormula = `${autoFormula} + ${empEvocIntMod} [Empowered Evocation]`;
            }

            // Apply weapon_attack_hit damage bonus automations (e.g. Blessed Strikes, Divine Strike, Primal Strike)
            // These are applied as a separate damage roll after the base weapon damage
            const isWeaponAttack = !autoDamage.autoDamageSchool && !autoDamage.overchannelActive;
            let pendingBonusDamage = null;
            if (isWeaponAttack && playerStats.automation?.actions) {
                const allAutomation = [
                    ...(playerStats.automation.actions || []),
                    ...(playerStats.automation.passives || []),
                ];
                const upgradedNames = new Set(allAutomation.filter(b => b.upgrades).map(b => b.upgrades));
                const weaponHitBonuses = playerStats.automation.actions.filter(
                    a => a.type === 'damage_bonus' && (a.trigger === 'weapon_attack_hit' || a.trigger === 'weapon_or_beast_form_attack_hit')
                ).filter(b => !upgradedNames.has(b.name));
                for (const bonus of weaponHitBonuses) {
                    const optionKey = `_${bonus.name.replace(/\s+/g, '_')}_option`;
                    const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
                    const selected = chosenOption || bonus.options?.[0] || '';
                    if (bonus.options?.length > 0) {
                        const isStrikeOption = selected.toLowerCase().includes('strike');
                        if (!isStrikeOption) continue;
                    }
                    const usedKey = `_${bonus.name.replace(/\s+/g, '_')}_usedRound`;
                    const currentRound = getCurrentCombatRound();
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
                            pendingBonusDamage = {
                                bonusName: bonus.name,
                                damageExpression: bonus.damageExpression,
                                rolls: bonusResult.rolls,
                                total: bonusResult.total,
                                damageTypes: types,
                                usedKey,
                                currentRound,
                            };
                        } else {
                            const context = {
                                damageType,
                                targetName: autoDamage.targetName,
                                attackerName: autoDamage.attackerName,
                            };
                            rollDamage(bonus.name, bonus.damageExpression, bonusResult.total, bonusResult.rolls, 0, context);
                            if (bonus.oncePerTurn) {
                                setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                            }
                            if (bonus.uses_expression && bonus.recharge) {
                                const usesKey = `_${bonus.name.replace(/\s+/g, '_')}_uses`;
                                const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? bonus.usesMax);
                                if (currentUses > 0) {
                                    setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
                                }
                            }
                        }
                    }
                }
            }

            const isOverchannel = autoDamage.overchannelActive;
            const overchannelUseCount = autoDamage.overchannelUseCount || 0;
            const overchannelSpellLevel = autoDamage.overchannelSpellLevel || 1;

            let overchannelResult;
            if (isOverchannel) {
                overchannelResult = rollExpressionMaximized(autoFormula);
            } else {
                overchannelResult = isCrit ? rollExpressionDoubled(autoFormula) : rollExpression(autoFormula);
            }

            // Add Sneak Attack damage for Rogue class feature
            const sneakAttackDice = autoDamage.sneakAttackDice || 0;
            if (sneakAttackDice > 0 && overchannelResult) {
                const cunningStrikePassive = (playerStats.automation?.passives || []).find(
                    p => p.name === 'Devious Strikes' && p.type === 'attack_rider'
                ) || (playerStats.automation?.passives || []).find(
                    p => p.name === 'Improved Cunning Strike' && p.type === 'attack_rider'
                ) || (playerStats.automation?.passives || []).find(
                    p => p.name === 'Cunning Strike' && p.type === 'attack_rider'
                );
                const hasCunningStrike = !!cunningStrikePassive;
                if (hasCunningStrike) {
                    const currentRound = getCurrentCombatRound();
                    const oncePerRound = getRuntimeValue(playerStats.name, '_CunningStrike_usedRound', campaignName);
                    const skipRound = getRuntimeValue(playerStats.name, '_cunningStrikeSkippedRound', campaignName);
                    if (oncePerRound !== currentRound && skipRound !== currentRound) {
                        await setRuntimeValue(playerStats.name, '_SneakAttack_usedRound', currentRound, campaignName);
                        const cs = await getCombatContext(campaignName);
                        const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                        autoDamageRollContext.current = {
                            formula: autoFormula,
                            total: overchannelResult.total,
                            rolls: overchannelResult.rolls,
                            modifier: overchannelResult.modifier,
                            context: {
                                damageType: autoDamage.damageType,
                                targetName: autoDamage.targetName,
                                attackerName: autoDamage.attackerName,
                                saveDc: autoDamage.saveDc,
                                saveType: autoDamage.saveType,
                                dcSuccess: autoDamage.dcSuccess,
                                isAutoCrit: isCrit,
                                playerStats,
                                doubledRolls: overchannelResult.doubledRolls,
                            },
                            attackName: autoDamage.name,
                            sneakAttackDice: sneakAttackDice,
                        };
                        setAttackRiderModal({
                            action: cunningStrikePassive,
                            playerStats,
                            campaignName,
                            targetName: target?.name || null,
                        });

                        // Rend Mind (Soulknife level 17) — WIS save or Stunned on Psychic Blade sneak attack hit
                        const attackName = autoDamage.name || '';
                        const isPsychicBlade = attackName.includes('Psychic Blade');
                        if (sneakAttackDice > 0 && isPsychicBlade) {
                            const passives = playerStats.automation?.passives || [];
                            const rendMind = passives.find(
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
                                if (!rendMindActive && target?.name) {
                                    const dexAbility = playerStats.abilities?.find(a => a.name === 'Dexterity');
                                    const dexMod = dexAbility?.bonus || 0;
                                    const prof = playerStats.proficiency || 0;
                                    const saveDc = 8 + dexMod + prof;
                                    const { promise } = createSaveListener(campaignName, {
                                        targetName: target.name,
                                        saveType: 'WIS',
                                        saveDc,
                                    });
                                    await setRuntimeValue(playerStats.name, rendMindUsedKey, true, campaignName);
                                    const saveResult = await promise;
                                    if (!saveResult.success) {
                                        const conditions = getRuntimeValue(target.name, 'activeConditions') || [];
                                        if (!conditions.some(c => String(c).toLowerCase() === 'stunned')) {
                                            await setRuntimeValue(target.name, 'activeConditions', [...conditions, 'stunned'], campaignName);
                                        }
                                    }
                                    addEntry(campaignName, {
                                        type: 'ability_use',
                                        characterName: playerStats.name,
                                        abilityName: 'Rend Mind',
                                        description: `Rend Mind triggered on ${target.name} — ${saveResult?.success ? 'succeeded' : 'failed'} WIS save (DC ${saveDc})${saveResult?.success ? '' : ' — Stunned condition applied'}`,
                                        targetName: target.name,
                                    }).catch(() => {});
                                }
                            }
                        }

                        return;
                    }
                    if (skipRound === currentRound) {
                        setRuntimeValue(playerStats.name, '_cunningStrikeSkippedRound', null, campaignName);
                    }
                }
                const sneakAttackFormula = `${sneakAttackDice}d6`;
                const sneakAttackResult = isCrit ? rollExpressionDoubled(sneakAttackFormula) : rollExpression(sneakAttackFormula);
                if (sneakAttackResult) {
                    autoFormula += ` + ${sneakAttackFormula} [Sneak Attack]`;
                    overchannelResult.total += sneakAttackResult.total;
                    overchannelResult.rolls = [...overchannelResult.rolls, ...sneakAttackResult.rolls];
                    await setRuntimeValue(playerStats.name, '_SneakAttack_usedRound', getCurrentCombatRound(), campaignName);
                }
            }

            // Rend Mind (Soulknife level 17) — WIS save or Stunned on Psychic Blade sneak attack hit
            const attackName = autoDamage.name || '';
            const isPsychicBlade = attackName.includes('Psychic Blade');
            if (sneakAttackDice > 0 && isPsychicBlade) {
                const passives = playerStats.automation?.passives || [];
                const rendMind = passives.find(
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
                    if (!rendMindActive && autoDamage.targetName) {
                        const dexAbility = playerStats.abilities?.find(a => a.name === 'Dexterity');
                        const dexMod = dexAbility?.bonus || 0;
                        const prof = playerStats.proficiency || 0;
                        const saveDc = 8 + dexMod + prof;
                        const { promise } = createSaveListener(campaignName, {
                            targetName: autoDamage.targetName,
                            saveType: 'WIS',
                            saveDc,
                        });
                        await setRuntimeValue(playerStats.name, rendMindUsedKey, true, campaignName);
                        const saveResult = await promise;
                        if (!saveResult.success) {
                            const conditions = getRuntimeValue(autoDamage.targetName, 'activeConditions') || [];
                            if (!conditions.some(c => String(c).toLowerCase() === 'stunned')) {
                                await setRuntimeValue(autoDamage.targetName, 'activeConditions', [...conditions, 'stunned'], campaignName);
                            }
                        }
                        addEntry(campaignName, {
                            type: 'ability_use',
                            characterName: playerStats.name,
                            abilityName: 'Rend Mind',
                            description: `Rend Mind triggered on ${autoDamage.targetName} — ${saveResult?.success ? 'succeeded' : 'failed'} WIS save (DC ${saveDc})${saveResult?.success ? '' : ' — Stunned condition applied'}`,
                            targetName: autoDamage.targetName,
                        }).catch(() => {});
                    }
                }
            }

            if (overchannelResult) {
                const context = {
                    damageType: autoDamage.damageType,
                    targetName: autoDamage.targetName,
                    attackerName: autoDamage.attackerName,
                    saveDc: autoDamage.saveDc,
                    saveType: autoDamage.saveType,
                    dcSuccess: autoDamage.dcSuccess,
                    isAutoCrit: isCrit,
                    playerStats,
                    doubledRolls: overchannelResult.doubledRolls,
                };
                if (autoDamage.metamagicTwinTarget) {
                    context.metamagicTwinTarget = autoDamage.metamagicTwinTarget;
                }
                if (autoDamage.metamagicHeighten) {
                    context.metamagicHeighten = autoDamage.metamagicHeighten;
                }

                // When there's a pending type choice, apply base damage normally then show type choice popup after delay
                if (isWeaponAttack && pendingBonusDamage) {
                    const { bonusName, damageExpression, rolls: bonusRolls, total: bonusTotal, damageTypes, usedKey, currentRound } = pendingBonusDamage;
                    const baseFormula = autoFormula;
                    const baseTotal = overchannelResult.total;
                    const baseRolls = overchannelResult.rolls;
                    rollDamage(autoDamage.name, autoFormula, overchannelResult.total, overchannelResult.rolls, overchannelResult.modifier, context);
                    setTimeout(() => {
                        setPopupHtml({
                            type: 'damage_type_choice',
                            name: `${bonusName} — Damage Type`,
                            types: damageTypes,
                            baseFormula,
                            baseTotal,
                            baseRolls,
                            bonusFormula: damageExpression,
                            bonusRolls,
                            bonusTotal,
                            usedKey,
                            currentRound,
                            targetName: autoDamage.targetName,
                            attackerName: autoDamage.attackerName,
                        });
                    }, SHOW_DICE_ROLL_DELAY);
                } else {
                    rollDamage(autoDamage.name, autoFormula, overchannelResult.total, overchannelResult.rolls, overchannelResult.modifier, context);
                }

                // Post-damage: check for Cleave mastery and show target selection if applicable
                if (autoDamage.targetName) {
                    try {
                        const combatSummary = await loadCombatSummary(campaignName);
                        const lastAttack = combatSummary?.lastAttack;
                        if (lastAttack?.hit) {
                            const available = collectWeaponMastery(lastAttack.attackName, playerStats);
                            const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
                            if (allMasteries.includes('Cleave')) {
                                const firstTarget = combatSummary?.creatures?.find(c => c.name === lastAttack.targetName);

                                // Check if there's an active map with position data
                                const mapName = playerStats?.mapName;
                                const hasMapPositions = mapName && firstTarget?.position;

                                let secondTargets;
                                if (hasMapPositions) {
                                    const attackerPos = combatSummary?.creatures?.find(c => c.name === playerStats.name)?.position;
                                    const reach = 8;
                                    if (attackerPos) {
                                        secondTargets = combatSummary.creatures
                                            .filter(c => c.name !== lastAttack.targetName && c.position)
                                            .map(c => ({
                                                ...c,
                                                ...resolveCreatureHp(c, playerStats),
                                                distanceFromFirst: getDistanceFeet(firstTarget.position, c.position),
                                                distanceFromAttacker: getDistanceFeet(attackerPos, c.position),
                                            }))
                                            .filter(t => t.distanceFromFirst !== null && t.distanceFromFirst <= 5 && t.distanceFromAttacker !== null && t.distanceFromAttacker <= reach);
                                    }
                                }

                                // No map or no attacker position — all creatures in range
                                if (!hasMapPositions || !secondTargets) {
                                    secondTargets = combatSummary.creatures
                                        .filter(c => c.name !== lastAttack.targetName)
                                        .map(c => ({ ...c, ...resolveCreatureHp(c, playerStats) }));
                                }

                                if (secondTargets.length > 0) {
                                    setCleaveSecondTargets(secondTargets);
                                    setShowCleaveTargetSelection(true);
                                }
                            }

                            // Tactical Master: if weapon has a mastery and replaceMasteryOptions exist,
                            // show a modal to choose which mastery to apply instead of auto-applying.
                            if (available.replaceMasteryOptions?.length > 0) {
                                setTacticalMasterModal({
                                    attackName: lastAttack.attackName,
                                    baseMastery: available.baseMastery,
                                    replaceOptions: available.replaceMasteryOptions,
                                    targetName: lastAttack.targetName,
                                });
                            } else {
                                // Apply post-damage mastery effects (Sap, Slow, Vex, Push, Nick)
                                try {
                                    await applyPostDamageMasteryEffects(lastAttack.attackName, playerStats, campaignName, combatSummary);
                                } catch (e) {
                                    console.error('[Mastery] Post-damage mastery error:', e);
                                }
                            }

                            // Topple weapon mastery: standalone flow after attack is fully complete.
                            // Yield to React so the damage popup renders before the save prompt overlays it.
                            await new Promise(r => setTimeout(r, SHOW_DICE_ROLL_DELAY));
                            if (allMasteries.includes('Topple')) {
                                try {
                                    const toppleTargetName = combatSummary.lastAttack.targetName;

                                    const weaponAttack = playerStats.attacks?.find(a => a.name === lastAttack.attackName);
                                    const abilityName = weaponAttack?.abilityName || 'Strength';
                                    const ability = playerStats.abilities?.find(a => a.name === abilityName);
                                    const abilityMod = ability?.bonus || 0;
                                    const prof = playerStats.proficiency || 0;
                                    const saveDc = 8 + abilityMod + prof;

                                    const { promptId, promise } = createSaveListener(campaignName, {
                                        targetName: toppleTargetName,
                                        saveType: 'CON',
                                        saveDc,
                                    });

                                    addEntry(campaignName, {
                                        type: 'save_triggered',
                                        characterName: playerStats.name,
                                        targetName: toppleTargetName,
                                        saveType: 'CON',
                                        saveDc,
                                        description: `Topple: ${toppleTargetName} must make a DC ${saveDc} CON save (weapon ${abilityName}) or fall Prone.`,
                                        promptId,
                                    });

                                    const result = await promise;

                                    if (result && !result.success) {
                                        const storedConditions = getRuntimeValue(toppleTargetName, 'activeConditions') || [];
                                        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
                                        if (!conditions.includes('prone')) {
                                            await setRuntimeValue(toppleTargetName, 'activeConditions', [...conditions, 'prone'], campaignName);
                                        }

                                        addEntry(campaignName, {
                                            type: 'save_result',
                                            characterName: playerStats.name,
                                            rollType: 'save-topple',
                                            targetName: toppleTargetName,
                                            saveDc,
                                            saveType: 'CON',
                                            success: false,
                                            description: `${toppleTargetName} failed CON save vs Topple. Gains Prone condition.`,
                                        }).catch((e) => { console.error("[Topple] Error:", e); });

                                        addEntry(campaignName, {
                                            type: 'ability_use',
                                            characterName: playerStats.name,
                                            abilityName: 'Topple',
                                            description: `${playerStats.name} used Topple on ${toppleTargetName} — target failed CON save (DC ${saveDc}, weapon ${abilityName}), fell Prone.`,
                                            targetName: toppleTargetName,
                                        }).catch((e) => { console.error("[Topple] Error:", e); });
                                    }
                                } catch (e) {
                                    console.error('[Topple] Error in Topple mastery flow:', e);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[Cleave] Post-damage mastery error:', e);
                    }
                }

                // Clear Lunging Attack and Commander's Strike bonuses after auto-damage is rolled
                const lungingDie = getRuntimeValue(playerStats.name, 'lungingAttackDieValue', campaignName);
                if (lungingDie && Number(lungingDie) > 0) {
                    await setRuntimeValue(playerStats.name, 'lungingAttackDieValue', null, campaignName);
                }
                const csBonus = getRuntimeValue(playerStats.name, 'commanderStrikeBonus', campaignName);
                if (csBonus && Number(csBonus) > 0) {
                    await setRuntimeValue(playerStats.name, 'commanderStrikeBonus', null, campaignName);
                    await setRuntimeValue(playerStats.name, 'commanderStrikeActive', null, campaignName);
                    await setRuntimeValue(playerStats.name, 'commanderStrikeSource', null, campaignName);
                }

                if (isOverchannel && overchannelUseCount > 1) {
                    const dicePerLevel = 2 + (overchannelUseCount - 1);
                    const totalDice = dicePerLevel * overchannelSpellLevel;
                    const necroticFormula = `${totalDice}d12`;
                    const necroticResult = rollExpression(necroticFormula);
                    if (necroticResult) {
                        const combatSummary = await loadCombatSummary(campaignName);
                        const applyResult = applyDamageToTarget(combatSummary, playerStats.name, necroticResult.total, ['Necrotic'], campaignName, null, true, playerStats.name);
                        addEntry(campaignName, {
                            type: 'roll',
                            characterName: playerStats.name,
                            rollType: 'overchannel-damage',
                            name: 'Overchannel',
                            formula: necroticFormula,
                            rolls: necroticResult.rolls,
                            total: necroticResult.total,
                            modifier: necroticResult.modifier,
                            damageType: 'Necrotic',
                            targetName: playerStats.name,
                            finalDamage: applyResult?.finalDamage,
                            note: 'Overchannel self-damage (ignores resistance/immunity)',
                        }).catch((e) => { console.error("[CharActions] Error:", e); });
                    }
                }
            }
            // Remarkable Athlete: after critical hit, enable movement without opportunity attacks
            if (isCrit) {
                const hasRemarkableAthlete = (playerStats.automation?.passives || []).some(
                    p => p.type === 'auto_effect' && p.effect === 'remarkable_athlete_movement'
                );
                if (hasRemarkableAthlete) {
                    setRuntimeValue(playerStats.name, 'remarkableAthleteNoOA', true, campaignName);
                }
            }

            // Apply attack_rider automations with weapon_attack_hit trigger (e.g. Eldritch Strike)
            const combatSummary = await loadCombatSummary(campaignName);
            const currentRound = combatSummary?.round ?? null;
            const eldritchStrikes = [
                ...(playerStats.automation?.actions || []),
                ...(playerStats.automation?.passives || []),
            ].filter(
                a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && !a.damageExpression && a.name !== "Stalker's Flurry"
            );
            for (const rider of eldritchStrikes) {
                const usedKey = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                const isOncePerTurn = rider.oncePerTurn;
                if (isOncePerTurn && usedRound === currentRound) continue;

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

                    if (isOncePerTurn) {
                        setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                    }

                    await addEntry(campaignName, {
                        type: 'ability_use',
                        characterName: playerStats.name,
                        abilityName: rider.name,
                        description: `${playerStats.name} used ${rider.name} on ${targetName}, imposing Disadvantage on the target's next saving throw.`,
                        targetName: targetName,
                    }).catch((e) => { console.error("[CharActions] Eldritch Strike error:", e); });
                }
            }
        },
    });

    // Handle damage type choice popup (e.g. Blessed Strikes: Necrotic or Radiant)
    useEffect(() => {
        if (popupHtml?.type === 'damage_type_choice') {
            const handleChoice = (chosenType) => {
                const { bonusFormula, bonusRolls, bonusTotal, usedKey, currentRound, targetName, attackerName, name } = popupHtml;
                const context = {
                    damageType: chosenType,
                    targetName,
                    attackerName,
                };
                rollDamage(name, bonusFormula, bonusTotal, bonusRolls, 0, context);
                if (usedKey) {
                    setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                }
                setPopupHtml(null);
            };
            const handleSkip = () => {
                setPopupHtml(null);
            };
            window.addEventListener('damage-type-choice', (e) => {
                handleChoice(e.detail.chosenType);
            });
            window.addEventListener('damage-type-skip', handleSkip);
            return () => {
                window.removeEventListener('damage-type-choice', handleChoice);
                window.removeEventListener('damage-type-skip', handleSkip);
            };
        }
    }, [popupHtml, playerStats.name, campaignName, rollDamage, setPopupHtml]);

    useInitiativeEffects(playerStats, campaignName, rollDamage);

    const getTargetInfo = React.useCallback(async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, playerStats.name);
        if (target) return target;
        const overlayTargetName = getAttackerTargetName(cs, playerStats.name);
        if (overlayTargetName) return { name: overlayTargetName };
        return null;
    }, [playerStats.name, campaignName]);

    const buildCtxSync = React.useCallback(async (attack) => {
        return await buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects || null);
    }, [playerStats, campaignName, conditionAttackMode, featRangeEffects]);

    const buildCtx = React.useCallback(async (attack) => {
        return await buildAttackContext(attack, playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects || null);
    }, [playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects]);

    const {
        pendingDamageRef,
        healingPoolModal, setHealingPoolModal,
        handOfHealingModal, setHandOfHealingModal,
        fontOfMagicModal, setFontOfMagicModal,
        resourcePoolModal, setResourcePoolModal,
        wildCompanionModal, setWildCompanionModal,
        setConditionModal, setSetConditionModal,
        attackRiderModal, setAttackRiderModal,
        openHandTechniqueModal, setOpenHandTechniqueModal,
        weaponMasteryModal,
        weaponMasteryChoiceModal, setWeaponMasteryChoiceModal,
        weaponKindMasteryModal, setWeaponKindMasteryModal,
        combatStanceModal, setCombatStanceModal,
        teleportModal, setTeleportModal,
        healingIllusionModal, setHealingIllusionModal,
        invokeDuplicityModal, setInvokeDuplicityModal,
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
        stealthAttackModal, setStealthAttackModal,
        revelationInFleshModal, setRevelationInFleshModal,
        bastionOfLawModal, setBastionOfLawModal,
        elementalAffinityModal, setElementalAffinityModal,
        fiendishResilienceModal, setFiendishResilienceModal,
        boonOfEnergyResistanceModal, setBoonOfEnergyResistanceModal,
        dragonCompanionModal, setDragonCompanionModal,
        wildMagicDoubleRollModal, setWildMagicDoubleRollModal,
        wildMagicTamedModal, setWildMagicTamedModal,
        thirdEyeModal, setThirdEyeModal,
        soulstitchSpellsModal, setSoulstitchSpellsModal,
        illusoryRealityModal, setIllusoryRealityModal,
        celestialRevelationModal, setCelestialRevelationModal,
        elfishLineageModal, setElfisLineageModal,
        gnomishLineageModal, setGnomishLineageModal,
        fiendishLegacyModal, setFiendishLegacyModal,
        giantAncestryModal, setGiantAncestryModal,
        eyebiteEffectModal, setEyebiteEffectModal,
        breathWeaponShapeModal, setBreathWeaponShapeModal,
        divineFuryChoice,
        damageTypeChoice,
        featureChoice, setFeatureChoice,
        resolveAttackDamage,
        handleMasteryClose,
        handleWeaponMasteryChoice,
        handleWeaponKindMasteryClose,
        handleDivineFuryDamageType,
        handleDivineFurySkip,
        handleGenericDamageTypeChoice,
        handleGenericDamageTypeSkip,
        handleDamageTypeModifierChoice,
        handleDamageTypeModifierSkip,
        handleEnhancedUnarmedChoice,
        handleEnhancedUnarmedSkip,
        handleFeatureChoiceConfirm,
        handleFeatureChoiceSkip,
        handleConstellationSelect,
        handleElderChampionRestore,
        hypnoticPatternShakeModal, setHypnoticPatternShakeModal,
        arcaneWardRestoreModal, setArcaneWardRestoreModal,
        combatSuperiorityModal, setCombatSuperiorityModal,
        attackRiderManeuverPrompt, setAttackRiderManeuverPrompt,
        sweepingAttackTargetModal, setSweepingAttackTargetModal,
        baitAndSwitchChoiceModal, setBaitAndSwitchChoiceModal,
        commanderStrikeChoiceModal, setCommanderStrikeChoiceModal,
        rallyChoiceModal, setRallyChoiceModal,
        bulwarkOfForceModal, setBulwarkOfForceModal,
        coronaEnemySelectionModal, setCoronaEnemySelectionModal,
        radianceOfDawnModal, setRadianceOfDawnModal,
        tricksterBlessingModal, setTricksterBlessingModal,
        bardicInspirationTargetModal, setBardicInspirationTargetModal,
        secondaryTargetModal, setSecondaryTargetModal,
        handleAttackRiderManeuverUse,
        handleAttackRiderManeuverSkip,
        handleCombatSuperiorityConfirm,
    } = useCharActionModals({
        playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects,
        popupHtml, setPopupHtml, rollDamage, rollAttack, buildCtx, buildCtxSync,
    });

    const [showCleaveTargetSelection, setShowCleaveTargetSelection] = useState(false);
    const [cleaveSecondTargets, setCleaveSecondTargets] = useState([]);
    const [tacticalMasterModal, setTacticalMasterModal] = useState(null);

    const handleCleaveAttack = React.useCallback(async (cleaveTargetName) => {
        if (!cleaveTargetName) {
            setShowCleaveTargetSelection(false);
            return;
        }
        setShowCleaveTargetSelection(false);

        const combatSummary = await getCombatContext(campaignName);
        const lastAttack = combatSummary?.lastAttack;
        if (!lastAttack) return;

        const abilityName = playerStats?.abilities?.[0]?.name || 'STR';
        const ability = playerStats?.abilities?.find(a => a.name === abilityName);
        const abilityMod = ability?.bonus || 0;
        const attackBonus = abilityMod + (playerStats.proficiency || 0);

        const target = combatSummary?.creatures?.find(c => c.name === cleaveTargetName);
        const targetAc = target?.ac || 0;

        const d20Roll = Math.floor(Math.random() * 20) + 1;
        const totalRoll = d20Roll + attackBonus;
        const hit = totalRoll >= targetAc;

        // Cleave deals weapon damage without ability modifier to damage
        let cleaveDamageFormula = lastAttack.damageFormula
            .replace(/\+\s*\d+/g, '')
            .trim();
        if (!cleaveDamageFormula || !/d\d/.test(cleaveDamageFormula)) {
            cleaveDamageFormula = lastAttack.damageFormula;
        }

        let damageResult = null;
        if (hit) {
            damageResult = rollExpression(cleaveDamageFormula);
        }

        if (hit && damageResult) {
            const context = {
                targetName: cleaveTargetName,
                damageType: lastAttack.damageType || 'same_as_weapon',
                attackerName: playerStats.name,
            };
            rollDamage(`${lastAttack.attackName} (Cleave)`, cleaveDamageFormula, damageResult.total, damageResult.rolls, 0, context);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Cleave',
                description: `${playerStats.name} used Cleave on ${lastAttack.attackName} against ${cleaveTargetName}`,
                targetName: cleaveTargetName,
            }).catch(() => { });
        } else {
            const context = {
                targetName: cleaveTargetName,
                damageType: lastAttack.damageType || 'same_as_weapon',
                attackerName: playerStats.name,
                isAutoMiss: true,
            };
            rollDamage(`${lastAttack.attackName} (Cleave)`, cleaveDamageFormula || '0', 0, [], 0, context);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Cleave',
                description: `${playerStats.name} used Cleave on ${lastAttack.attackName} against ${cleaveTargetName} — Miss`,
                targetName: cleaveTargetName,
            }).catch(() => { });
        }
    }, [campaignName, playerStats, rollDamage]);

    const handleTacticalMasterConfirm = React.useCallback(async (chosenMastery) => {
        const oldMastery = tacticalMasterModal?.baseMastery;
        const attackName = tacticalMasterModal?.attackName;
        const targetName = tacticalMasterModal?.targetName;
        setTacticalMasterModal(null);
        if (!chosenMastery) return;
        if (targetName) {
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Tactical Master',
                description: `${playerStats.name} used Tactical Master on ${attackName} against ${targetName} — changed mastery from ${oldMastery} to ${chosenMastery}`,
                targetName: targetName,
            }).catch(() => { });
        }
        const combatSummary = await getCombatContext(campaignName);
        const actualTargetName = combatSummary?.lastAttack?.targetName;
        if (!actualTargetName) return;
        await applyMasteryEffect(chosenMastery, playerStats, campaignName, actualTargetName);
    }, [campaignName, playerStats, tacticalMasterModal]);

    const handleTacticalMasterDismiss = () => {
        setTacticalMasterModal(null);
    };

    useEffect(() => {
        const handler = (event) => {
            setSoulstitchSpellsModal(event.detail);
        };
        window.addEventListener('soulstitch-modal-show', handler);
        return () => window.removeEventListener('soulstitch-modal-show', handler);
    }, [setSoulstitchSpellsModal]);

    useEffect(() => {
        const handler = async (event) => {
            const { title, tempHp, campaignName: evtCampaignName, attackerName, confirmLabel: evtConfirmLabel } = event.detail;
            const cs = await getCombatContext(evtCampaignName);
            const allAllies = cs?.creatures?.filter(c =>
                c.type === 'player' || c.type === 'npc' || c.type === 'monster'
            ) || [];
            const allyTargets = allAllies.map(c => ({
                name: c.name,
                currentHp: c.currentHp,
                maxHp: c.maxHp,
                size: c.size,
                type: c.type,
            }));
            setSecondaryTargetModal({
                title,
                targets: allyTargets,
                confirmLabel: evtConfirmLabel || 'Grant Temp HP',
                onTargetSelected: async (targetName) => {
                    const existing = getRuntimeValue(targetName, 'tempHp', evtCampaignName) || 0;
                    setRuntimeValue(targetName, 'tempHp', Math.max(existing, tempHp), evtCampaignName);
                    postLogEntry(evtCampaignName, {
                        type: 'roll',
                        characterName: attackerName,
                        rollType: 'temp-hp',
                        name: 'Potent Spellcasting',
                        targetName,
                        note: `Gained ${tempHp} temporary hit points from Potent Spellcasting`,
                        total: tempHp,
                    });
                    setSecondaryTargetModal(null);
                },
                onSkip: () => {
                    const existing = getRuntimeValue(attackerName, 'tempHp', evtCampaignName) || 0;
                    setRuntimeValue(attackerName, 'tempHp', Math.max(existing, tempHp), evtCampaignName);
                    postLogEntry(evtCampaignName, {
                        type: 'roll',
                        characterName: attackerName,
                        rollType: 'temp-hp',
                        name: 'Potent Spellcasting',
                        targetName: attackerName,
                        note: `Gained ${tempHp} temporary hit points from Potent Spellcasting`,
                        total: tempHp,
                    });
                    setSecondaryTargetModal(null);
                },
                featureDescription: `Grant ${tempHp} temporary hit points to a creature within 60 feet.`,
                description: 'Choose a creature to grant temporary hit points from Potent Spellcasting.',
            });
        };
        window.addEventListener('potent-spellcasting-temp-hp', handler);
        return () => window.removeEventListener('potent-spellcasting-temp-hp', handler);
    }, [setSecondaryTargetModal]);

    useEffect(() => {
        const handler = (event) => {
            setSweepingAttackTargetModal(event.detail);
        };
        window.addEventListener('sweeping-attack-modal-show', handler);
        return () => window.removeEventListener('sweeping-attack-modal-show', handler);
    }, [setSweepingAttackTargetModal]);

    useEffect(() => {
        const handler = (event) => {
            setBaitAndSwitchChoiceModal(event.detail);
        };
        window.addEventListener('bait-and-switch-modal-show', handler);
        return () => window.removeEventListener('bait-and-switch-modal-show', handler);
    }, [setBaitAndSwitchChoiceModal]);

    useEffect(() => {
        const handler = (event) => {
            setCommanderStrikeChoiceModal(event.detail);
        };
        window.addEventListener('commander-strike-modal-show', handler);
        return () => window.removeEventListener('commander-strike-modal-show', handler);
    }, [setCommanderStrikeChoiceModal]);

    useEffect(() => {
        const handler = (event) => {
            setRallyChoiceModal(event.detail);
        };
        window.addEventListener('rally-choice-modal-show', handler);
        return () => window.removeEventListener('rally-choice-modal-show', handler);
    }, [setRallyChoiceModal]);

    const handleAttackClick = React.useCallback((attack) => {
        if (cannotAct) return;
        // Making an attack roll ends any active Friends spell early
        endFriendsOnHostileAction(playerStats.name, campaignName);
        endInvisibilityOnHostileAction(playerStats.name, campaignName);
        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch((e) => { console.error("[CharActions] Error:", e); });
    }, [cannotAct, buildCtx, rollAttack, exhaustionPenalty, playerStats.name, campaignName]);

    const handleSimpleDamageRoll = useSimpleDamageRoll(playerStats.name, campaignName, popupHtml, setPopupHtml);

    const {
        pendingActionMetamagic,
        handleActionMetamagicConfirm,
        handleActionMetamagicSkip,
        handleActionSpellDamageClick: resolveSpellDamage,
        handleSpellAttackClick,
    } = useActionSpellMetamagic({
        playerStats,
        campaignName,
        mapName,
        exhaustionPenalty,
        cannotAct,
        popupHtml,
        setPopupHtml,
        rollAttack,
        rollDamage,
        buildCtx,
        buildCtxSync,
        handleAttackClick,
        handleDamageClick: resolveAttackDamage,
    });

    const MONK_KI_FEATURES = ['Flurry of Blows', 'Patient Defense', 'Step of the Wind', 'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind', 'Hand of Healing', 'Stunning Strike'];

    const HAS_FLURRY_HEALING_HARM = playerStats.characterAdvancement?.some(f => f.name === "Flurry of Healing and Harm");

    async function handleHasteAttack(actionName, actionCampaignName) {
        if (cannotAct) return;
        const hasteUsedThisTurn = getRuntimeValue(playerStats.name, 'hasteExtraActionUsed', actionCampaignName);
        if (hasteUsedThisTurn) {
            setPopupHtml({ type: 'automation_info', name: 'Haste', description: 'Haste extra action already used this turn.' });
            return;
        }
        await setRuntimeValue(playerStats.name, 'hasteExtraActionUsed', true, actionCampaignName);
        setPopupHtml({ type: 'automation_info', name: 'Haste', description: 'Haste extra action: Attack (one weapon attack only).' });
    }

    async function handleHasteAction(actionName, actionCampaignName) {
        if (cannotAct) return;
        const hasteUsedThisTurn = getRuntimeValue(playerStats.name, 'hasteExtraActionUsed', actionCampaignName);
        if (hasteUsedThisTurn) {
            setPopupHtml({ type: 'automation_info', name: 'Haste', description: 'Haste extra action already used this turn.' });
            return;
        }
        await setRuntimeValue(playerStats.name, 'hasteExtraActionUsed', true, actionCampaignName);
        const descriptions = {
            'Dash': 'Haste extra action: Dash.',
            'Disengage': 'Haste extra action: Disengage.',
            'Hide': 'Haste extra action: Hide.',
            'Use an Object': 'Haste extra action: Use an Object.',
        };
        setPopupHtml({ type: 'automation_info', name: 'Haste', description: descriptions[actionName] || `Haste extra action: ${actionName}.` });
    }

    const handleSweepingAttackConfirm = React.useCallback(async (targetName, modalData) => {
        if (!targetName || !modalData) return;
        const result = await executeSweepingAttack(
            { automation: { secondaryTargetName: targetName } },
            modalData.playerStats,
            modalData.campaignName,
            targetName
        );
        if (result.payload) {
            setPopupHtml(result.payload);
        }
        setSweepingAttackTargetModal(null);
    }, [setPopupHtml, setSweepingAttackTargetModal]);

    const handleBaitAndSwitchChoiceConfirm = React.useCallback(async (targetName, modalData) => {
        if (!targetName || !modalData) return;
        const result = await executeBaitAndSwitchChoice(
            {
                dieValue: modalData.dieValue,
                maneuverName: modalData.maneuverName,
            },
            modalData.playerStats,
            modalData.campaignName,
            targetName
        );
        if (result.payload) {
            setPopupHtml(result.payload);
        }
        setBaitAndSwitchChoiceModal(null);
    }, [setPopupHtml, setBaitAndSwitchChoiceModal]);

    const handleCommanderStrikeChoiceConfirm = React.useCallback(async (targetName, modalData) => {
        if (!targetName || !modalData) return;
        const result = await executeCommanderStrikeChoice(
            {
                dieValue: modalData.dieValue,
                maneuverName: modalData.maneuverName,
            },
            modalData.playerStats,
            modalData.campaignName,
            targetName
        );
        if (result.payload) {
            setPopupHtml(result.payload);
        }
        setCommanderStrikeChoiceModal(null);
    }, [setPopupHtml, setCommanderStrikeChoiceModal]);

    const handleRallyChoiceConfirm = React.useCallback(async (targetName, modalData) => {
        if (!targetName || !modalData) return;
        const result = await executeRallyChoice(
            {
                dieValue: modalData.dieValue,
                maneuverName: modalData.maneuverName,
            },
            modalData.playerStats,
            modalData.campaignName,
            targetName,
            modalData.totalHp,
            modalData.extraHp,
            modalData.description
        );
        if (result.payload) {
            setPopupHtml(result.payload);
        }
        setRallyChoiceModal(null);
    }, [setPopupHtml, setRallyChoiceModal]);

    const handleBulwarkOfForceConfirm = React.useCallback(async (targetNames) => {
        if (!targetNames || !bulwarkOfForceModal) return;
        const result = await activateBulwarkOfForce(
            bulwarkOfForceModal.action,
            bulwarkOfForceModal.playerStats,
            bulwarkOfForceModal.campaignName,
            targetNames
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setBulwarkOfForceModal(null);
    }, [setPopupHtml, bulwarkOfForceModal, setBulwarkOfForceModal]);

    const handleCoronaEnemySelectionConfirm = React.useCallback(async (selectedEnemies) => {
        if (!selectedEnemies || !coronaEnemySelectionModal) return;
        const result = await activateCoronaOfLight(
            coronaEnemySelectionModal.action,
            coronaEnemySelectionModal.playerStats,
            coronaEnemySelectionModal.campaignName,
            selectedEnemies
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setCoronaEnemySelectionModal(null);
    }, [setPopupHtml, coronaEnemySelectionModal, setCoronaEnemySelectionModal]);

    const handleRadianceOfDawnConfirm = React.useCallback(async (selectedTargets) => {
        if (!selectedTargets || !radianceOfDawnModal) return;
        const result = await confirmRadianceOfDawn(
            radianceOfDawnModal.action,
            radianceOfDawnModal.playerStats,
            radianceOfDawnModal.campaignName,
            selectedTargets
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setRadianceOfDawnModal(null);
    }, [setPopupHtml, radianceOfDawnModal, setRadianceOfDawnModal]);

    const handleTricksterBlessingConfirm = React.useCallback(async (targetName) => {
        if (!tricksterBlessingModal) return;
        const { action, playerStats, campaignName: evtCampaignName } = tricksterBlessingModal;
        const auto = action.automation;
        const featureName = action.name || 'Blessing of the Trickster';

        const resolvedTarget = targetName || playerStats.name;

        const { wasActive } = toggleBuff(
            resolvedTarget,
            featureName,
            auto,
            evtCampaignName,
            resolvedTarget
        );

        if (!wasActive) {
            postLogEntry(evtCampaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: featureName,
                description: `Blessing granted to ${resolvedTarget} with advantage on Stealth checks.`,
            });
        }

        setPopupHtml({
            type: 'automation_info',
            name: featureName,
            automationType: auto?.type,
            description: wasActive
                ? `${featureName} toggled OFF`
                : `${featureName} activated on ${resolvedTarget === playerStats.name ? 'yourself' : resolvedTarget} (${auto?.duration || '1 hour'})`,
            automation: auto,
        });
        setTricksterBlessingModal(null);
    }, [setPopupHtml, tricksterBlessingModal, setTricksterBlessingModal]);

    const handleBardicInspirationConfirm = React.useCallback(async (targetName) => {
        if (!bardicInspirationTargetModal) return;
        const { action, playerStats: biPlayerStats, campaignName: biCampaignName, dieSize, hasCombatOptions } = bardicInspirationTargetModal;
        setBardicInspirationTargetModal(null);
        if (!targetName) return;
        const result = await applyBardicInspiration(action, biPlayerStats, biCampaignName, targetName, dieSize, hasCombatOptions);
        if (!result) return;
        if (result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }, [bardicInspirationTargetModal, setBardicInspirationTargetModal, setPopupHtml]);

    async function handleAutomationAction(action) {
        if (cannotAct) return;

        const playerName = playerStats.name;
        const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
        const cloakActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'cloak_of_shadows');

        const auto = action.automation;
        if (auto?.type === 'spell_modifier' && action.name === 'Metamagic') {
            setPopupHtml(buildEmpoweredSpellState(playerStats));
            return;
        }

        // If feature has options that need choosing (e.g. Blessed Strikes), present choice
        if (auto?.type === 'damage_bonus' && auto?.options?.length > 0) {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setFeatureChoice({ action, options: auto.options, optionKey });
                return;
            }
        }

        // Hunter's Prey: present choice between Colossus Slayer and Horde Breaker
        if (auto?.type === 'hunter_prey') {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setFeatureChoice({ action, options: ['Colossus Slayer', 'Horde Breaker'], optionKey });
                return;
            }
        }

        // Defensive Tactics: present choice between Escape the Horde and Multiattack Defense
        if (auto?.type === 'defensive_tactics') {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setFeatureChoice({ action, options: ['Escape the Horde', 'Multiattack Defense'], optionKey });
                return;
            }
        }

        // For save_attack features with element options (e.g. Elemental Attunement)
        if (auto?.type === 'save_attack' && auto?.hasOptions && auto?.options?.length > 0) {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setFeatureChoice({ action, options: auto.options, optionKey });
                return;
            }
        }

        // Spend 1 focus point for monk Ki features before dispatching
        // Skip FP cost for Hand of Healing and Flurry of Blows when Flurry of Healing and Harm is active
        // Skip FP cost for Flurry of Blows when Cloak of Shadows (Shadow Flurry) is active
        if (MONK_KI_FEATURES.includes(action.name)) {
            const skipFP = (HAS_FLURRY_HEALING_HARM && (action.name === 'Hand of Healing' || action.name === 'Flurry of Blows'))
                || (cloakActive && action.name === 'Flurry of Blows');
            if (!skipFP) {
                const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                const maxFP = classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
                const storedFP = getRuntimeValue(playerStats.name, 'focusPoints', campaignName);
                const currentFP = storedFP != null ? Number(storedFP) : (playerStats._trackedResources?.focusPoints?.current ?? maxFP);
                if (currentFP <= 0) {
                    setPopupHtml(`<b>${action.name}</b><br/>No ${playerStats.rules === '2024' ? "Focus Points" : 'ki points'} remaining.`);
                    return;
                }
                await setRuntimeValue(playerStats.name, 'focusPoints', currentFP - 1, campaignName);
                window.dispatchEvent(new CustomEvent('focus-points-updated'));
            }
        }

        // Check trigger conditions for gated actions
        if (auto?.trigger && auto.trigger !== '') {
            if (auto.trigger === 'after_casting_action_spell') {
                const lastCast = getRuntimeValue(playerStats.name, 'lastActionSpellCast', campaignName);
                if (!lastCast) {
                    setPopupHtml(`<b>${action.name}</b><br/>You must cast a spell with a casting time of an action first.`);
                    return;
                }
                await setRuntimeValue(playerStats.name, 'lastActionSpellCast', 0, campaignName);
            }
        }

        const result = await executeHandler(action, playerStats, campaignName, mapName, playerStats.equipment);
        if (!result) return;

        switch (result.type) {
            case 'popup':
                setPopupHtml(result.payload);
                break;
            case 'modal':
                switch (result.modalName) {
                    case 'healingPool': setHealingPoolModal(result.payload); break;
                    case 'handOfHealing': setHandOfHealingModal(result.payload); break;
                    case 'fontOfMagic': setFontOfMagicModal(true); break;
                    case 'resourcePool': setResourcePoolModal(result.payload); break;
                    case 'wildCompanion': setWildCompanionModal(result.payload); break;
                    case 'setCondition': setSetConditionModal(result.payload); break;
                    case 'eyebiteEffect': setEyebiteEffectModal(result.payload); break;
                    case 'attackRider': setAttackRiderModal(result.payload); break;
                    case 'openHandTechnique': setOpenHandTechniqueModal(result.payload); break;
                    case 'combatStance': setCombatStanceModal(result.payload); break;
                    case 'teleport': setTeleportModal(result.payload); break;
                    case 'healingIllusion': setHealingIllusionModal(result.payload); break;
                    case 'invokeDuplicity': setInvokeDuplicityModal(result.payload); break;
                    case 'saveAttackHeal': setSaveAttackHealModal(result.payload); break;
                    case 'divineSpark': setDivineSparkModal(result.payload); break;
                    case 'divineIntervention':
                        setDivineInterventionAction(action);
                        setDivineInterventionModal(result.payload);
                        break;
                    case 'moonlightStepResource': setMoonlightStepResourceModal(result.payload); break;
                    case 'starryFormConstellation': setStarryFormConstellationModal(result.payload); break;
                    case 'twinklingConstellation': setTwinklingConstellationModal(result.payload); break;
                    case 'arcaneCharge': setArcaneChargeModal(result.payload); break;
                    case 'warMagicCantrip': setWarMagicCantripModal(result.payload); break;
                    case 'warMagicSpell': setWarMagicSpellModal(result.payload); break;
                    case 'sacredWeaponDamageType': setSacredWeaponModal(result.payload); break;
                    case 'elderChampionRestore': setElderChampionRestoreModal(result.payload); break;
                    case 'primalCompanionBonusActionCommand': setPrimalCompanionBonusActionModal(result.payload); break;
                    case 'mistyWanderer': setMistyWandererModal(result.payload); break;
                    case 'bonusActionChoice': setBonusActionChoiceModal(result.payload); break;
                    case 'stealthAttack': setStealthAttackModal(result.payload); break;
                    case 'revelationInFlesh': setRevelationInFleshModal(result.payload); break;
                    case 'bastionOfLaw': setBastionOfLawModal(result.payload); break;
                    case 'elementalAffinity': {
                        const affPayload = result.payload;
                        const affAction = affPayload?.action;
                        const affTypes = affPayload?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];
                        setElementalAffinityModal({ action: affAction, playerStats, campaignName, damageTypes: affTypes, existingType: affPayload?.existingType });
                        break;
                    }
                    case 'fiendishResilience': {
                        const frPayload = result.payload;
                        const frAction = frPayload?.action;
                        const frTypes = frPayload?.damageTypes || ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
                        setFiendishResilienceModal({ action: frAction, playerStats, campaignName, damageTypes: frTypes, existingType: frPayload?.existingType });
                        break;
                    }
                    case 'boonOfEnergyResistance': {
                        const berPayload = result.payload;
                        const berAction = berPayload?.action;
                        const berTypes = berPayload?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];
                        setBoonOfEnergyResistanceModal({ action: berAction, playerStats, campaignName, damageTypes: berTypes, existingTypes: berPayload?.existingTypes, maxSelections: berPayload?.maxSelections || 2 });
                        break;
                    }
                    case 'dragonCompanion':
                        setDragonCompanionModal(result.payload);
                        break;
                    case 'wildMagicDoubleRoll':
                        setWildMagicDoubleRollModal(result.payload);
                        break;
                    case 'weaponMasteryChoice':
                        setWeaponMasteryChoiceModal(result.payload);
                        break;
                    case 'weaponKindMastery':
                        setWeaponKindMasteryModal(result.payload);
                        break;
                    case 'wildMagicTamed':
                        setWildMagicTamedModal(result.payload);
                        break;
                    case 'thirdEye':
                        setThirdEyeModal(result.payload);
                        break;
                    case 'soulstitchSpells':
                        setSoulstitchSpellsModal(result.payload);
                        break;
                    case 'illusoryReality':
                        setIllusoryRealityModal(result.payload);
                        break;
                    case 'celestialRevelation':
                        setCelestialRevelationModal(result.payload);
                        break;
                    case 'elfishLineage':
                        setElfisLineageModal(result.payload);
                        break;
                    case 'gnomishLineage':
                        setGnomishLineageModal(result.payload);
                        break;
                    case 'fiendishLegacy':
                        setFiendishLegacyModal(result.payload);
                        break;
                    case 'giantAncestry':
                        setGiantAncestryModal(result.payload);
                        break;
                    case 'breathWeaponShape': {
                        const bwPayload = result.payload;
                        setBreathWeaponShapeModal({ action: bwPayload.action, playerStats, campaignName, options: bwPayload.options });
                        break;
                    }
                    case 'hypnoticPatternShake': {
                        const shakePayload = result.payload;
                        setHypnoticPatternShakeModal(shakePayload);
                        break;
                    }
                    case 'combatSuperiority':
                        setCombatSuperiorityModal(result.payload);
                        break;
                    case 'sweepingAttackTarget':
                        setSweepingAttackTargetModal(result.payload);
                        break;
                    case 'baitAndSwitchChoice':
                        setBaitAndSwitchChoiceModal(result.payload);
                        break;
                    case 'bulwarkOfForceTarget':
                        setBulwarkOfForceModal(result.payload);
                        break;
                    case 'coronaEnemySelection':
                        setCoronaEnemySelectionModal(result.payload);
                        break;
                    case 'radianceOfDawn':
                        setRadianceOfDawnModal(result.payload);
                        break;
                    case 'tricksterBlessing':
                        setTricksterBlessingModal(result.payload);
                        break;
                    case 'bardicInspirationTarget':
                        setBardicInspirationTargetModal(result.payload);
                        break;
                    case 'arcaneWardRestore':
                        setArcaneWardRestoreModal(result.payload);
                        break;
                    case 'defensiveTactics': {
                        const actionData = result.payload?.action;
                        const defensiveChoice = getRuntimeValue(playerStats.name, '_Defensive_Tactics_choice', campaignName);
                        if (!defensiveChoice) {
                            const choicesHtml = `
                                <b>Defensive Tactics</b><br/><br/>
                                Choose one option:<br/><br/>
                                <b>Escape the Horde</b><br/>
                                Opportunity Attacks have Disadvantage against you.<br/><br/>
                                <b>Multiattack Defense</b><br/>
                                When a creature hits you with an attack roll, that creature has Disadvantage on all other attack rolls against you this turn.<br/><br/>
                                To set your choice, use the Defensive Tactics button below or set the runtime value manually.
                            `;
                            setPopupHtml({ type: 'automation_info', name: actionData?.name || 'Defensive Tactics', description: choicesHtml });
                        }
                        break;
                    }
                }
                break;
            case 'roll':
                if (result.payload.rollType === 'damage') {
                    rollDamage(
                        result.payload.name,
                        result.payload.formula,
                        result.payload.total,
                        result.payload.rolls,
                        result.payload.modifier,
                        result.payload.contextConfig || {}
                    );
                }
                break;
            case 'notify_buffs_changed':
                if (onBuffsChange) onBuffsChange();
                break;
        }

        if (result.logEntries) {
            result.logEntries.forEach(entry => addEntry(campaignName, entry).catch(() => { }));
        }

        if (result.type === 'popup' && (auto?.type === 'temp_buff' || auto?.type === 'combat_stance')) {
            if (onBuffsChange) onBuffsChange();
        }
    }

    const handleDivineInterventionCast = React.useCallback(async (selectedSpell) => {
        setDivineInterventionModal(null);
        const action = divineInterventionAction;
        setDivineInterventionAction(null);
        if (!action) return;

        const result = await onDivineInterventionSpellSelected(action, playerStats, campaignName, selectedSpell);
        if (!result) return;

        if (result.type === 'spell_selected') {
            const spell = result.spell;
            const getTargetInfoFn = async () => {
                const cs = await getCombatContext(campaignName);
                return cs ? getTargetFromAttacker(cs, playerStats.name) : null;
            };
            executeSpellCast(spell, {}, {
                rollAttack,
                rollDamage,
                playerStats,
                getTargetInfo: getTargetInfoFn,
                campaignName,
                mapName,
                characters,
            }).then((healResult) => {
                if (healResult && healResult.healAmount > 0) {
                    const bonusHealDetail = healResult.bonusDetails?.length > 0
                        ? healResult.bonusDetails.map(d => `${d.amount} ${d.name}`).join(', ')
                        : '';
                    const rawTotal = healResult.rawTotal ?? healResult.healAmount;
                    setPopupHtml({
                        type: 'heal',
                        name: spell.name,
                        formula: healResult.formula,
                        rolls: healResult.rolls || [],
                        total: rawTotal,
                        targetName: healResult.targetName,
                        finalHeal: healResult.healAmount,
                        bonusHeal: healResult.bonusHeal || 0,
                        bonusHealDetail,
                    });
                }
            }).catch((e) => { console.error('[CharActions] executeSpellCast error:', e); });

            setPopupHtml({
                type: 'automation_info',
                name: result.name,
                description: `Divine Intervention cast ${spell.name}. Divine Intervention recharges ${result.rechargeMessage}`,
            });
        }
    }, [divineInterventionAction, playerStats, campaignName, rollAttack, rollDamage, mapName, setPopupHtml, setDivineInterventionModal, setDivineInterventionAction, characters]);


    const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

    const actionSpellNameSet = getActionSpellNames(playerStats, campaignName);
    const actionSpells = (playerStats.spellAbilities?.spells || []).filter(spell => actionSpellNameSet.has(spell.name));
    const actionSpellNames = actionSpells.reduce((acc, spell) => { acc[spell.name] = spell; return acc; }, {});

    const actionAttacks = playerStats.attacks?.filter(a => a.type === 'Action') || [];

    const handleActionSpellClick = (spellName) => {
        let spell = actionSpellNames[spellName];
        if (!spell) {
            spell = playerStats.spellAbilities?.spells?.find(s => s.name === spellName);
        }
        if (!spell) return;
        setSelectedActionSpell(spell);
    };

    const { resolvePositions: resolveActionSpellPositions, cachedPosRef: cachedActionCastPosRef } = useSpellPositionResolver(campaignName, mapName, playerStats.name);

    const { castAction: actionCastAction } = useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, { featEffects: featRangeEffects }, cachedActionCastPosRef);

    const { pendingMetamagic: actionPendingMetamagic, gateMetamagic: actionGateMetamagic, handleConfirm: actionHandleConfirm, handleSkip: actionHandleSkip, pendingAid: actionPendingAid, handleAidConfirm: actionHandleAidConfirm, handleAidSkip: actionHandleAidSkip, pendingGreaterRestoration: actionPendingGreaterRestoration, handleGreaterRestorationConfirm: actionHandleGreaterRestorationConfirm, handleGreaterRestorationSkip: actionHandleGreaterRestorationSkip, pendingRemoveCurse: actionPendingRemoveCurse, handleRemoveCurseConfirm: actionHandleRemoveCurseConfirm, handleRemoveCurseSkip: actionHandleRemoveCurseSkip, pendingMagicMissile: actionPendingMagicMissile, handleMagicMissileConfirm: actionHandleMagicMissileConfirm, handleMagicMissileSkip: actionHandleMagicMissileSkip } = useSpellMetamagicFlow(playerStats, campaignName, actionCastAction);

    const handleActionSpellCast = React.useCallback(async (spell, metaCtx) => {
        setSelectedActionSpell(null);
        await resolveActionSpellPositions();
        actionGateMetamagic(spell, metaCtx);
    }, [actionGateMetamagic, resolveActionSpellPositions]);

    const is2024Rules = playerStats.rules === '2024';

    const categories = getCategories(playerStats.rules || '5e');

    return (
        <div className="char-actions">
            <div>
                <div className='sectionHeader'>Actions</div>
                {cannotAct && <span className='disabled-attack-label'>(Incapacitated)</span>}
                <div className={`attacks ${is2024Rules ? 'mastery-enabled' : ''}`}>
                    <div className='left'><b>Name</b></div>
                    <div><b>Level</b></div>
                    <div><b>Range</b></div>
                    <div><b>Hit</b></div>
                    <div><b>Damage</b></div>
                    <div className='left'><b>Type</b></div>
                    {is2024Rules && <div><b>Mastery</b></div>}
                    {actionAttacks.map((attack) => {
                        const attackLevel = getAttackSpellLevel(playerStats.spellAbilities, attack.name);
                        const attackItem = { ...attack };
                        return <React.Fragment key={attack.name}>
                            <div className='left clickable' onClick={() => handleAttackClick(attackItem)}>{attack.name}</div>
                            <div>{attackLevel != null ? (attackLevel === 0 ? 'Cantrip' : attackLevel) : ''}</div>
                            <div>{formatRange(attack.range)}</div>
                            {attack.saveDc
                                ? <div className="save-dc-display">DC {attack.saveDc + displaySaveDcBonus} {attack.saveType}</div>
                                : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => handleSpellAttackClick(attackItem)}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                            <div className={attack.damage ? "clickable" : ""} onClick={() => {
                                if (cannotAct) return;
                                if (attack.saveDc) { resolveSpellDamage(attackItem); return; }
                                handleSimpleDamageRoll(attackItem);
                            }}>{attack.damage}</div>
                            <div className='left'>{attack.damageType}</div>
                            {is2024Rules && (() => { const mastery = getWeaponMastery(attack.name, attack, playerStats); return <div className={mastery ? "clickable" : ""} onClick={() => { if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{mastery}</div>; })()}
                        </React.Fragment>;
                    })}
                    {actionSpells.map((spell) => {
                        const damageType = typeof spell.damage === 'string' ? '' : (spell.damage?.damage_type || '');
                        const resolvedDamage = spell.heal_at_slot_level ? '' : resolveSpellDamageAtLevel(spell, playerStats.level);
                        const autoHit = isAutoHitSpell(spell);
                        const isSpellAtk = !spell.dc;
                        const attackItem = { ...spell, type: 'Action', hitBonus: playerStats.spellAbilities?.toHit, saveDc: spell.dc ? playerStats.spellAbilities.saveDc : null, saveType: spell.dc?.dc_type, saveSuccess: spell.dc?.dc_success, damage: resolvedDamage, damageType };
                        return <React.Fragment key={spell.name}>
                            <div className='left clickable' onClick={() => handleActionSpellClick(spell.name)}>{spell.name}</div>
                            <div>{spell.level === 0 ? 'Cantrip' : spell.level}</div>
                            <div>{formatRange(spell.range)}</div>
                            {autoHit
                                ? <div></div>
                                : isSpellAtk
                                    ? <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => handleSpellAttackClick(attackItem)}>{signFormatter.format(playerStats.spellAbilities?.toHit - exhaustionPenalty)}</div>
                                    : <div className="save-dc-display">DC {playerStats.spellAbilities?.saveDc + displaySaveDcBonus} {spell.dc?.dc_type}</div>}
                            <div className={resolvedDamage ? "clickable" : ""} onClick={() => {
                                if (cannotAct) return;
                                if (isSpellAtk && spell.saveDc) { resolveSpellDamage(attackItem); return; }
                                if (isSpellAtk) { actionCastAction(spell, {}); return; }
                                actionCastAction(spell, {});
                            }}>{resolvedDamage}</div>
                            <div className='left'>{damageType || (spell.heal_at_slot_level ? 'Healing' : 'Utility')}</div>
                            {is2024Rules && <div></div>}
                        </React.Fragment>;
                    })}
                </div>
                {(() => {
                    const activeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
                    const hasteActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'haste');
                    if (!hasteActive) return null;
                    const hasteUsedThisTurn = getRuntimeValue(playerStats.name, 'hasteExtraActionUsed', campaignName);
                    const hasteActions = ['Attack', 'Dash', 'Disengage', 'Hide', 'Use an Object'];
                    return (
                        <div>
                            <span className='sectionHeader'>Haste Extra Action</span>
                            <div className='attacks'>
                                <div className='left'><b>Action</b></div>
                                <div><b>Range</b></div>
                                <div><b>Level</b></div>
                                <div><b>Hit</b></div>
                                <div><b>Damage</b></div>
                                <div className='left'><b>Type</b></div>
                                {is2024Rules && <div><b>Mastery</b></div>}
                                {hasteActions.map(actionName => {
                                    const isAttack = actionName === 'Attack';
                                    const isDisabled = hasteUsedThisTurn;
                                    const handleClick = () => {
                                        if (cannotAct || isDisabled) return;
                                        if (isAttack) {
                                            handleHasteAttack(actionName, campaignName);
                                        } else {
                                            handleHasteAction(actionName, campaignName);
                                        }
                                    };
                                    return (
                                        <React.Fragment key={actionName}>
                                            <div className={`left clickable ${isDisabled ? 'disabled-attack' : ''}`} onClick={handleClick}>{actionName}</div>
                                            <div>—</div>
                                            <div>-</div>
                                            <div>—</div>
                                            <div>—</div>
                                            <div className='left'>{isAttack ? 'Melee/Ranged' : 'Special'}</div>
                                            {is2024Rules && <div></div>}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
                <div className='half-line'></div>
                <CharActionModals
                    playerStats={playerStats}
                    campaignName={campaignName}
                    mapName={mapName}
                    characters={characters}
                    healingPoolModal={healingPoolModal} setHealingPoolModal={setHealingPoolModal}
                    handOfHealingModal={handOfHealingModal} setHandOfHealingModal={setHandOfHealingModal}
                    fontOfMagicModal={fontOfMagicModal} setFontOfMagicModal={setFontOfMagicModal}
                    resourcePoolModal={resourcePoolModal} setResourcePoolModal={setResourcePoolModal}
                    wildCompanionModal={wildCompanionModal} setWildCompanionModal={setWildCompanionModal}
                    setConditionModal={setConditionModal} setSetConditionModal={setSetConditionModal}
                    attackRiderModal={attackRiderModal} setAttackRiderModal={setAttackRiderModal}
                    openHandTechniqueModal={openHandTechniqueModal} setOpenHandTechniqueModal={setOpenHandTechniqueModal}
                    weaponMasteryModal={weaponMasteryModal}
                    weaponMasteryChoiceModal={weaponMasteryChoiceModal} setWeaponMasteryChoiceModal={setWeaponMasteryChoiceModal}
                    weaponKindMasteryModal={weaponKindMasteryModal} setWeaponKindMasteryModal={setWeaponKindMasteryModal}
                    combatStanceModal={combatStanceModal} setCombatStanceModal={setCombatStanceModal}
                    teleportModal={teleportModal} setTeleportModal={setTeleportModal}
                    healingIllusionModal={healingIllusionModal} setHealingIllusionModal={setHealingIllusionModal}
                    invokeDuplicityModal={invokeDuplicityModal} setInvokeDuplicityModal={setInvokeDuplicityModal}
                    saveAttackHealModal={saveAttackHealModal} setSaveAttackHealModal={setSaveAttackHealModal}
                    divineSparkModal={divineSparkModal} setDivineSparkModal={setDivineSparkModal}
                    divineInterventionModal={divineInterventionModal} setDivineInterventionModal={setDivineInterventionModal}
                    divineInterventionAction={divineInterventionAction} setDivineInterventionAction={setDivineInterventionAction}
                    moonlightStepResourceModal={moonlightStepResourceModal} setMoonlightStepResourceModal={setMoonlightStepResourceModal}
                    starryFormConstellationModal={starryFormConstellationModal} setStarryFormConstellationModal={setStarryFormConstellationModal}
                    twinklingConstellationModal={twinklingConstellationModal} setTwinklingConstellationModal={setTwinklingConstellationModal}
                    arcaneChargeModal={arcaneChargeModal} setArcaneChargeModal={setArcaneChargeModal}
                    warMagicCantripModal={warMagicCantripModal} setWarMagicCantripModal={setWarMagicCantripModal}
                    warMagicSpellModal={warMagicSpellModal} setWarMagicSpellModal={setWarMagicSpellModal}
                    sacredWeaponModal={sacredWeaponModal} setSacredWeaponModal={setSacredWeaponModal}
                    elderChampionRestoreModal={elderChampionRestoreModal} setElderChampionRestoreModal={setElderChampionRestoreModal}
                    primalCompanionBonusActionModal={primalCompanionBonusActionModal} setPrimalCompanionBonusActionModal={setPrimalCompanionBonusActionModal}
                    mistyWandererModal={mistyWandererModal} setMistyWandererModal={setMistyWandererModal}
                    bonusActionChoiceModal={bonusActionChoiceModal} setBonusActionChoiceModal={setBonusActionChoiceModal}
                    stealthAttackModal={stealthAttackModal} setStealthAttackModal={setStealthAttackModal}
                    revelationInFleshModal={revelationInFleshModal} setRevelationInFleshModal={setRevelationInFleshModal}
                    bastionOfLawModal={bastionOfLawModal} setBastionOfLawModal={setBastionOfLawModal}
                    elementalAffinityModal={elementalAffinityModal} setElementalAffinityModal={setElementalAffinityModal}
                    fiendishResilienceModal={fiendishResilienceModal} setFiendishResilienceModal={setFiendishResilienceModal}
                    boonOfEnergyResistanceModal={boonOfEnergyResistanceModal} setBoonOfEnergyResistanceModal={setBoonOfEnergyResistanceModal}
                    dragonCompanionModal={dragonCompanionModal} setDragonCompanionModal={setDragonCompanionModal}
                    wildMagicDoubleRollModal={wildMagicDoubleRollModal} setWildMagicDoubleRollModal={setWildMagicDoubleRollModal}
                    wildMagicTamedModal={wildMagicTamedModal} setWildMagicTamedModal={setWildMagicTamedModal}
                    thirdEyeModal={thirdEyeModal} setThirdEyeModal={setThirdEyeModal}
                    soulstitchSpellsModal={soulstitchSpellsModal} setSoulstitchSpellsModal={setSoulstitchSpellsModal}
                    illusoryRealityModal={illusoryRealityModal} setIllusoryRealityModal={setIllusoryRealityModal}
                    celestialRevelationModal={celestialRevelationModal} setCelestialRevelationModal={setCelestialRevelationModal}
                    elfishLineageModal={elfishLineageModal} setElfisLineageModal={setElfisLineageModal}
                    gnomishLineageModal={gnomishLineageModal} setGnomishLineageModal={setGnomishLineageModal}
                    fiendishLegacyModal={fiendishLegacyModal} setFiendishLegacyModal={setFiendishLegacyModal}
                    giantAncestryModal={giantAncestryModal} setGiantAncestryModal={setGiantAncestryModal}
                    hypnoticPatternShakeModal={hypnoticPatternShakeModal} setHypnoticPatternShakeModal={setHypnoticPatternShakeModal}
                    arcaneWardRestoreModal={arcaneWardRestoreModal} setArcaneWardRestoreModal={setArcaneWardRestoreModal}
                    eyebiteEffectModal={eyebiteEffectModal} setEyebiteEffectModal={setEyebiteEffectModal}
                    breathWeaponShapeModal={breathWeaponShapeModal} setBreathWeaponShapeModal={setBreathWeaponShapeModal}
                    divineFuryChoice={divineFuryChoice}
                    damageTypeChoice={damageTypeChoice}
                    featureChoice={featureChoice}
                    handleMasteryClose={handleMasteryClose}
                    handleWeaponMasteryChoice={handleWeaponMasteryChoice}
                    handleWeaponKindMasteryClose={handleWeaponKindMasteryClose}
                    handleDivineFuryDamageType={handleDivineFuryDamageType}
                    handleDivineFurySkip={handleDivineFurySkip}
                    handleGenericDamageTypeChoice={handleGenericDamageTypeChoice}
                    handleGenericDamageTypeSkip={handleGenericDamageTypeSkip}
                    handleDamageTypeModifierChoice={handleDamageTypeModifierChoice}
                    handleDamageTypeModifierSkip={handleDamageTypeModifierSkip}
                    handleEnhancedUnarmedChoice={handleEnhancedUnarmedChoice}
                    handleEnhancedUnarmedSkip={handleEnhancedUnarmedSkip}
                    handleFeatureChoiceConfirm={handleFeatureChoiceConfirm}
                    handleFeatureChoiceSkip={handleFeatureChoiceSkip}
                    handleConstellationSelect={handleConstellationSelect}
                    handleElderChampionRestore={handleElderChampionRestore}
                    handleDivineInterventionCast={handleDivineInterventionCast}
                    pendingDamageRef={pendingDamageRef}
                    buildCtx={buildCtx}
                    buildCtxSync={buildCtxSync}
                    autoDamageContext={autoDamageRollContext}
                    rollDamage={rollDamage}
                    setPopupHtml={setPopupHtml}
                    mapName={mapName}
                    combatSuperiorityModal={combatSuperiorityModal} setCombatSuperiorityModal={setCombatSuperiorityModal}
                    attackRiderManeuverPrompt={attackRiderManeuverPrompt} setAttackRiderManeuverPrompt={setAttackRiderManeuverPrompt}
                    sweepingAttackTargetModal={sweepingAttackTargetModal} setSweepingAttackTargetModal={setSweepingAttackTargetModal}
                    handleSweepingAttackConfirm={handleSweepingAttackConfirm}
                    baitAndSwitchChoiceModal={baitAndSwitchChoiceModal} setBaitAndSwitchChoiceModal={setBaitAndSwitchChoiceModal}
                    handleBaitAndSwitchChoiceConfirm={handleBaitAndSwitchChoiceConfirm}
                    commanderStrikeChoiceModal={commanderStrikeChoiceModal} setCommanderStrikeChoiceModal={setCommanderStrikeChoiceModal}
                    handleCommanderStrikeChoiceConfirm={handleCommanderStrikeChoiceConfirm}
                    rallyChoiceModal={rallyChoiceModal} setRallyChoiceModal={setRallyChoiceModal}
                    handleRallyChoiceConfirm={handleRallyChoiceConfirm}
                    bulwarkOfForceModal={bulwarkOfForceModal} setBulwarkOfForceModal={setBulwarkOfForceModal}
                    handleBulwarkOfForceConfirm={handleBulwarkOfForceConfirm}
                    coronaEnemySelectionModal={coronaEnemySelectionModal} setCoronaEnemySelectionModal={setCoronaEnemySelectionModal}
                    handleCoronaEnemySelectionConfirm={handleCoronaEnemySelectionConfirm}
                    radianceOfDawnModal={radianceOfDawnModal} setRadianceOfDawnModal={setRadianceOfDawnModal}
                    handleRadianceOfDawnConfirm={handleRadianceOfDawnConfirm}
                    tricksterBlessingModal={tricksterBlessingModal} setTricksterBlessingModal={setTricksterBlessingModal}
                    handleTricksterBlessingConfirm={handleTricksterBlessingConfirm}
                    bardicInspirationTargetModal={bardicInspirationTargetModal}
                    handleBardicInspirationConfirm={handleBardicInspirationConfirm}
                    handleCombatSuperiorityConfirm={handleCombatSuperiorityConfirm}
                    handleAttackRiderManeuverUse={handleAttackRiderManeuverUse}
                    handleAttackRiderManeuverSkip={handleAttackRiderManeuverSkip}
                />
                <CharActionSpellPopups
                    playerStats={playerStats}
                    campaignName={campaignName}
                    selectedActionSpell={selectedActionSpell}
                    setSelectedActionSpell={setSelectedActionSpell}
                    buildUpcastLevels={buildUpcastLevels}
                    handleActionSpellCast={handleActionSpellCast}
                    actionPendingMetamagic={actionPendingMetamagic}
                    actionHandleConfirm={actionHandleConfirm}
                    actionHandleSkip={actionHandleSkip}
                    actionPendingAid={actionPendingAid}
                    actionHandleAidConfirm={actionHandleAidConfirm}
                    actionHandleAidSkip={actionHandleAidSkip}
                    actionPendingGreaterRestoration={actionPendingGreaterRestoration}
                    actionHandleGreaterRestorationConfirm={actionHandleGreaterRestorationConfirm}
                    actionHandleGreaterRestorationSkip={actionHandleGreaterRestorationSkip}
                    actionPendingRemoveCurse={actionPendingRemoveCurse}
                    actionHandleRemoveCurseConfirm={actionHandleRemoveCurseConfirm}
                    actionHandleRemoveCurseSkip={actionHandleRemoveCurseSkip}
                    actionPendingMagicMissile={actionPendingMagicMissile}
                    actionHandleMagicMissileConfirm={actionHandleMagicMissileConfirm}
                    actionHandleMagicMissileSkip={actionHandleMagicMissileSkip}
                    pendingActionMetamagic={pendingActionMetamagic}
                    handleActionMetamagicConfirm={handleActionMetamagicConfirm}
                    handleActionMetamagicSkip={handleActionMetamagicSkip}
                />
                {(playerStats.actions || []).filter(a => !categories.featuresToIgnore.includes(a.name)).map((action) => {
                    const auto = action.automation;
                    const isMetamagic = action.name === 'Metamagic' && auto?.type === 'spell_modifier';
                    const isClickable = action.details || hasAutomation(action);
                    const isRageExpendable = auto?.recharge === 'long_rest_or_expend_rage';
                    const exhausted = isRageExpendable && isExhausted(action, playerStats, campaignName);
                     const handleClick = () => {
                         if (exhausted) return;
                         if (hasAutomation(action)) {
                             handleAutomationAction(action);
                         } else {
                             setPopupHtml(buildFeatureDetailHtml(action));
                         }
                     };
                    const displayName = isMetamagic ? 'Empowered Spell' : action.name;
                    const displayDesc = isMetamagic ? getEmpoweredSpellDescription(action) : action.description;
                    const renderRageRestore = async () => {
                        await handleRestoreRage(playerStats, campaignName, action.name, auto, setPopupHtml);
                    };
                    return <div key={action.name}>
                        <b className={isClickable && !exhausted ? "clickable" : ""} onClick={handleClick}>{displayName}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayDesc) }}></span>
                        {hasAutomation(action) && auto?.type === 'save_attack' && auto?.saveDc && <span className="automation-badge"> DC {auto.saveDc} {auto.saveType}</span>}
                        {hasAutomation(action) && auto?.type === 'healing_pool' && <span className="automation-badge"> Pool: {auto.pool} HP</span>}
                        {hasAutomation(action) && auto?.damage && <span className="automation-badge"> {auto.damage} {auto.damageType}</span>}
                        {exhausted && isRageExpendable && <span className="automation-badge clickable" onClick={renderRageRestore}><i className="fa-solid fa-fire-flame-curved"></i> Restore with Rage</span>}
                    </div>
                })}
                <div><b>Base Actions:</b> {actions.map((actionName, idx) => {
                    if (actionName === 'Hide') {
                        return (
                            <React.Fragment key={idx}>
                                {idx > 0 && ', '}
                                <span className="clickable" onClick={async () => {
                                    if (cannotAct) return;
                                    const currentConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) || [];
                                    const isAlreadyInvisible = currentConditions.some(c => String(c).toLowerCase() === 'invisible');
                                    if (isAlreadyInvisible) {
                                        setPopupHtml({ type: 'automation_info', name: 'Hide', description: 'You are already hidden (Invisible condition active).' });
                                        return;
                                    }
                                    const newConditions = [...currentConditions, 'invisible'];
                                    await setRuntimeValue(playerStats.name, 'activeConditions', newConditions, campaignName);
                                    const activeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
                                    const hasAdvantageOnStealth = activeBuffs.some(b => b.effect === 'advantage_on_stealth');
                                    const newBuffs = hasAdvantageOnStealth ? activeBuffs : [...activeBuffs, { name: 'Hide', effect: 'advantage_on_stealth' }];
                                    await setRuntimeValue(playerStats.name, 'activeBuffs', newBuffs, campaignName);
                                    setPopupHtml({ type: 'automation_info', name: 'Hide', description: 'You attempt to Hide. You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.' });
                                    await addEntry(campaignName, {
                                        type: 'ability_use',
                                        characterName: playerStats.name,
                                        abilityName: 'Hide',
                                        description: 'Gained Invisible condition and advantage on Stealth checks.',
                                    }).catch(() => {});
                                }}>{actionName}</span>
                            </React.Fragment>
                        );
                    }
                    return <React.Fragment key={idx}>{idx > 0 && ', '}{actionName}</React.Fragment>;
                })}</div>
            </div>
            <CharBonusActions
                playerStats={playerStats}
                campaignName={campaignName}
                exhaustionPenalty={exhaustionPenalty}
                conditionAttackMode={conditionAttackMode}
                cannotAct={cannotAct}
                mapName={mapName}
                onAttackClick={handleAttackClick}
                onResolveAttackDamage={resolveAttackDamage}
                onResolveSpellDamage={resolveSpellDamage}
                onAutomationAction={handleAutomationAction}
                getWeaponMastery={getWeaponMastery}
                rollAttack={rollAttack}
                rollDamage={rollDamage}
                getTargetInfo={getTargetInfo}
                characters={characters}
            />
            {showCleaveTargetSelection && (
                <SecondaryTargetModal
                    title="Cleave — Choose Second Target"
                    targets={cleaveSecondTargets}
                    onTargetSelected={handleCleaveAttack}
                    onSkip={() => { setShowCleaveTargetSelection(false); setCleaveSecondTargets([]); }}
                    featureDescription="On a hit, the second creature takes weapon damage (no ability modifier to damage unless negative). Once per turn."
                />
            )}
            {tacticalMasterModal && (
                <TacticalMasterModal
                    attackName={tacticalMasterModal.attackName}
                    baseMastery={tacticalMasterModal.baseMastery}
                    replaceOptions={tacticalMasterModal.replaceOptions}
                    targetName={tacticalMasterModal.targetName}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onConfirm={handleTacticalMasterConfirm}
                    onClose={handleTacticalMasterDismiss}
                />
            )}
            {secondaryTargetModal && (
                <SecondaryTargetModal
                    title={secondaryTargetModal.title}
                    targets={secondaryTargetModal.targets}
                    onTargetSelected={secondaryTargetModal.onTargetSelected}
                    onSkip={secondaryTargetModal.onSkip}
                    featureDescription={secondaryTargetModal.featureDescription}
                    description={secondaryTargetModal.description}
                    confirmLabel={secondaryTargetModal.confirmLabel}
                />
            )}
        </div>
    )
}, areEqual);

export default CharActions
