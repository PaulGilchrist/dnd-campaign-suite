
import React, { useState, useEffect } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import MetamagicPopup from './MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { parseMagicItemName } from '../../services/attackCalc.js';
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import { useSpellUpcastFlow } from '../../hooks/useSpellUpcastFlow.js'
import { rollExpression, rollExpressionDoubled, parseExpression } from '../../services/diceRoller.js';
import * as mapsService from '../../services/mapsService.js';
import { computeFeatRangeEffects } from '../../services/featRangeService.js';
import { hasAutomation } from '../../services/automationService.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import utils from '../../services/utils.js'
import HealingPoolModal from './HealingPoolModal.jsx'
import HandOfHealingModal from './HandOfHealingModal.jsx'
import FontOfMagicModal from './FontOfMagicModal.jsx'
import SetConditionModal from './SetConditionModal.jsx'
import CharBonusActions from './CharBonusActions.jsx'
import { executeHandler } from '../../services/automation/index.js';
import { getClassFeatures } from '../../services/classFeatures.js';
import { addEntry } from '../../services/logService.js';
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints, getLastDamageEvent, saveLastDamageEvent } from '../../hooks/useMetamagic.js';
import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js'
import { executeSpellCast } from '../../services/spellCastService.js'
import { getChaModifier } from '../../services/metamagicRules.js';
import { getTargetFromAttacker, getCombatContext } from '../../services/damageUtils.js';
import { applyDamageToTarget } from '../../services/applyDamage.js';
import { getNearestPlacedItem } from '../../services/rangeValidation.js';
import { getInnateSorceryBonus } from './char-summary/buffService.js';
import { buildAttackContext, buildAttackContextSync } from '../../services/automation/contextBuilder.js';
import './CharActions.css'
import { isEqual } from 'lodash';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats) && prevProps.conditionAttackMode === nextProps.conditionAttackMode && prevProps.exhaustionPenalty === nextProps.exhaustionPenalty && prevProps.cannotAct === nextProps.cannotAct;

const CharActions = React.memo(function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, onBuffsChange }) {
    const [actions, setActions] = useState([]);
    const [selectedActionSpell, setSelectedActionSpell] = useState(null);
    const [pendingActionMetamagic, setPendingActionMetamagic] = useState(null);
    const [featRangeEffects, setFeatRangeEffects] = useState(null);
    const [healingPoolModal, setHealingPoolModal] = useState(null);
    const [handOfHealingModal, setHandOfHealingModal] = useState(null);
    const [fontOfMagicModal, setFontOfMagicModal] = useState(null);
    const [setConditionModal, setSetConditionModal] = useState(null);
    const { saveDcBonus: displaySaveDcBonus } = getInnateSorceryBonus(playerStats.name, campaignName);

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
        }

        (mapName ? buildCtx(attack) : buildCtxSync(attack)).then(ctx => {
            rollDamage(attack.name, formula, total, rolls, modifier, ctx);
        }).catch(() => { });
    };

    const handleAttackClick = React.useCallback((attack) => {
        if (cannotAct) return;
         buildCtx(attack).then(ctx => {
             rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, ctx);
          }).catch(() => { });
      }, [cannotAct, buildCtx, rollAttack, exhaustionPenalty]);

    const MONK_KI_FEATURES = ['Flurry of Blows', 'Patient Defense', 'Step of the Wind', 'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind', 'Hand of Healing', 'Stunning Strike'];

    async function handleAutomationAction(action) {
        if (cannotAct) return;

         // Metamagic is handled locally, not by the dispatcher
        const auto = action.automation;
        if (auto?.type === 'spell_modifier' && action.name === 'Metamagic') {
            handleMetamagicAction();
            return;
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

        if (result.type === 'popup' && auto?.type === 'temp_buff') {
            if (onBuffsChange) onBuffsChange();
         }
      }

    const handleMetamagicAction = () => {
        const name = playerStats.name;
        const maxSP = getMaxSorceryPoints(playerStats);
        const currentSP = getCurrentSorceryPoints(name, maxSP);
        const lastEvent = getLastDamageEvent(name);
        const chaMod = getChaModifier(playerStats);

        if (lastEvent && lastEvent.rolls && lastEvent.damageFormula) {
            const parsed = parseExpression(lastEvent.damageFormula);
            if (!parsed) {
                setPopupHtml({
                    type: 'empowered_spell',
                    name: 'Metamagic - Empowered Spell',
                    currentSP,
                    maxSP,
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
                maxSP,
                lastEvent,
                chaMod: Math.min(chaMod, parsed.count),
                formulaParsed: parsed,
               });
            } else {
               setPopupHtml({
                   type: 'empowered_spell',
                   name: 'Metamagic - Empowered Spell',
                   currentSP,
                   maxSP,
                   lastEvent: null,
                   chaMod,
                   error: lastEvent ? 'No dice roll data available' : 'No recent damage event found. Cast a spell that deals damage first.',
               });
           }
       };

    const handleEmpoweredReroll = async (lastEvent, chaMod) => {
        const parsed = parseExpression(lastEvent.damageFormula);
        if (!parsed) return;

        const name = playerStats.name;
        const maxSP = getMaxSorceryPoints(playerStats);
        const currentSP = getCurrentSorceryPoints(name, maxSP);
        if (currentSP < 1) {
            setPopupHtml({
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP,
                maxSP,
                lastEvent,
                chaMod,
                error: 'Not enough sorcery points. Empowered Spell costs 1 SP.',
             });
            return;
           }

        const { sides, modifier } = parsed;
        const originalRolls = lastEvent.rolls || [];

        const rerollCount = Math.min(chaMod, originalRolls.length);
        const sortedWithIndex = originalRolls.map((r, i) => ({ value: r, index: i }))
              .sort((a, b) => a.value - b.value);
        const rerollIndices = new Set(sortedWithIndex.slice(0, rerollCount).map(x => x.index));

        const newRolls = originalRolls.map((r, i) => rerollIndices.has(i) ? Math.floor(Math.random() * sides) + 1 : r);
        const newTotal = newRolls.reduce((sum, r) => sum + r, 0) + modifier;
        const damageDifference = newTotal - lastEvent.rawDamage;

        const combatSummary = await getCombatContext(campaignName);
        if (!combatSummary || !lastEvent.targetName) {
            setPopupHtml({
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP,
                maxSP,
                lastEvent,
                chaMod,
                error: 'No combat summary found. Cannot reapply damage.',
             });
            return;
        }

        spendSorceryPoints(name, 1, campaignName, maxSP);

        if (damageDifference !== 0) {
            const applyResult = applyDamageToTarget(combatSummary, lastEvent.targetName, damageDifference, lastEvent.damageType ? [lastEvent.damageType] : [], campaignName, null);
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
                maxSP,
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
               setPopupHtml({
                   type: 'empowered_spell',
                   name: 'Metamagic - Empowered Spell',
                   currentSP: currentSP - 1,
                   maxSP,
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

        saveLastDamageEvent(name, {
             ...lastEvent,
            rawDamage: newTotal,
            rolls: newRolls,
            timestamp: Date.now(),
         }, campaignName);
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
        executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos: pos?.attackerPos, targetPos: pos?.targetPos, featEffects: featRangeEffects, campaignName });
        cachedActionCastPosRef.current = null;
    }, [rollAttack, rollDamage, playerStats, getTargetInfo, featRangeEffects, campaignName]);
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

    const isBonusSorcerer = playerStats.class?.name === 'Sorcerer';

    const is2024Rules = playerStats.rules === '2024';

    // Unified metamagic confirm/skip for spell hit/damage clicks on Sorcerers
    const handleActionMetamagicConfirm = React.useCallback((result) => {
        const pending = pendingActionMetamagic;
        setPendingActionMetamagic(null);
        if (!pending) return;

        if (result?.totalCost > 0) {
            spendSorceryPoints(playerStats.name, result.totalCost, campaignName, getMaxSorceryPoints(playerStats));
        }

        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: pending.spellName,
            spellLevel: pending.spellLevel || 0,
            castingTime: pending.castingTime || 'Action',
            metamagic: result?.options || [],
            spCost: result?.totalCost || 0,
            timestamp: Date.now(),
        });

        const metaCtx = {};
        if (result?.options) {
            if (result.options.includes('Heightened Spell')) metaCtx.metamagicHeighten = true;
            if (result.options.includes('Careful Spell')) metaCtx.metamagicCareful = true;
            if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget;
            if (result.options.includes('Distant Spell')) metaCtx.metamagicDistant = true;
        }

        pending.action(metaCtx);
    }, [pendingActionMetamagic, playerStats, campaignName]);

    const handleActionMetamagicSkip = React.useCallback(() => {
        const pending = pendingActionMetamagic;
        setPendingActionMetamagic(null);
        if (!pending) return;

        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: pending.spellName,
            spellLevel: pending.spellLevel || 0,
            castingTime: pending.castingTime || 'Action',
            metamagic: [],
            spCost: 0,
            timestamp: Date.now(),
        });

        pending.action({});
    }, [pendingActionMetamagic, playerStats.name, campaignName]);

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
            const wasCrit = popupHtml?.isCrit;
            if (wasCrit && setPopupHtml) setPopupHtml(null);
            const result = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
            if (!result) return;

            if (!mapName) {
                rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, buildCtxSync(attack));
            } else {
                buildCtx(attack).then(ctx => {
                    rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, ctx);
                  }).catch(() => {});
            }
            return;
        }

        // Sorcerer - show metamagic popup
        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: attack.spellLevel || 0,
            castingTime: attack.castingTime || 'Action',
            _currentSP: currentSP,
            action: (metaCtx) => {
                const wasCrit = popupHtml?.isCrit;
                if (wasCrit && setPopupHtml) setPopupHtml(null);
                const r = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
                if (!r) return;
                if (!mapName) {
                    rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, { ...buildCtxSync(attack), ...metaCtx });
                } else {
                     buildCtx(attack).then(ctx => {
                         rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, { ...ctx, ...metaCtx });
                       }).catch(() => {});
                   }
               },
           });
       };

      // Hit column click on spell attacks - gate through metamagic for sorcerers
    const handleSpellAttackClick = (attack) => {
        if (cannotAct) return;
        const spell = playerStats.spellAbilities?.spells?.find(s => s.name === attack.name);
        if (!spell) {
            handleAttackClick(attack);
            return;
        }
        if (!isBonusSorcerer) {
            handleAttackClick(attack);
            return;
        }

        // Sorcerer - show metamagic popup
        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: spell.level || 0,
            castingTime: spell.casting_time || 'Action',
            _currentSP: currentSP,
            action: (metaCtx) => {
                if (!mapName) {
                    const ctx = buildCtxSync(attack);
                    rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, { ...ctx, ...metaCtx });
                } else {
                     buildCtx(attack).then(ctx => {
                         rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, { ...ctx, ...metaCtx });
                        }).catch(() => {});
                    }
                },
            });
        };

       // Damage column click on attack-roll spells - gate through metamagic for sorcerers
    const handleSpellDamageClick = (attack) => {
        const spell = playerStats.spellAbilities?.spells?.find(s => s.name === attack.name);
        if (!spell) {
            handleDamageClick(attack);
            return;
        }
        if (!isBonusSorcerer) {
            handleDamageClick(attack);
            return;
        }

        // Sorcerer - show metamagic popup
        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: spell.level || 0,
            castingTime: spell.casting_time || 'Action',
            _currentSP: currentSP,
            action: (metaCtx) => {
                const wasCrit = popupHtml?.isCrit;
                if (wasCrit && setPopupHtml) setPopupHtml(null);
                const r = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
                if (!r) return;
                if (!mapName) {
                    rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, { ...buildCtxSync(attack), ...metaCtx });
                } else {
                    buildCtx(attack).then(ctx => {
                        rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, { ...ctx, ...metaCtx });
                        }).catch(() => {});
                  }
              },
        });
    };

    const getEmpoweredSpellDescription = (action) => {
        if (action.details) {
            const match = action.details.match(/<li><b>Empowered Spell<\/b>\.?\s*([\s\S]*?)<\/li>/i);
            if (match) return match[1].trim();
        }
        return 'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.';
    };

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
                                popupHtml.type === 'empowered_spell' ? <div className="dice-roll-result">
                                    <div className="dice-roll-header"><i className="fa-solid fa-wand-magic-sparkles"></i>{popupHtml.name}</div>
                                    <div className="metamagic-sp-display">Sorcery Points: <strong>{popupHtml.currentSP}</strong> / {popupHtml.maxSP}</div>
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
                        onClose={() => setSetConditionModal(null)}
                    />
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
                    const isMetamagic = action.name === 'Metamagic' && action.automation?.type === 'spell_modifier';
                    const isClickable = action.details || hasAutomation(action);
                    const handleClick = () => {
                        if (hasAutomation(action)) {
                            handleAutomationAction(action);
                        } else {
                            setPopupHtml(buildFeatureDetailHtml(action));
                        }
                    };
                    const displayName = isMetamagic ? 'Empowered Spell' : action.name;
                    const displayDesc = isMetamagic ? getEmpoweredSpellDescription(action) : action.description;
                    return <div key={action.name}>
                        <b className={isClickable ? "clickable" : ""} onClick={handleClick}>{displayName}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayDesc) }}></span>
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
                getTargetInfo={getTargetInfo}
            />
        </div>
    )
}, areEqual);

export default CharActions