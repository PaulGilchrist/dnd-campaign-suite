
import React, { useState, useEffect, useCallback } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import MetamagicPopup from './MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { parseMagicItemName } from '../../services/attackCalc.js';
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import { rollExpression, rollExpressionDoubled, parseExpression } from '../../services/diceRoller.js';
import { getTargetFromAttacker, getCombatContext, getResistanceNotice, getAttackerTargetName } from '../../services/damageUtils.js';
import * as mapsService from '../../services/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem } from '../../services/rangeValidation.js';
import { computeCover } from '../../services/coverService.js';
import { computeFeatRangeEffects } from '../../services/featRangeService.js';
import { loadNPCs } from '../../services/npcsService.js';
import { hasAutomation } from '../../services/automationService.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js'
import storage from '../../services/storage.js'
import utils from '../../services/utils.js'
import HealingPoolModal from './HealingPoolModal.jsx'
import FontOfMagicModal from './FontOfMagicModal.jsx'
import CharBonusActions from './CharBonusActions.jsx'
import { getClassFeatures } from '../../services/classFeatures.js';
import { addEntry } from '../../services/logService.js';
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints, getLastDamageEvent, saveLastDamageEvent } from '../../hooks/useMetamagic.js';
import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js'
import { executeSpellCast } from '../../services/spellCastService.js'
import { getChaModifier } from '../../services/metamagicRules.js';
import { applyDamageToTarget } from '../../services/applyDamage.js';
import './CharActions.css'
import { isEqual } from 'lodash';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats) && prevProps.conditionAttackMode === nextProps.conditionAttackMode && prevProps.exhaustionPenalty === nextProps.exhaustionPenalty && prevProps.cannotAct === nextProps.cannotAct;

const CharActions = React.memo(function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, onBuffsChange }) {
    const [actions, setActions] = useState([]);
    const [selectedActionSpell, setSelectedActionSpell] = useState(null);
    const [actionSpellPendingMetamagic, setActionSpellPendingMetamagic] = useState(null);
    const [featRangeEffects, setFeatRangeEffects] = useState(null);
    const [healingPoolModal, setHealingPoolModal] = useState(null);
    const [fontOfMagicModal, setFontOfMagicModal] = useState(null);

    useEffect(() => {
        computeFeatRangeEffects(playerStats.feats, playerStats.rules).then(setFeatRangeEffects).catch(() => { });
    }, [playerStats.feats, playerStats.rules]);

    useEffect(() => {
        fetch('/data/actions.json')
            .then(response => response.json())
            .then(data => setActions(data))
            .catch(error => console.error('Error loading actions:', error));
    }, []);

    // Passive: recover Focus Points when anyone rolls initiative
    useEffect(() => {
        const handleInitiativeRolled = (e) => {
            if (!playerStats || !e.detail || !e.detail.characterName) return;
            const rollingName = utils.getName(e.detail.characterName);
            const myName = utils.getName(playerStats.name);
            if (rollingName !== myName) return;

            // Check if this character has an initiative_action with regain_focus_points_and_heal effect
            const hasInitAction = playerStats.actions?.some(a => a.automation?.type === 'initiative_action');
            if (!hasInitAction) return;

            // Get max focus points from class data and set current to max
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const maxFP = classLevel?.focus_points || getRuntimeValue(playerStats.name, 'focusPoints', campaignName) || 0;
            if (!maxFP) return;

            // Only recover if current is less than max (avoid unnecessary writes when already full)
            const currentFP = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName)) || 0;
            if (currentFP >= maxFP) return;

            setRuntimeValue(playerStats.name, 'focusPoints', maxFP, campaignName);
        };
        window.addEventListener('initiative-rolled', handleInitiativeRolled);
        return () => window.removeEventListener('initiative-rolled', handleInitiativeRolled);
    }, [playerStats, campaignName]);
    const { popupHtml, setPopupHtml, rollAttack, rollDamage, quickRollPlayerSave } = useLoggedDiceRoll(playerStats.name, campaignName, {
        autoDamageRoll: (autoDamage, isCrit) => {
            const result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
            if (result) {
                rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, {
                    damageType: autoDamage.damageType,
                    targetName: autoDamage.targetName,
                    attackerName: autoDamage.attackerName,
                    saveDc: autoDamage.saveDc,
                    saveType: autoDamage.saveType,
                    dcSuccess: autoDamage.dcSuccess,
                });
            }
        },
    });

    const getCombatTargetInfo = React.useCallback(() => {
        const cs = getCombatContext();
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, playerStats.name);
        if (!target) return null;
        return target;
    }, [playerStats.name]);

    const buildAttackContextSync = React.useCallback((attack) => {
        const target = getCombatTargetInfo();
        const targetName = target?.name || (() => {
            const cs = getCombatContext();
            return cs ? getAttackerTargetName(cs, playerStats.name) : undefined;
        })();
        const resistanceNotice = target ? getResistanceNotice([attack.damageType], target.resistances, target.immunities, target.name) : null;
        return {
            damageType: attack.damageType,
            resistanceNotice,
            targetName,
            saveDc: attack.saveDc,
            saveType: attack.saveType,
            dcSuccess: attack.saveSuccess,
            attackerName: playerStats.name,
            forcedMode: conditionAttackMode !== 'normal' ? conditionAttackMode : undefined,
            autoDamageFormula: attack.damage,
            autoDamageName: attack.name,
        };
    }, [getCombatTargetInfo, conditionAttackMode, playerStats.name]);

    const buildAttackContext = React.useCallback(async (attack) => {
        if (!mapName) {
            return buildAttackContextSync(attack);
        }

        const base = buildAttackContextSync(attack);

        try {
            const [mapData, npcs] = await Promise.all([
                mapsService.loadMapData(campaignName, mapName),
                loadNPCs(campaignName),
            ]);

            const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (attackerPlayer) {
                let targetPos = null;
                const cs = getCombatContext();
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

                const isRanged = attack.range > 5;
                const feats = featRangeEffects || { ignoresMeleeDisadvantage: false, ignoresLongRangeDisadvantage: false, rangeMultiplier: 1, spellRangeBonus: 0 };

                if (targetPos) {
                    const effectiveRange = isRanged ? attack.range + (feats.spellRangeBonus || 0) : attack.range;
                    const distanceFt = getDistanceFeet(
                        { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                        targetPos
                    );
                    const rangeResult = computeRangeEffect(effectiveRange, distanceFt, feats);
                    if (rangeResult.mode === 'disadvantage') {
                        base.forcedMode = 'disadvantage';
                        base.rangeReason = rangeResult.reason;
                    } else if (rangeResult.mode === 'miss') {
                        base.isAutoMiss = true;
                        base.rangeReason = rangeResult.reason;
                        base.forcedMode = undefined;
                    }
                }

                // Cover determination (ranged only - melee always has no cover)
                if (isRanged && !base.isAutoMiss && targetPos) {
                    const walls = mapData?.walls || new Set()
                    const coverResult = computeCover(
                        { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                        { gridX: targetPos.gridX, gridY: targetPos.gridY },
                        walls,
                        mapData?.placedItems || [],
                    )
                    if (coverResult.level === 'full') {
                        base.isAutoMiss = true
                        base.rangeReason = 'Target has full cover'
                    } else if (coverResult.acBonus > 0) {
                        base.coverAcBonus = coverResult.acBonus
                        base.coverLevel = coverResult.level
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
                    if (meleeResult.mode === 'disadvantage' && base.forcedMode !== 'disadvantage') {
                        base.forcedMode = 'disadvantage';
                        base.rangeReason = meleeResult.reason;
                    }
                }
            }
        } catch (e) { /* fallback, no range validation */ }

        return base;
    }, [buildAttackContextSync, campaignName, mapName, playerStats.name, featRangeEffects]);

    const handleDamageClick = (attack) => {
        const wasCrit = popupHtml?.isCrit;
        if (wasCrit && setPopupHtml) setPopupHtml(null);
        const result = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
        if (result) {
            if (!mapName) {
                rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, buildAttackContextSync(attack));
            } else {
                buildAttackContext(attack).then(ctx => {
                    rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, ctx);
                }).catch(() => { });
            }
        }
    };

    const handleAttackClick = React.useCallback((attack) => {
        if (cannotAct) return;
        if (!mapName) {
            const ctx = buildAttackContextSync(attack);
            rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, ctx);
        } else {
            buildAttackContext(attack).then(ctx => {
                rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, ctx);
            }).catch(() => { });
        }
    }, [cannotAct, mapName, buildAttackContextSync, buildAttackContext, rollAttack, exhaustionPenalty]);

    const MONK_KI_FEATURES = ['Flurry of Blows', 'Patient Defense', 'Step of the Wind', 'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind'];

    function getCombatSummary() {
        const stored = localStorage.getItem('combatSummary');
        if (!stored) return null;
        try { return JSON.parse(stored); } catch { return null; }
    }

    const handleMetamagicAction = () => {
        const name = playerStats.name;
        const currentSP = getCurrentSorceryPoints(name, getMaxSorceryPoints(playerStats));
        const lastEvent = getLastDamageEvent(name);
        const chaMod = getChaModifier(playerStats);

        if (lastEvent && lastEvent.rolls && lastEvent.damageFormula) {
            const parsed = parseExpression(lastEvent.damageFormula);
            if (!parsed) {
                setPopupHtml({
                    type: 'empowered_spell',
                    name: 'Metamagic - Empowered Spell',
                    currentSP,
                    lastEvent: null,
                    chaMod,
                    error: 'Could not parse damage formula',
                });
                return;
            }
            setPopupHtml({
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP,
                lastEvent,
                chaMod: Math.min(chaMod, parsed.count),
                formulaParsed: parsed,
            });
        } else {
            setPopupHtml({
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP,
                lastEvent: null,
                chaMod,
                error: lastEvent ? 'No dice roll data available' : 'No recent damage event found. Cast a spell that deals damage first.',
            });
        }
    };

    const handleEmpoweredReroll = (lastEvent, chaMod, campaignName) => {
        const parsed = parseExpression(lastEvent.damageFormula);
        if (!parsed) return;

        const name = playerStats.name;
        const currentSP = getCurrentSorceryPoints(name, getMaxSorceryPoints(playerStats));
        if (currentSP < 1) {
            setPopupHtml({
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP,
                lastEvent,
                chaMod,
                error: 'Not enough sorcery points. Empowered Spell costs 1 SP.',
            });
            return;
        }

        const { sides, modifier } = parsed;
        const originalRolls = lastEvent.rolls || [];

        // Reroll the lowest N dice where N = chaMod
        const rerollCount = Math.min(chaMod, originalRolls.length);
        const sortedWithIndex = originalRolls.map((r, i) => ({ value: r, index: i }))
            .sort((a, b) => a.value - b.value);
        const rerollIndices = new Set(sortedWithIndex.slice(0, rerollCount).map(x => x.index));

        const newRolls = originalRolls.map((r, i) => rerollIndices.has(i) ? Math.floor(Math.random() * sides) + 1 : r);
        const newTotal = newRolls.reduce((sum, r) => sum + r, 0) + modifier;
        const damageDifference = newTotal - lastEvent.rawDamage;

        const combatSummary = getCombatSummary();
        if (!combatSummary || !lastEvent.targetName) {
            setPopupHtml({
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP,
                lastEvent,
                chaMod,
                error: 'No combat summary found. Cannot reapply damage.',
            });
            return;
        }

        // Deduct SP
        spendSorceryPoints(name, 1, campaignName);

        // Apply damage difference — positive means more damage, negative means less
        if (damageDifference !== 0) {
            const applyResult = applyDamageToTarget(combatSummary, lastEvent.targetName, damageDifference, lastEvent.damageType ? [lastEvent.damageType] : [], campaignName);
            addEntry(campaignName, {
                type: 'metamagic',
                characterName: name,
                rollType: 'empowered-spell',
                spellName: lastEvent.spellName,
                originalDamage: lastEvent.rawDamage,
                newTotal,
                damageDifference,
                targetName: lastEvent.targetName,
                rerolledDiceCount: rerollCount,
                originalDice: originalRolls,
                newDice: newRolls,
            });
            setPopupHtml({
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP: currentSP - 1,
                lastEvent: {
                    ...lastEvent,
                    rawDamage: newTotal,
                    rolls: newRolls,
                },
                chaMod,
                result: {
                    oldTotal: lastEvent.rawDamage,
                    newTotal,
                    damageDifference,
                    rerollCount,
                    rerolledDice: rerollIndices,
                    originalDice: originalRolls,
                    newDice: newRolls,
                    targetCurrentHp: applyResult?.newHp,
                },
                completed: true,
            });
        } else {
            // No change in damage, SP still spent
            setPopupHtml({
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP: currentSP - 1,
                lastEvent: {
                    ...lastEvent,
                    rolls: newRolls,
                },
                chaMod,
                result: {
                    oldTotal: lastEvent.rawDamage,
                    newTotal,
                    damageDifference: 0,
                    rerollCount,
                    message: 'Reroll did not change the damage total.',
                },
                completed: true,
            });
        }

        // Update saved event for potential subsequent rerolls
        saveLastDamageEvent(name, {
            ...lastEvent,
            rawDamage: newTotal,
            rolls: newRolls,
            timestamp: Date.now(),
        }, campaignName);
    };

    const handleAutomationAction = async (action) => {
        if (cannotAct) return;
        const auto = action.automation;
        if (!auto) return;

        // Spend 1 focus point for monk Ki features
        if (MONK_KI_FEATURES.includes(action.name)) {
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const maxFP = classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
            const storedFP = getRuntimeValue(playerStats.name, 'focusPoints', campaignName);
            // If not yet stored, current equals max (same init logic as TrackedResourceInput)
            const currentFP = storedFP != null ? Number(storedFP) : maxFP;
            if (currentFP <= 0) {
                setPopupHtml(`<b>${action.name}</b><br/>No ${playerStats.rules === '2024' ? "Focus Points" : 'ki points'} remaining.`);
                return;
            }
            await setRuntimeValue(playerStats.name, 'focusPoints', currentFP - 1, campaignName);

            // Notify other components that focus points changed
            window.dispatchEvent(new CustomEvent('focus-points-updated'));

            // Log the ability use and focus point consumption
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: action.name,
                description: `${action.name} activated`,
                focusPointsSpent: 1,
                remainingFocusPoints: currentFP - 1
            }).catch(() => { });

            // Show activation confirmation
            setPopupHtml(`<b>${action.name}</b><br/>${playerStats.rules === '2024' ? 'Focus Point' : 'Ki point'} spent. ${currentFP - 1} remaining.`);
            return;
        }

        switch (auto.type) {
            case 'save_attack': {
                const damageResult = rollExpression(auto.damage);
                if (damageResult) {
                    const dcSuccess = auto.shape === 'cone' ? 0.5 : 0;
                    // Resolve save DC: "ability" means 8 + CON mod + proficiency
                    let saveDc;
                    if (auto.saveDc === 'ability') {
                        const conBonus = playerStats.abilities?.find(a => a.name === 'CON')?.bonus || 0;
                        const prof = playerStats.proficiency || 0;
                        saveDc = 8 + conBonus + prof;
                    } else {
                        saveDc = auto.saveDc || 10;
                    }
                    const ctx = buildAttackContextSync({
                        name: action.name,
                        damage: auto.damage,
                        damageType: auto.damageType || '',
                        saveDc,
                        saveType: auto.saveType || 'DEX',
                        saveSuccess: dcSuccess,
                    });
                    rollDamage(action.name, auto.damage, damageResult.total, damageResult.rolls, damageResult.modifier, ctx);
                }
                break;
            }
            case 'healing':
            case 'self_healing': {
                const healAmount = auto.healAmount || auto.healExpression;
                if (setPopupHtml) {
                    setPopupHtml({
                        type: 'healing',
                        name: action.name,
                        healAmount: typeof healAmount === 'number' ? healAmount : auto.healExpression,
                        description: `${action.name}: Restores ${auto.healExpression} HP`,
                    });
                }
                break;
            }
            case 'healing_pool': {
                setHealingPoolModal({
                    name: action.name,
                    pool: auto.pool,
                    resourceKey: auto.resourceKey,
                    alsoCures: auto.alsoCures || [],
                    cureCost: auto.cureCost || 5,
                });
                break;
            }
            case 'free_spell': {
                const spellName = auto.spell || action.name;
                let spellData = (playerStats.spellAbilities?.spells || []).find(s => s.name === spellName);
                if (!spellData) {
                    try {
                        const spellsUrl = playerStats.rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json';
                        const response = await fetch(spellsUrl);
                        const allSpells = await response.json();
                        spellData = allSpells.find(s => s.name === spellName);
                    } catch (e) {
                        // Fetch failed, fall through to description popup
                    }
                }
                if (spellData?.damage) {
                    const slotDmg = spellData.damage.damage_at_slot_level;
                    const formula = slotDmg?.[Object.keys(slotDmg)[0]];
                    if (formula) {
                        const result = rollExpression(formula);
                        if (result) {
                            const target = getCombatTargetInfo();
                            rollDamage(spellName, formula, result.total, result.rolls, result.modifier, {
                                damageType: spellData.damage.damage_type || 'Radiant',
                                targetName: target?.name,
                                attackerName: playerStats.name,
                            });
                            break;
                        }
                    }
                }
                if (setPopupHtml) {
                    const usesInfo = auto.uses ? ` (${auto.uses}/long rest)` : '';
                    setPopupHtml(`<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Free cast of:</b> ${spellName}${usesInfo}`);
                }
                break;
            }
            case 'temp_buff': {
                const activeBuffsKey = 'activeBuffs';
                const stored = getRuntimeValue(playerStats.name, activeBuffsKey, campaignName);
                const activeBuffs = Array.isArray(stored) ? stored : [];
                const isActive = activeBuffs.some(b => b.name === action.name);
                const newBuffs = isActive ? activeBuffs.filter(b => b.name !== action.name) : [...activeBuffs, { name: action.name, effect: auto.effect, duration: auto.duration }];
                setRuntimeValue(playerStats.name, activeBuffsKey, newBuffs, campaignName);
                if (onBuffsChange) onBuffsChange();
                if (setPopupHtml) {
                    setPopupHtml({
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: isActive ? `${action.name} toggled OFF` : `${action.name} activated (${auto.duration || '10 min'})`,
                        automation: auto,
                    });
                }
                break;
            }
            case 'temp_hp_buff': {
                // Temp HP doesn't modify speed display, just show info popup
                if (setPopupHtml) {
                    const result = rollExpression(auto.buffExpression || '');
                    let desc = `${action.name}: ${auto.buffExpression} temp HP`;
                    if (result) desc += ` (${result.total})`;
                    setPopupHtml({
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: desc,
                        automation: auto,
                    });
                }
                break;
            }
            case 'extra_action':
            case 'bonus_attacks':
            case 'bonus_action_attack':
            case 'damage_aura':
            case 'combat_stance':
            case 'resource_pool':
            case 'attack_rider':
            case 'damage_bonus': {
                if (setPopupHtml) {
                    setPopupHtml({
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: action.description || '',
                        automation: auto,
                    });
                }
                break;
            }
            case 'spell_modifier': {
                if (action.name === 'Metamagic') {
                    handleMetamagicAction();
                } else if (setPopupHtml) {
                    setPopupHtml({
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: action.description || '',
                        automation: auto,
                    });
                }
                break;
            }
            case 'font_of_magic': {
                setFontOfMagicModal(true);
                break;
            }
            case 'initiative_action': {
                if (auto.effect === 'regain_focus_points_and_heal') {

                    // Check use tracking against long-rest limit
                    const resourceKey = auto.resourceKey || action.name.toLowerCase().replace(/\s+/g, '') + 'Uses';
                    const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? 0);
                    if (usesUsed >= (auto.usesMax || auto.uses || 1)) {
                        if (setPopupHtml) {
                            setPopupHtml({
                                type: 'automation_info',
                                name: action.name,
                                automationType: auto.type,
                                description: `${action.name} has been used and cannot be used again until a long rest.` +
                                    (auto.recharge === 'long_rest' ? '' : ` Recharges on ${auto.recharge || 'short rest'}.`),
                            });
                        }
                        return;
                    }

                    // Get martial arts die from class data
                    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                    const martialArtsDie = classLevel?.martial_arts_die || 4;
                    const monkLevel = playerStats.level;

                    // Roll the martial arts die
                    const rollResult = rollExpression(`${martialArtsDie}d1`);
                    if (!rollResult) return;

                    const healAmount = monkLevel + rollResult.total;

                    // Get current HP from storage
                    const currentHp = Number(getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName)) || 0;
                    const maxHp = playerStats.hitPoints;
                    const newHp = Math.min(maxHp, currentHp + healAmount);

                    // Update HP in storage (triggers SSE broadcast to other clients)
                    setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);

                    // Also update combat summary if in combat
                    const combatSummary = (() => {
                        try {
                            const cs = getCombatContext();
                            return cs;
                        } catch (e) { return null; }
                    })();
                    if (combatSummary) {
                        const creature = combatSummary.creatures.find(c => c.name === playerStats.name || c.name.startsWith(playerStats.name + ' '));
                        if (creature) {
                            creature.currentHp = newHp;
                            storage.set('combatSummary', combatSummary, campaignName);
                        }
                    }

                    // Increment use count
                    const newUsesUsed = usesUsed + 1;
                    setRuntimeValue(playerStats.name, resourceKey, newUsesUsed, campaignName);

                    // Log to campaign log as a healing entry with source name
                    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'hp_change',
                            targetName: playerStats.name,
                            sourceName: action.name,
                            delta: newHp - currentHp,
                            currentHp: newHp,
                            maxHp,
                            isHealing: true,
                            isUnconscious: false,
                        }),
                    }).catch(() => { });

                    // Also dispatch combat-summary-updated for local sync
                    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

                    // Show popup with roll result and healing info
                    if (setPopupHtml) {
                        setPopupHtml({
                            type: 'healing',
                            name: action.name,
                            formula: `${martialArtsDie}d1 + ${monkLevel}`,
                            rolls: rollResult.rolls,
                            bonus: monkLevel,
                            modifier: 0,
                            healAmount: healAmount,
                            description: `${action.name}: Rolled ${rollResult.total} (${martialArtsDie}d1) + ${monkLevel} (Monk level) = <strong>${healAmount}</strong> HP`,
                            targetName: playerStats.name,
                            targetCurrentHp: newHp,
                            targetMaxHp: maxHp,
                            damageApplied: true,
                        });
                    }
                } else {
                    if (setPopupHtml) {
                        setPopupHtml({
                            type: 'automation_info',
                            name: action.name,
                            automationType: auto.type,
                            description: action.description || '',
                            automation: auto,
                        });
                    }
                    break;
                }
                break;
            }
            default:
                break;
        }
    };
    const getWeaponMastery = (weaponName) => {
        if (playerStats.rules !== '2024') {
            return null;
        }

        // Remove magic prefix if present
        const nonMagicalName = parseMagicItemName(weaponName).baseName;

        // Find the weapon in equipment
        const weapon = playerStats.equipment?.find(item => item.name === nonMagicalName);
        if (weapon && weapon.equipment_category === 'Weapon') {
            return weapon.mastery;
        }
        return null;
    };

    const actionCastingTimes = ['1 action', '1 Action', 'action', 'Action'];
    const actionAttackNames = new Set(playerStats.attacks?.filter(a => a.type === 'Action').map(a => a.name) || []);
    const actionSpells = playerStats.spellAbilities?.spells?.filter(spell =>
        actionCastingTimes.includes(spell.casting_time) &&
        (spell.prepared === 'Always' || spell.prepared === 'Prepared') &&
        !actionAttackNames.has(spell.name)
    ) || [];
    const actionSpellNames = actionSpells.reduce((acc, spell) => { acc[spell.name] = spell; return acc; }, {});

    const handleActionSpellClick = (spellName) => {
        const spell = actionSpellNames[spellName];
        if (!spell) return;
        setSelectedActionSpell(spell);
    };

    const actionCastAction = React.useCallback((spell, metaCtx) => {
        executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getCombatTargetInfo });
    }, [rollAttack, rollDamage, playerStats, getCombatTargetInfo]);
    const { pendingMetamagic: actionPendingMetamagic, gateMetamagic: actionGateMetamagic, handleConfirm: actionHandleConfirm, handleSkip: actionHandleSkip } = useSpellMetamagicFlow(playerStats, campaignName, actionCastAction);
    const handleActionSpellCast = React.useCallback((spell) => {
        setSelectedActionSpell(null);
        actionGateMetamagic(spell);
    }, [actionGateMetamagic]);

    const isBonusSorcerer = playerStats.class?.name === 'Sorcerer';

    const is2024Rules = playerStats.rules === '2024';

    // Action spell (save-based) damage click - gate through metamagic for sorcerers
    const handleActionSpellDamageClick = (attack) => {
        if (!isBonusSorcerer) {
            addEntry(campaignName, {
                type: 'spell',
                characterName: playerStats.name,
                spellName: attack.name,
                spellLevel: attack.spellLevel || 0,
                castingTime: attack.castingTime || 'Action',
                metamagic: [],
                spCost: 0,
                timestamp: Date.now(),
            });
            // Roll damage directly
            const wasCrit = popupHtml?.isCrit;
            if (wasCrit && setPopupHtml) setPopupHtml(null);
            const result = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
            if (!result) return;

            if (!mapName) {
                rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, buildAttackContextSync(attack));
            } else {
                buildAttackContext(attack).then(ctx => {
                    rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, ctx);
                }).catch(() => { });
            }
            return;
        }

        // Sorcerer - show metamagic popup
        setActionSpellPendingMetamagic({
            attack,
            spellLevel: attack.spellLevel || 0,
            castingTime: attack.castingTime || 'Action',
            damageFormula: attack.damage,
        });
    };

    const handleActionSpellDamageConfirm = React.useCallback((result) => {
        const pending = actionSpellPendingMetamagic;
        if (!pending || !pending.attack) {
            setActionSpellPendingMetamagic(null);
            return;
        }
        if (result && result.totalCost && result.totalCost > 0) {
            spendSorceryPoints(playerStats.name, result.totalCost, campaignName);
        }

        const attack = pending.attack;
        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: attack.name,
            spellLevel: pending.spellLevel || 0,
            castingTime: pending.castingTime,
            metamagic: result ? (result.options || []) : [],
            spCost: result ? (result.totalCost || 0) : 0,
            timestamp: Date.now(),
        });

        // Roll damage after metamagic selected
        const wasCrit = popupHtml?.isCrit;
        if (wasCrit && setPopupHtml) setPopupHtml(null);
        const r = wasCrit ? rollExpressionDoubled(pending.damageFormula) : rollExpression(pending.damageFormula);
        if (!r) { setActionSpellPendingMetamagic(null); return; }

        if (!mapName) {
            rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, buildAttackContextSync(attack));
        } else {
            buildAttackContext(attack).then(ctx => {
                rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, ctx);
            }).catch(() => { });
        }

        setActionSpellPendingMetamagic(null);
    }, [playerStats.name, campaignName, mapName, actionSpellPendingMetamagic]);

    const handleActionSpellDamageSkip = React.useCallback(() => {
        const pending = actionSpellPendingMetamagic;
        if (!pending || !pending.attack) {
            setActionSpellPendingMetamagic(null);
            return;
        }

        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: pending.attack.name,
            spellLevel: pending.spellLevel || 0,
            castingTime: pending.castingTime,
            metamagic: [],
            spCost: 0,
            timestamp: Date.now(),
        });

        const wasCrit = popupHtml?.isCrit;
        if (wasCrit && setPopupHtml) setPopupHtml(null);
        const r = wasCrit ? rollExpressionDoubled(pending.damageFormula) : rollExpression(pending.damageFormula);
        if (!r) { setActionSpellPendingMetamagic(null); return; }

        if (!mapName) {
            rollDamage(pending.attack.name, pending.damageFormula, r.total, r.rolls, r.modifier, buildAttackContextSync(pending.attack));
        } else {
            buildAttackContext(pending.attack).then(ctx => {
                rollDamage(pending.attack.name, pending.damageFormula, r.total, r.rolls, r.modifier, ctx);
            }).catch(() => { });
        }

        setActionSpellPendingMetamagic(null);
      }, [playerStats.name, campaignName, mapName, actionSpellPendingMetamagic]);

    return (
        <div className="char-actions">
            <div>
                <span className='sectionHeader'>Actions</span>
                {cannotAct && <span className='disabled-attack-label'>(Incapacitated)</span>}
                <div className={`attacks ${is2024Rules ? 'mastery-enabled' : ''}`}>
                    <div className='left'><b>Name</b></div>
                    <div><b>Range</b></div>
                    <div><b>Hit</b></div>
                    <div><b>Damage</b></div>
                    <div className='left'><b>Type</b></div>
                    {is2024Rules && <div><b>Mastery</b></div>}
                    {playerStats.attacks.map((attack) => {
                        if (attack.type != 'Action') return '';
                        return <React.Fragment key={attack.name}>
                            <div className='left clickable' onClick={() => attack.saveDc ? handleActionSpellClick(attack.name) : undefined}>{attack.name}</div>
                            <div>{attack.range} ft.</div>
                            {attack.saveDc
                                ? <div className="save-dc-display">DC {attack.saveDc} {attack.saveType}</div>
                                : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => handleAttackClick(attack)}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                            <div className={attack.damage ? "clickable" : ""} onClick={() => !cannotAct && attack.saveDc ? handleActionSpellDamageClick(attack) : handleDamageClick(attack)}>{attack.damage}</div>

                            <div className='left'>{attack.damageType}</div>
                            {is2024Rules && <div className={getWeaponMastery(attack.name) ? "clickable" : ""} onClick={() => { const mastery = getWeaponMastery(attack.name); if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{getWeaponMastery(attack.name) || ''}</div>}
                        </React.Fragment>;
                    })}
                    {actionSpells.map((spell) => {
                        return <React.Fragment key={spell.name}>
                            <div className='left clickable' onClick={() => handleActionSpellClick(spell.name)}>{spell.name}</div>
                            <div>{spell.range}</div>
                            <div>-</div>
                            <div>Utility</div>
                            <div className='left'></div>
                            {is2024Rules && <div></div>}
                        </React.Fragment>;
                    })}
                </div>
                <div className='half-line'></div>
                {popupHtml && (
                    <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                        {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> :
                            popupHtml.type === 'automation_info' ? <div className="dice-roll-result"><div className="dice-roll-header"><i className="fa-solid fa-info-circle"></i>{popupHtml.name}</div><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.description) }}></div><div className="dice-roll-hint">click to dismiss</div></div> :
                                popupHtml.type === 'empowered_spell' ? <div className="dice-roll-result">
                                    <div className="dice-roll-header"><i className="fa-solid fa-wand-magic-sparkles"></i>{popupHtml.name}</div>
                                    <div className="metamagic-sp-display">Sorcery Points: <strong>{popupHtml.currentSP}</strong> / {popupHtml.lastEvent ? popupHtml.lastEvent.maxSP : '?'}</div>
                                    {popupHtml.error && <div className="empowered-error" style={{ color: 'var(--stat-penalized, #cc4444)', marginTop: '8px' }}>{popupHtml.error}</div>}
                                    {popupHtml.lastEvent && !popupHtml.completed && popupHtml.lastEvent.rolls && (
                                        <div className="empowered-damage-info" style={{ marginTop: '8px' }}>
                                            <div><strong>Spell:</strong> {popupHtml.lastEvent.spellName}</div>
                                            <div><strong>Target:</strong> {popupHtml.lastEvent.targetName}</div>
                                            <div><strong>Formula:</strong> {popupHtml.lastEvent.damageFormula}</div>
                                            <div><strong>Original Damage:</strong> {popupHtml.lastEvent.rawDamage}</div>
                                            <div><strong>CHA Modifier:</strong> {popupHtml.chaMod} — can reroll up to {popupHtml.chaMod} dice</div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                                <button className="btn btn-primary" onClick={() => handleEmpoweredReroll(popupHtml.lastEvent, popupHtml.chaMod, campaignName)} style={{ padding: '4px 12px', cursor: 'pointer' }}>
                                                    <i className="fa-solid fa-dice"></i> Reroll (1 SP)
                                                </button>
                                                <button className="btn btn-secondary" onClick={() => setPopupHtml && setPopupHtml(null)} style={{ padding: '4px 12px', cursor: 'pointer' }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {popupHtml.completed && popupHtml.result && (
                                        <div className="empowered-result" style={{ marginTop: '8px' }}>
                                            <hr />
                                            {popupHtml.result.message ? (
                                                <div>{popupHtml.result.message}</div>
                                            ) : (
                                                <>
                                                    <div><strong>Original Damage:</strong> {popupHtml.result.oldTotal}</div>
                                                    <div><strong>New Damage:</strong> {popupHtml.result.newTotal}</div>
                                                    <div><strong>Difference:</strong> {popupHtml.result.damageDifference > 0 ? '+' : ''}{popupHtml.result.damageDifference}</div>
                                                    <div><strong>Dice Rerolled:</strong> {popupHtml.result.rerollCount}</div>
                                                    <div style={{ fontSize: '0.85em', marginTop: '4px' }}>
                                                        Original dice: ({popupHtml.result.originalDice.join(', ')})<br />
                                                        New dice: ({popupHtml.result.newDice.join(', ')})
                                                    </div>
                                                    {popupHtml.result.targetCurrentHp != null && (
                                                        <div style={{ marginTop: '4px' }}><strong>Target HP:</strong> {popupHtml.result.targetCurrentHp}</div>
                                                    )}
                                                </>
                                            )}
                                            <div style={{ marginTop: '8px', color: 'var(--stat-penalized, #cc4444)' }}>Spent 1 Sorcery Point</div>
                                            <div className="dice-roll-hint" style={{ marginTop: '4px' }}>click to dismiss</div>
                                        </div>
                                    )}
                                    {!popupHtml.lastEvent && !popupHtml.error && (
                                        <div className="empowered-no-event" style={{ marginTop: '8px' }}>
                                            No recent damage event found. Cast a spell that deals damage first.
                                        </div>
                                    )}
                                    {popupHtml.lastEvent && !popupHtml.lastEvent.rolls && !popupHtml.completed && (
                                        <div className="dice-roll-hint" style={{ marginTop: '8px' }}>click to dismiss</div>
                                    )}
                                </div> :
                                    <DiceRollResult {...popupHtml} onQuickRoll={popupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined} />}
                    </Popup>
                )}
                {healingPoolModal && (
                    <HealingPoolModal
                        playerStats={playerStats}
                        campaignName={campaignName}
                        poolMax={healingPoolModal.pool}
                        poolExpression={healingPoolModal.poolExpression}
                        alsoCures={healingPoolModal.alsoCures}
                        cureCost={healingPoolModal.cureCost}
                        onClose={() => setHealingPoolModal(null)}
                    />
                )}
                {fontOfMagicModal && (
                    <FontOfMagicModal
                        playerStats={playerStats}
                        campaignName={campaignName}
                        onClose={() => setFontOfMagicModal(null)}
                    />
                )}
                {selectedActionSpell && (
                    <Popup onClickOrKeyDown={() => setSelectedActionSpell(null)}>
                        <SpellDetailPopup
                            spell={selectedActionSpell}
                            playerStats={playerStats}
                            campaignName={campaignName}
                            onClose={() => setSelectedActionSpell(null)}
                            onCast={handleActionSpellCast}
                        />
                    </Popup>
                )}
                {actionPendingMetamagic && (
                    <MetamagicPopup
                        spell={{ name: actionPendingMetamagic.spellName, level: actionPendingMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: actionPendingMetamagic._currentSP }}
                        campaignName={campaignName}
                        onConfirm={actionHandleConfirm}
                        onSkip={actionHandleSkip}
                    />
                )}
                {playerStats.actions.map((action) => {
                    const isClickable = action.details || hasAutomation(action);
                    const handleClick = () => {
                        if (hasAutomation(action)) {
                            handleAutomationAction(action);
                        } else {
                            setPopupHtml(buildFeatureDetailHtml(action));
                        }
                    };
                    return <div key={action.name}>
                        <b className={isClickable ? "clickable" : ""} onClick={handleClick}>{action.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }}></span>
                        {hasAutomation(action) && action.automation?.type === 'save_attack' && action.automation?.saveDc && <span className="automation-badge"> DC {action.automation.saveDc} {action.automation.saveType}</span>}
                        {hasAutomation(action) && action.automation?.type === 'healing_pool' && <span className="automation-badge"> Pool: {action.automation.pool} HP</span>}
                        {hasAutomation(action) && action.automation?.damage && <span className="automation-badge"> {action.automation.damage} {action.automation.damageType}</span>}
                    </div>
                })}
                <div><b>Base Actions:</b> {actions.join(', ')}</div>
            </div>
              <CharBonusActions
                  playerStats={playerStats}
                  campaignName={campaignName}
                  exhaustionPenalty={exhaustionPenalty}
                  conditionAttackMode={conditionAttackMode}
                  cannotAct={cannotAct}
                  mapName={mapName}
                  onAttackClick={handleAttackClick}
                  onDamageClick={handleDamageClick}
                  onAutomationAction={handleAutomationAction}
                  getWeaponMastery={getWeaponMastery}
                  rollAttack={rollAttack}
                  rollDamage={rollDamage}
                  getCombatTargetInfo={getCombatTargetInfo}
              />
          </div>
      )
}, areEqual);

export default CharActions