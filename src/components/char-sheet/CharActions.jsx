
import React, { useState, useEffect, useRef } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import MetamagicPopup from './MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import EmpoweredSpellPopup from './EmpoweredSpellPopup.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { parseMagicItemName } from '../../services/rules/attackCalc.js';
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import { useSpellUpcastFlow } from '../../hooks/useSpellUpcastFlow.js'
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { computeFeatRangeEffects } from '../../services/character/featRangeService.js';
import { hasAutomation, collectWeaponMastery, evaluateAutoExpression } from '../../services/combat/automationService.js'
import { isExhausted } from '../../services/automation/handlers/saveAttackHandler.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import utils from '../../services/ui/utils.js'
import HealingPoolModal from './HealingPoolModal.jsx'
import HandOfHealingModal from './HandOfHealingModal.jsx'
import FontOfMagicModal from './FontOfMagicModal.jsx'
import SetConditionModal from './SetConditionModal.jsx'
import DivineSparkModal from './DivineSparkModal.jsx'
import DivineInterventionModal from './DivineInterventionModal.jsx'
import AttackRiderModal from './AttackRiderModal.jsx'
import WeaponMasteryModal from './WeaponMasteryModal.jsx'
import CombatStanceModal from './CombatStanceModal.jsx'
import TeleportModal from './TeleportModal.jsx'
import CharBonusActions from './CharBonusActions.jsx'
import { executeHandler } from '../../services/automation/index.js';
import { onSpellSelected as onDivineInterventionSpellSelected } from '../../services/automation/handlers/divineInterventionHandler.js';
import { getClassFeatures } from '../../services/character/classFeatures.js';
import { addEntry } from '../../services/ui/logService.js';
import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js'
import { executeSpellCast } from '../../services/rules/spellCastService.js'
import { getTargetFromAttacker, getCombatContext } from '../../services/rules/damageUtils.js';
import { getNearestPlacedItem } from '../../services/rules/rangeValidation.js';
import { getInnateSorceryBonus } from '../../services/combat/buffService.js';
import { buildAttackContext, buildAttackContextSync } from '../../services/automation/contextBuilder.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { buildEmpoweredSpellState, executeEmpoweredReroll, getEmpoweredSpellDescription } from '../../services/rules/empoweredSpellService.js';
import { useActionSpellMetamagic } from '../../hooks/useActionSpellMetamagic.js';
import './CharActions.css'
import { isEqual } from 'lodash';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats) && prevProps.conditionAttackMode === nextProps.conditionAttackMode && prevProps.exhaustionPenalty === nextProps.exhaustionPenalty && prevProps.cannotAct === nextProps.cannotAct;

const CharActions = React.memo(function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, onBuffsChange, characters }) {
    const [actions, setActions] = useState([]);
    const [selectedActionSpell, setSelectedActionSpell] = useState(null);
    const [featRangeEffects, setFeatRangeEffects] = useState(null);
    const [healingPoolModal, setHealingPoolModal] = useState(null);
    const [handOfHealingModal, setHandOfHealingModal] = useState(null);
    const [fontOfMagicModal, setFontOfMagicModal] = useState(null);
    const [setConditionModal, setSetConditionModal] = useState(null);
    const [attackRiderModal, setAttackRiderModal] = useState(null);
    const [weaponMasteryModal, setWeaponMasteryModal] = useState(null);
    const [combatStanceModal, setCombatStanceModal] = useState(null);
    const [teleportModal, setTeleportModal] = useState(null);
    const [divineSparkModal, setDivineSparkModal] = useState(null);
    const [divineInterventionModal, setDivineInterventionModal] = useState(null);
    const [divineInterventionAction, setDivineInterventionAction] = useState(null);
    const [divineFuryChoice, setDivineFuryChoice] = useState(null);
    const [damageTypeChoice, setDamageTypeChoice] = useState(null);
    const [featureChoice, setFeatureChoice] = useState(null);
    const { saveDcBonus: displaySaveDcBonus } = getInnateSorceryBonus(playerStats.name, campaignName);

    useEffect(() => {
        computeFeatRangeEffects(playerStats.feats, playerStats.rules, playerStats).then(setFeatRangeEffects).catch(() => { });
    }, [playerStats.feats, playerStats.rules, playerStats]);

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

            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const maxFP = classLevel?.focus_points || getRuntimeValue(playerStats.name, 'focusPoints', campaignName) || 0;
            if (!maxFP) return;

            const currentFP = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? 0);
            if (currentFP >= maxFP) return;

            setRuntimeValue(playerStats.name, 'focusPoints', maxFP, campaignName);
        };

        window.addEventListener('initiative-rolled', handleInitiativeRolled);

        return () => {
            window.removeEventListener('initiative-rolled', handleInitiativeRolled);
        };
    }, [playerStats, campaignName]);
    const { popupHtml, setPopupHtml, rollAttack, rollDamage, quickRollPlayerSave } = useLoggedDiceRoll(playerStats.name, campaignName, {
        characters,
        autoDamageRoll: (autoDamage, isCrit) => {
            const result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
            if (result) {
                const context = {
                    damageType: autoDamage.damageType,
                    targetName: autoDamage.targetName,
                    attackerName: autoDamage.attackerName,
                    saveDc: autoDamage.saveDc,
                    saveType: autoDamage.saveType,
                    dcSuccess: autoDamage.dcSuccess,
                };
                if (autoDamage.metamagicTwinTarget) {
                    context.metamagicTwinTarget = autoDamage.metamagicTwinTarget;
                }
                if (autoDamage.metamagicHeighten) {
                    context.metamagicHeighten = autoDamage.metamagicHeighten;
                }
                rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, context);
            }
        },
    });

    // Apply Searing Undead Radiant damage when Turn Undead resolves
    useEffect(() => {
        const handleTurnUndeadResult = (e) => {
            if (!playerStats || !e.detail) return;
            const { failedTargets, attackerName, campaignName: eventCampaign } = e.detail;
            if (attackerName !== playerStats.name) return;
            if (campaignName !== eventCampaign) return;

            const searingUndead = playerStats.automation?.actions?.find(
                a => a.type === 'damage_bonus' && a.trigger === 'turn_undead_fail'
            );
            if (!searingUndead) return;

            const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
            const wisMod = Math.max(1, wis?.bonus || 0);
            const expr = `${wisMod}d8`;
            const result = rollExpression(expr);
            if (!result) return;

            const baseContext = {
                damageType: searingUndead.damageType || 'Radiant',
                attackerName: playerStats.name,
                saveDc: e.detail.saveDc,
                saveType: e.detail.saveType,
                dcSuccess: false,
            };

            for (const targetName of failedTargets) {
                rollDamage(
                    searingUndead.name,
                    expr,
                    result.total,
                    result.rolls,
                    result.modifier,
                    { ...baseContext, targetName }
                );
            }
        };

        window.addEventListener('turn-undead-result', handleTurnUndeadResult);
        return () => window.removeEventListener('turn-undead-result', handleTurnUndeadResult);
    }, [playerStats, campaignName, rollDamage]);

    const getTargetInfo = React.useCallback(async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, playerStats.name);
        if (!target) return null;
        return target;
    }, [playerStats.name, campaignName]);

    const buildCtxSync = React.useCallback(async (attack) => {
        return await buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects || null);
     }, [playerStats, campaignName, conditionAttackMode, featRangeEffects]);

    const buildCtx = React.useCallback(async (attack) => {
        return await buildAttackContext(attack, playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects || null);
    }, [playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects]);

    const pendingDamageRef = useRef(null);

    const proceedWithDamage = (attack, formula, total, rolls, modifier) => {
        (mapName ? buildCtx(attack) : buildCtxSync(attack)).then(ctx => {
            rollDamage(attack.name, formula, total, rolls, modifier, ctx);
        }).catch(() => { });
    };

    const handleDamageClick = (attack) => {
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
            const weaponHitBonuses = playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'weapon_attack_hit'
            );
            // Deduplicate: skip features that are upgraded by a higher-level feature
            const upgradedNames = new Set(weaponHitBonuses.filter(b => b.upgrades).map(b => b.upgrades));
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

    const handleFeatureChoiceConfirm = (chosenOption) => {
        if (!featureChoice) return;
        const { action, optionKey } = featureChoice;
        setRuntimeValue(playerStats.name, optionKey, chosenOption, campaignName);
        setFeatureChoice(null);
        setPopupHtml(`<b>${action.name}</b><br/>Option chosen: <b>${chosenOption}</b>. This choice can be changed by clicking the feature again.`);
    };

    const handleFeatureChoiceSkip = () => {
        setFeatureChoice(null);
    };

    const handleAttackClick = React.useCallback((attack) => {
        if (cannotAct) return;
         buildCtx(attack).then(ctx => {
             rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, ctx);
          }).catch(() => { });
      }, [cannotAct, buildCtx, rollAttack, exhaustionPenalty]);

    const {
        pendingActionMetamagic,
        handleActionMetamagicConfirm,
        handleActionMetamagicSkip,
        handleActionSpellDamageClick,
        handleSpellAttackClick,
        handleSpellDamageClick,
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
        handleDamageClick,
    });

    const MONK_KI_FEATURES = ['Flurry of Blows', 'Patient Defense', 'Step of the Wind', 'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind', 'Hand of Healing', 'Stunning Strike'];

    async function handleAutomationAction(action) {
        if (cannotAct) return;

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

         // Spend 1 focus point for monk Ki features before dispatching
        if (MONK_KI_FEATURES.includes(action.name)) {
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

        const result = await executeHandler(action, playerStats, campaignName, mapName);
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
                    case 'setCondition': setSetConditionModal(result.payload); break;
                    case 'attackRider': setAttackRiderModal(result.payload); break;
                    case 'combatStance': setCombatStanceModal(result.payload); break;
                    case 'teleport': setTeleportModal(result.payload); break;
                    case 'divineSpark': setDivineSparkModal(result.payload); break;
                    case 'divineIntervention':
                        setDivineInterventionAction(action);
                        setDivineInterventionModal(result.payload);
                        break;
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
            result.logEntries.forEach(entry => addEntry(campaignName, entry).catch(() => {}));
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
            });

            setPopupHtml({
                type: 'automation_info',
                name: result.name,
                description: `Divine Intervention cast ${spell.name}. Divine Intervention recharges ${result.rechargeMessage}`,
            });
        }
    }, [divineInterventionAction, playerStats, campaignName, rollAttack, rollDamage, mapName, setPopupHtml]);

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

    const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

    const actionCastingTimes = ['1 action', '1 Action', 'action', 'Action'];
    const actionAttackNames = new Set(playerStats.attacks?.filter(a => a.type === 'Action').map(a => a.name) || []);
    const actionSpells = playerStats.spellAbilities?.spells?.filter(spell =>
        actionCastingTimes.includes(spell.casting_time) &&
        (spell.prepared === 'Always' || spell.prepared === 'Prepared') &&
        !actionAttackNames.has(spell.name) &&
        spell.damage
    ) || [];
    const actionSpellNames = actionSpells.reduce((acc, spell) => { acc[spell.name] = spell; return acc; }, {});

    const handleActionSpellClick = (spellName) => {
        let spell = actionSpellNames[spellName];
        if (!spell) {
            spell = playerStats.spellAbilities?.spells?.find(s => s.name === spellName);
        }
        if (!spell) return;
        setSelectedActionSpell(spell);
    };

    const cachedActionCastPosRef = React.useRef(null);

    const actionCastAction = React.useCallback((spell, metaCtx) => {
        const pos = cachedActionCastPosRef.current;
        executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos: pos?.attackerPos, targetPos: pos?.targetPos, featEffects: featRangeEffects, campaignName, mapName });
        cachedActionCastPosRef.current = null;
    }, [rollAttack, rollDamage, playerStats, getTargetInfo, featRangeEffects, campaignName, mapName]);
    const { pendingMetamagic: actionPendingMetamagic, gateMetamagic: actionGateMetamagic, handleConfirm: actionHandleConfirm, handleSkip: actionHandleSkip } = useSpellMetamagicFlow(playerStats, campaignName, actionCastAction);
    const handleActionSpellCast = React.useCallback(async (spell) => {
        setSelectedActionSpell(null);
        if (mapName) {
            try {
                const [mapData] = await Promise.all([
                    mapsService.loadMapData(campaignName, mapName),
                ]);
                const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
                if (attackerPlayer) {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    if (target) {
                        const targetPlayer = mapData?.players?.find(p => p.name === target.name);
                        const targetNpc = mapData?.placedItems?.length
                            ? getNearestPlacedItem(mapData.placedItems, target.name, attackerPlayer)
                            : null;
                        const targetPos = targetPlayer
                            ? { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY }
                            : targetNpc
                                ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY }
                                : null;
                        if (targetPos) {
                            cachedActionCastPosRef.current = {
                                attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                                targetPos,
                            };
                        }
                    }
                }
            } catch { /* positions unavailable */ }
        }
        actionGateMetamagic(spell);
    }, [actionGateMetamagic, mapName, campaignName, playerStats.name]);

    const is2024Rules = playerStats.rules === '2024';

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
                            <div className='left clickable' onClick={() => handleActionSpellClick(attack.name)}>{attack.name}</div>
                            <div>{attack.range} ft.</div>
                            {attack.saveDc
                                ? <div className="save-dc-display">DC {attack.saveDc + displaySaveDcBonus} {attack.saveType}</div>
                                : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => handleSpellAttackClick(attack)}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                            <div className={attack.damage ? "clickable" : ""} onClick={() => {
                                if (cannotAct) return;
                                if (attack.saveDc) { handleActionSpellDamageClick(attack); return; }
                                const isSpell = playerStats.spellAbilities?.spells?.some(s => s.name === attack.name);
                                isSpell ? handleSpellDamageClick(attack) : handleDamageClick(attack);
                            }}>{attack.damage}</div>

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
                                popupHtml.type === 'empowered_spell' ?
                                    <EmpoweredSpellPopup
                                        state={popupHtml}
                                        onReroll={(lastEvent, chaMod) => {
                                            executeEmpoweredReroll({ campaignName, playerStats, lastEvent, chaMod }).then(result => {
                                                if (!result) return;
                                                if (result.popupState) setPopupHtml(result.popupState);
                                                if (result.logEntries) {
                                                    result.logEntries.forEach(e => addEntry(campaignName, e).catch(() => {}));
                                                }
                                            });
                                        }}
                                        onClose={() => setPopupHtml && setPopupHtml(null)}
                                    /> :
                                    <DiceRollResult {...popupHtml} onQuickRoll={popupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined} />}
                    </Popup>
                )}
                {healingPoolModal && (
                    <HealingPoolModal
                        playerStats={playerStats}
                        campaignName={campaignName}
                        name={healingPoolModal.name}
                        poolMax={healingPoolModal.pool}
                        poolExpression={healingPoolModal.poolExpression}
                        isDicePool={healingPoolModal.isDicePool}
                        dieType={healingPoolModal.dieType}
                        resourceKey={healingPoolModal.resourceKey}
                        alsoCures={healingPoolModal.alsoCures}
                        cureCost={healingPoolModal.cureCost}
                        restoringTouchConditions={healingPoolModal.restoringTouchConditions}
                        onClose={() => setHealingPoolModal(null)}
                    />
                )}
                {handOfHealingModal && (
                    <HandOfHealingModal
                        {...handOfHealingModal}
                        campaignName={campaignName}
                        onClose={() => setHandOfHealingModal(null)}
                    />
                )}
                {fontOfMagicModal && (
                    <FontOfMagicModal
                        playerStats={playerStats}
                        campaignName={campaignName}
                        onClose={() => setFontOfMagicModal(null)}
                    />
                )}
                {setConditionModal && (
                    <SetConditionModal
                        {...setConditionModal}
                        characters={characters}
                        onClose={() => setSetConditionModal(null)}
                    />
                )}
                {attackRiderModal && (
                    <AttackRiderModal
                        {...attackRiderModal}
                        onClose={() => { setAttackRiderModal(null); window.dispatchEvent(new CustomEvent('target-effects-updated')); }}
                    />
                )}
                {weaponMasteryModal && (
                    <WeaponMasteryModal
                        {...weaponMasteryModal}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        targetName={null}
                        onClose={handleMasteryClose}
                    />
                )}
                {combatStanceModal && (
                    <CombatStanceModal
                        {...combatStanceModal}
                        onClose={() => { setCombatStanceModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    />
                )}
                {teleportModal && (
                    <TeleportModal
                        {...teleportModal}
                        onClose={() => { setTeleportModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    />
                )}
                {divineSparkModal && (
                    <DivineSparkModal
                        {...divineSparkModal}
                        onClose={() => setDivineSparkModal(null)}
                    />
                )}
                {divineInterventionModal && (
                    <DivineInterventionModal
                        {...divineInterventionModal}
                        onSelect={handleDivineInterventionCast}
                        onClose={() => {
                            setDivineInterventionModal(null);
                            setDivineInterventionAction(null);
                        }}
                    />
                )}
                {divineFuryChoice && (
                    <div className="sp-overlay" onClick={handleDivineFurySkip}>
                        <div className="sp-modal" onClick={e => e.stopPropagation()}>
                            <div className="sp-header">
                                <i className="fa-solid fa-bolt"></i> Divine Fury — Damage Type
                            </div>
                            <div className="sp-body">
                                <p>Choose the damage type for this hit:</p>
                                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                    <button className="sp-roll-btn" style={{ marginRight: '12px' }} onClick={() => handleDivineFuryDamageType('Necrotic')}>
                                        <i className="fa-solid fa-skull"></i> Necrotic
                                    </button>
                                    <button className="sp-roll-btn" onClick={() => handleDivineFuryDamageType('Radiant')}>
                                        <i className="fa-solid fa-sun"></i> Radiant
                                    </button>
                                </div>
                            </div>
                            <div className="sp-actions">
                                <button className="sp-dismiss-btn" onClick={handleDivineFurySkip}>Skip</button>
                            </div>
                        </div>
                    </div>
                )}
                {damageTypeChoice && (
                    <div className="sp-overlay" onClick={handleGenericDamageTypeSkip}>
                        <div className="sp-modal" onClick={e => e.stopPropagation()}>
                            <div className="sp-header">
                                <i className="fa-solid fa-bolt"></i> {damageTypeChoice.title}
                            </div>
                            <div className="sp-body">
                                <p>Choose the damage type for this hit:</p>
                                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                    {damageTypeChoice.types.map((type) => (
                                        <button
                                            key={type}
                                            className="sp-roll-btn"
                                            style={{ margin: '0 6px 8px 6px' }}
                                            onClick={() => handleGenericDamageTypeChoice(type)}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="sp-actions">
                                <button className="sp-dismiss-btn" onClick={handleGenericDamageTypeSkip}>Skip</button>
                            </div>
                        </div>
                    </div>
                )}
                {featureChoice && (
                    <div className="sp-overlay" onClick={handleFeatureChoiceSkip}>
                        <div className="sp-modal" onClick={e => e.stopPropagation()}>
                            <div className="sp-header">
                                <i className="fa-solid fa-bolt"></i> {featureChoice.action.name}
                            </div>
                            <div className="sp-body">
                                <p><b>Choose your option:</b></p>
                                <p style={{ opacity: 0.8, fontSize: '0.9em' }}>{featureChoice.action.description}</p>
                                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                    {featureChoice.options.map((opt) => (
                                        <button
                                            key={opt}
                                            className="sp-roll-btn"
                                            style={{ margin: '0 6px 8px 6px' }}
                                            onClick={() => handleFeatureChoiceConfirm(opt)}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="sp-actions">
                                <button className="sp-dismiss-btn" onClick={handleFeatureChoiceSkip}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
                {selectedActionSpell && (
                    <Popup onClickOrKeyDown={() => setSelectedActionSpell(null)}>
                        <SpellDetailPopup
                            spell={selectedActionSpell}
                            playerStats={playerStats}
                            campaignName={campaignName}
                            playerLevel={playerStats.level}
                            upcastLevels={buildUpcastLevels(selectedActionSpell)}
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
                {pendingActionMetamagic && (
                    <MetamagicPopup
                        spell={{ name: pendingActionMetamagic.spellName, level: pendingActionMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: pendingActionMetamagic._currentSP }}
                        campaignName={campaignName}
                        onConfirm={handleActionMetamagicConfirm}
                        onSkip={handleActionMetamagicSkip}
                    />
                )}
                {playerStats.actions.map((action) => {
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
                         const rageKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
                         const currentRage = Number(getRuntimeValue(playerStats.name, 'ragePoints', campaignName) ?? 0);
                         if (currentRage <= 0) {
                             setPopupHtml(`<b>${action.name}</b><br/>No Rage remaining to restore this feature.`);
                             return;
                         }
                         await setRuntimeValue(playerStats.name, 'ragePoints', currentRage - 1, campaignName);
                         await setRuntimeValue(playerStats.name, rageKey, 0, campaignName);
                         setPopupHtml(`<b>${action.name}</b><br/>Expended 1 Rage to restore use.`);
                         window.dispatchEvent(new CustomEvent('combat-summary-updated'));
                      };
                     return <div key={action.name}>
                         <b className={isClickable && !exhausted ? "clickable" : ""} onClick={handleClick}>{displayName}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayDesc) }}></span>
                         {hasAutomation(action) && auto?.type === 'save_attack' && auto?.saveDc && <span className="automation-badge"> DC {auto.saveDc} {auto.saveType}</span>}
                         {hasAutomation(action) && auto?.type === 'healing_pool' && <span className="automation-badge"> Pool: {auto.pool} HP</span>}
                         {hasAutomation(action) && auto?.damage && <span className="automation-badge"> {auto.damage} {auto.damageType}</span>}
                         {exhausted && isRageExpendable && <span className="automation-badge clickable" onClick={renderRageRestore}><i className="fa-solid fa-fire-flame-curved"></i> Restore with Rage</span>}
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
                getTargetInfo={getTargetInfo}
            />
        </div>
    )
}, areEqual);

export default CharActions