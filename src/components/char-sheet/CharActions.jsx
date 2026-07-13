import React, { useState, useEffect } from 'react'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import { getCategories } from '../../services/character/featureCategories.js'
import { getActionSpellNames } from '../../services/ui/spellSectionUtils.js'
import { formatRange, signFormatter, getAttackSpellLevel } from '../../services/ui/formatUtils.js'
import { resolveSpellDamageAtLevel, isAutoHitSpell } from '../../services/rules/core/spellDamageUtils.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js'
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js'
import { rollExpression } from '../../services/dice/diceRoller.js';
import { computeFeatRangeEffects } from '../../services/character/featRangeService.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js'
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { toggleBuff } from '../../services/automation/common/buffToggle.js';
import { addExpiration } from '../../services/rules/effects/expirations.js';
import { addEntry } from '../../services/ui/logService.js';
import CharActionModals from './CharActionModals.jsx'
import CharActionSpellPopups from './CharActionSpellPopups.jsx'
import CharBonusActions from './CharBonusActions.jsx'
import { executeHandler } from '../../services/automation/index.js';
import { onSpellSelected as onDivineInterventionSpellSelected } from '../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js';
import { getClassFeatures } from '../../services/character/classFeatures.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'
import { getTargetFromAttacker, getCombatContext, getAttackerTargetName } from '../../services/rules/combat/damageUtils.js';
import { getActiveCreatureName } from '../../services/encounters/combatData.js';
import { executeSweepingAttack, executeBaitAndSwitchChoice, executeCommanderStrikeChoice, executeRallyChoice } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { activateBulwarkOfForce } from '../../services/automation/handlers/class-sorcerer/bulwarkOfForceHandler.js';
import { activateNaturesSanctuary, moveNaturesSanctuary } from '../../services/automation/handlers/class-ranger/naturesSanctuaryHandler.js';
import { activateCoronaOfLight } from '../../services/automation/handlers/class-cleric-paladin/coronaOfLightHandler.js';
import { confirmRadianceOfDawn } from '../../services/automation/handlers/class-cleric-paladin/radianceOfDawnHandler.js';
import { applyBardicInspiration } from '../../services/automation/handlers/class-bard/bardicInspirationHandler.js';
import { applyInspiringMovement } from '../../services/automation/handlers/reactions/reactionBonusHandler.js';
import { confirmMantleOfInspiration } from '../../services/automation/handlers/buffs/tempHpBuffHandler.js';
import { confirmOceanicGift } from '../../services/automation/handlers/class-druid/oceanicGiftHandler.js';
import { endFriendsOnHostileAction } from '../../services/rules/features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { buildAttackContext, buildAttackContextSync } from '../../services/automation/contextBuilder.js';
import { buildEmpoweredSpellState, getEmpoweredSpellDescription } from '../../services/rules/spells/empoweredSpellService.js';
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
import { applyMasteryEffect } from '../../services/automation/handlers/combat/weaponMasteryHandler.js';
import { normalizeAutoDamage } from './useAttackDamageResolution.js';

import './CharActions.css'
import { isEqual } from 'lodash';

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats) && prevProps.conditionAttackMode === nextProps.conditionAttackMode && prevProps.exhaustionPenalty === nextProps.exhaustionPenalty && prevProps.cannotAct === nextProps.cannotAct;

const CharActions = React.memo(function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, onBuffsChange, characters }) {
    const [actions, setActions] = useState([]);
    const [selectedActionSpell, setSelectedActionSpell] = useState(null);
    const [featRangeEffects, setFeatRangeEffects] = useState(null);
    const [autoDamageRollContext] = useSyncedState(campaignName, 'autoDamageContext', null, campaignName);
    const { saveDcBonus: displaySaveDcBonus } = getInnateSorceryBonus(playerStats.name, campaignName);
    const { popupHtml, setPopupHtml } = useDiceRollPopup();

    const getSpellDamageDisplay = React.useCallback((spell) => {
        if (spell.heal_at_slot_level) return '';
        const resolved = resolveSpellDamageAtLevel(spell, playerStats.level);
        if (!resolved || spell.level !== 0) return resolved;
        const potentFeature = playerStats.automation?.actions?.find(
            a => a.type === 'damage_bonus' && !a.upgrades && a.options?.some(o => o.toLowerCase().includes('spellcasting'))
        );
        if (!potentFeature) return resolved;
        const optKey = `_${(potentFeature.name || 'PotentSpellcasting').replace(/\s+/g, '_')}_option`;
        const chosen = getRuntimeValue(playerStats.name, optKey, campaignName);
        if (potentFeature.options.length > 1 && !chosen) return resolved;
        if (chosen && !chosen.toLowerCase().includes('spellcasting')) return resolved;
        const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
        const wisMod = Math.max(0, wis?.bonus || 0);
        if (wisMod <= 0) return resolved;
        return `${resolved}+${wisMod}`;
    }, [playerStats, campaignName]);

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
            const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit, playerStats);
            await resolveAttackDamage(attack, ctxOverrides);
        },
    });

    // Handle damage type choice popup (e.g. Blessed Strikes: Necrotic or Radiant)
    useEffect(() => {
        const handleHealingPopup = (e) => {
            const { targetName, healingName, rollInfo, maximizeHealingDice, popupText } = e.detail || {};
            const diceRoll = rollInfo ? ` [${rollInfo}]` : '';
            const maximizeNote = maximizeHealingDice ? ' (maximized)' : '';
            setPopupHtml(`<b>${healingName}</b> on ${targetName}${diceRoll}${maximizeNote}<br/><br/>${popupText}`);
        };
        const handleDamagePopup = (e) => {
            const { targetName, spellName, popupText, rollInfo } = e.detail || {};
            const diceRoll = rollInfo ? ` [${rollInfo}]` : '';
            setPopupHtml(`<b>${spellName}</b> on ${targetName}${diceRoll}<br/><br/>${popupText}`);
        };
        window.addEventListener('healing-popup', handleHealingPopup);
        window.addEventListener('damage-popup', handleDamagePopup);
        return () => {
            window.removeEventListener('healing-popup', handleHealingPopup);
            window.removeEventListener('damage-popup', handleDamagePopup);
        };
    }, [setPopupHtml]);

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
        pendingDamage,
        modalState,
        setModalState,
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
        combatSuperiorityModal,
        setCombatSuperiorityModal,
        handleAttackRiderManeuverUse,
        handleAttackRiderManeuverSkip,
        handleCombatSuperiorityConfirm,
    } = useCharActionModals({
        playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects,
        popupHtml, setPopupHtml, rollDamage, rollAttack, buildCtx, buildCtxSync,
    });

    const [showCleaveTargetSelection, setShowCleaveTargetSelection] = useSyncedState(campaignName, 'cleavePending', false, campaignName);
    const [cleaveSecondTargets, setCleaveSecondTargets] = useSyncedState(campaignName, 'cleaveSecondTargets', [], campaignName);
    const [tacticalMasterModal, setTacticalMasterModal] = useSyncedState(campaignName, 'tacticalMasterPending', null, campaignName);

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
    }, [campaignName, playerStats, rollDamage, setShowCleaveTargetSelection]);

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
    }, [campaignName, playerStats, tacticalMasterModal, setTacticalMasterModal]);

    const handleTacticalMasterDismiss = () => {
        setTacticalMasterModal(null);
    };

    useEffect(() => {
        const handler = (event) => {
            setModalState({ soulstitchSpellsModal: event.detail });
        };
        window.addEventListener('soulstitch-modal-show', handler);
        return () => window.removeEventListener('soulstitch-modal-show', handler);
    }, [setModalState]);

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
            setModalState({ secondaryTargetModal: {
                title,
                targets: allyTargets,
                confirmLabel: evtConfirmLabel || 'Grant Temp HP',
                onTargetSelected: async (targetName) => {
                    const existing = getRuntimeValue(targetName, 'tempHp', evtCampaignName) || 0;
                    setRuntimeValue(targetName, 'tempHp', Math.max(existing, tempHp), evtCampaignName);
                    addEntry(evtCampaignName, {
                        type: 'roll',
                        characterName: attackerName,
                        rollType: 'temp-hp',
                        name: 'Potent Spellcasting',
                        targetName,
                        note: `Gained ${tempHp} temporary hit points from Potent Spellcasting`,
                        total: tempHp,
                    }).catch((e) => { console.error("[CharActions] Error:", e); });
                    setModalState({ secondaryTargetModal: null });
                },
                onSkip: () => {
                    const existing = getRuntimeValue(attackerName, 'tempHp', evtCampaignName) || 0;
                    setRuntimeValue(attackerName, 'tempHp', Math.max(existing, tempHp), evtCampaignName);
                    addEntry(evtCampaignName, {
                        type: 'roll',
                        characterName: attackerName,
                        rollType: 'temp-hp',
                        name: 'Potent Spellcasting',
                        targetName: attackerName,
                        note: `Gained ${tempHp} temporary hit points from Potent Spellcasting`,
                        total: tempHp,
                    });
                    setModalState({ secondaryTargetModal: null });
                },
                featureDescription: `Grant ${tempHp} temporary hit points to a creature within 60 feet.`,
                description: 'Choose a creature to grant temporary hit points from Potent Spellcasting.',
            }});
        };
        window.addEventListener('potent-spellcasting-temp-hp', handler);
        return () => window.removeEventListener('potent-spellcasting-temp-hp', handler);
    }, [setModalState]);

    useEffect(() => {
        const handler = (event) => {
            setModalState({ sweepingAttackTargetModal: event.detail });
        };
        window.addEventListener('sweeping-attack-modal-show', handler);
        return () => window.removeEventListener('sweeping-attack-modal-show', handler);
    }, [setModalState]);

    useEffect(() => {
        const handler = (event) => {
            setModalState({ baitAndSwitchChoiceModal: event.detail });
        };
        window.addEventListener('bait-and-switch-modal-show', handler);
        return () => window.removeEventListener('bait-and-switch-modal-show', handler);
    }, [setModalState]);

    useEffect(() => {
        const handler = (event) => {
            setModalState({ commanderStrikeChoiceModal: event.detail });
        };
        window.addEventListener('commander-strike-modal-show', handler);
        return () => window.removeEventListener('commander-strike-modal-show', handler);
    }, [setModalState]);

    useEffect(() => {
        const handler = (event) => {
            setModalState({ rallyChoiceModal: event.detail });
        };
        window.addEventListener('rally-choice-modal-show', handler);
        return () => window.removeEventListener('rally-choice-modal-show', handler);
    }, [setModalState]);

    const handleAttackClick = React.useCallback((attack) => {
        if (cannotAct) return;
        // Making an attack roll ends any active Friends spell early
        endFriendsOnHostileAction(playerStats.name, campaignName);
        endInvisibilityOnHostileAction(playerStats.name, campaignName);

        const hasRecklessFeature = playerStats.automation?.specialActions?.some(
            a => a.effect === 'advantage_attacks_advantage_against' && a.trigger === 'first_attack_of_turn'
        );
        const activeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
        const isRecklessActive = activeBuffs.some(b => b.effect === 'advantage_attacks_advantage_against');
        const offeredKey = '_recklessAttack_offeredThisTurn';
        const offeredValue = getRuntimeValue(playerStats.name, offeredKey);
        const currentCreature = getActiveCreatureName(campaignName);
        const isOfferedThisTurn = offeredValue && offeredValue.activeCreature === currentCreature;

        if (playerStats.name === 'Thulgar') {
            console.log('[Reckless] tracker check:', { offeredKey, offeredValue, currentCreature, isOfferedThisTurn });
        }

        const recklessAction = playerStats.automation?.specialActions?.find(a => a.name === 'Reckless Attack');
        console.log('[handleAttackClick] Reckless Attack pre-conditions:', {
            hasRecklessFeature,
            isRecklessActive,
            isOfferedThisTurn,
            attackName: attack.name,
            attackAbilityName: attack.abilityName,
            attackWeaponType: attack.weaponType,
            specialActionsCount: playerStats.automation?.specialActions?.length,
            specialActionsNames: playerStats.automation?.specialActions?.map(a => a.name),
            recklessAction: recklessAction ? { name: recklessAction.name, effect: recklessAction.effect, trigger: recklessAction.trigger } : null,
        });

        if (hasRecklessFeature && !isRecklessActive && !isOfferedThisTurn) {
            setModalState({ recklessAttackModal: { attack } });
            return;
        }

        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch((e) => { console.error("[CharActions] Error:", e); });
    }, [cannotAct, buildCtx, rollAttack, exhaustionPenalty, playerStats.name, campaignName, setModalState, playerStats.automation?.specialActions]);

    const handleRecklessAttackConfirm = React.useCallback((attack) => {
        toggleBuff(
            playerStats.name,
            'Reckless Attack',
            { effect: 'advantage_attacks_advantage_against', duration: 'until_start_of_next_turn' },
            campaignName,
            playerStats.name
        );
        addExpiration(playerStats.name, playerStats.name, [
            { type: 'remove_active_buff', buffName: 'Reckless Attack' }
        ], campaignName, undefined, playerStats.name);
        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const hasRecklessEffect = storedEffects.some(te => te.effect === 'reckless_attack' && te.target === playerStats.name);
        if (!hasRecklessEffect) {
            const newEffects = [...storedEffects, { target: playerStats.name, source: playerStats.name, effect: 'reckless_attack', duration: 'until_start_of_next_turn' }];
            setRuntimeValue(campaignName, 'targetEffects', newEffects, campaignName);
        }
        const currentCreature = getActiveCreatureName(campaignName);
        const trackerValue = { round: 1, activeCreature: currentCreature };
        setRuntimeValue(playerStats.name, '_recklessAttack_offeredThisTurn', trackerValue, campaignName);
        if (playerStats.name === 'Thulgar') {
            console.log('[Reckless] tracker SET (confirm):', trackerValue, 'storeKey:', playerStats.name);
        }
        setModalState({ recklessAttackModal: null });
        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch((e) => { console.error("[CharActions] Error:", e); });
    }, [buildCtx, rollAttack, exhaustionPenalty, playerStats.name, campaignName, setModalState]);

    const handleRecklessAttackCancel = React.useCallback((attack) => {
        const currentCreature = getActiveCreatureName(campaignName);
        const trackerValue = { round: 1, activeCreature: currentCreature };
        setRuntimeValue(playerStats.name, '_recklessAttack_offeredThisTurn', trackerValue, campaignName);
        if (playerStats.name === 'Thulgar') {
            console.log('[Reckless] tracker SET (cancel):', trackerValue, 'storeKey:', playerStats.name);
        }
        setModalState({ recklessAttackModal: null });
        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch((e) => { console.error("[CharActions] Error:", e); });
    }, [buildCtx, rollAttack, exhaustionPenalty, playerStats.name, campaignName, setModalState]);

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
        setModalState({ sweepingAttackTargetModal: null });
    }, [setPopupHtml, setModalState]);

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
        setModalState({ baitAndSwitchChoiceModal: null });
    }, [setPopupHtml, setModalState]);

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
        setModalState({ commanderStrikeChoiceModal: null });
    }, [setPopupHtml, setModalState]);

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
        setModalState({ rallyChoiceModal: null });
    }, [setPopupHtml, setModalState]);

    const handleBulwarkOfForceConfirm = React.useCallback(async (targetNames) => {
        if (!targetNames || !modalState.bulwarkOfForceModal) return;
        const result = await activateBulwarkOfForce(
            modalState.bulwarkOfForceModal.action,
            modalState.bulwarkOfForceModal.playerStats,
            modalState.bulwarkOfForceModal.campaignName,
            targetNames
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ bulwarkOfForceModal: null });
    }, [setPopupHtml, modalState.bulwarkOfForceModal, setModalState]);

    const handleNaturesSanctuaryConfirm = React.useCallback(async (targetNames) => {
        if (!targetNames || !modalState.naturesSanctuaryCreaturesModal) return;
        const { action, isMove } = modalState.naturesSanctuaryCreaturesModal;
        let result;
        if (isMove) {
            result = await moveNaturesSanctuary(
                action,
                modalState.naturesSanctuaryCreaturesModal.playerStats,
                modalState.naturesSanctuaryCreaturesModal.campaignName,
                targetNames
            );
        } else {
            result = await activateNaturesSanctuary(
                action,
                modalState.naturesSanctuaryCreaturesModal.playerStats,
                modalState.naturesSanctuaryCreaturesModal.campaignName,
                mapName,
                targetNames
            );
        }
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ naturesSanctuaryCreaturesModal: null });
    }, [setPopupHtml, modalState.naturesSanctuaryCreaturesModal, setModalState, mapName]);

    const handleCoronaEnemySelectionConfirm = React.useCallback(async (selectedEnemies) => {
        if (!selectedEnemies || !modalState.coronaEnemySelectionModal) return;
        const result = await activateCoronaOfLight(
            modalState.coronaEnemySelectionModal.action,
            modalState.coronaEnemySelectionModal.playerStats,
            modalState.coronaEnemySelectionModal.campaignName,
            selectedEnemies
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ coronaEnemySelectionModal: null });
    }, [setPopupHtml, modalState.coronaEnemySelectionModal, setModalState]);

    const handleRadianceOfDawnConfirm = React.useCallback(async (selectedTargets) => {
        if (!selectedTargets || !modalState.radianceOfDawnModal) return;
        const result = await confirmRadianceOfDawn(
            modalState.radianceOfDawnModal.action,
            modalState.radianceOfDawnModal.playerStats,
            modalState.radianceOfDawnModal.campaignName,
            selectedTargets
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ radianceOfDawnModal: null });
    }, [setPopupHtml, modalState.radianceOfDawnModal, setModalState]);

    const handleMantleOfInspirationConfirm = React.useCallback(async (selectedTargets) => {
        if (!selectedTargets || !modalState.mantleOfInspirationTarget) return;
        const result = await confirmMantleOfInspiration(
            modalState.mantleOfInspirationTarget.action,
            modalState.mantleOfInspirationTarget.playerStats,
            modalState.mantleOfInspirationTarget.campaignName,
            selectedTargets,
            modalState.mantleOfInspirationTarget.dieRoll,
            modalState.mantleOfInspirationTarget.bardicDieSize,
            modalState.mantleOfInspirationTarget.tempHp
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ mantleOfInspirationTarget: null });
    }, [setPopupHtml, modalState.mantleOfInspirationTarget, setModalState]);

    const handleTricksterBlessingConfirm = React.useCallback(async (targetName) => {
        if (!modalState.tricksterBlessingModal) return;
        const { action, playerStats, campaignName: evtCampaignName } = modalState.tricksterBlessingModal;
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
            addEntry(evtCampaignName, {
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
        setModalState({ tricksterBlessingModal: null });
    }, [setPopupHtml, modalState.tricksterBlessingModal, setModalState]);

    const handleBardicInspirationConfirm = React.useCallback(async (targetName) => {
        if (!modalState.bardicInspirationTargetModal) return;
        const { action, playerStats: biPlayerStats, campaignName: biCampaignName, dieSize, hasCombatOptions } = modalState.bardicInspirationTargetModal;
        setModalState({ bardicInspirationTargetModal: null });
        if (!targetName) return;
        const result = await applyBardicInspiration(action, biPlayerStats, biCampaignName, targetName, dieSize, hasCombatOptions);
        if (!result) return;
        if (result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }, [modalState.bardicInspirationTargetModal, setModalState, setPopupHtml]);

    const handleInspiringMovementConfirm = React.useCallback(async (allyName) => {
        if (!modalState.inspiringMovementAllyModal) return;
        const { action, playerStats: imPlayerStats, campaignName: imCampaignName, halfSpeed, noOAs } = modalState.inspiringMovementAllyModal;
        setModalState({ inspiringMovementAllyModal: null });
        if (!allyName) return;
        const result = await applyInspiringMovement(action, imPlayerStats, imCampaignName, allyName, halfSpeed, noOAs);
        if (!result) return;
        if (result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }, [modalState.inspiringMovementAllyModal, setModalState, setPopupHtml]);

    const handleOceanicGiftConfirm = React.useCallback(async (selectedAllyName) => {
        if (!modalState.oceanicGiftTargetModal) return;
        const { action, playerStats: ogPlayerStats, campaignName: ogCampaignName, spellSaveDc, wisMod, doubleEmanation } = modalState.oceanicGiftTargetModal;
        setModalState({ oceanicGiftTargetModal: null });
        if (!selectedAllyName) return;
        const result = await confirmOceanicGift(action, ogPlayerStats, ogCampaignName, selectedAllyName, spellSaveDc, wisMod, doubleEmanation);
        if (!result) return;
        if (result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }, [modalState.oceanicGiftTargetModal, setModalState, setPopupHtml]);

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
                setModalState({ featureChoice: { action, options: auto.options, optionKey } });
                return;
            }
        }

        // Defensive Tactics: present choice between Escape the Horde and Multiattack Defense
        if (auto?.type === 'defensive_tactics') {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setModalState({ featureChoice: { action, options: ['Escape the Horde', 'Multiattack Defense'], optionKey } });
                return;
            }
        }

        // For save_attack features with element options (e.g. Elemental Attunement)
        if (auto?.type === 'save_attack' && auto?.hasOptions && auto?.options?.length > 0) {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setModalState({ featureChoice: { action, options: auto.options, optionKey } });
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
                    case 'healingPool': setModalState({ healingPoolModal: result.payload }); break;
                    case 'handOfHealing': setModalState({ handOfHealingModal: result.payload }); break;
                    case 'fontOfMagic': setModalState({ fontOfMagicModal: true }); break;
                    case 'resourcePool': setModalState({ resourcePoolModal: result.payload }); break;
                    case 'wildCompanion': setModalState({ wildCompanionModal: result.payload }); break;
                    case 'setCondition': setModalState({ setConditionModal: result.payload }); break;
                    case 'eyebiteEffect': setModalState({ eyebiteEffectModal: result.payload }); break;
                    case 'attackRider': setModalState({ attackRiderModal: result.payload }); break;
                    case 'openHandTechnique': setModalState({ openHandTechniqueModal: result.payload }); break;
                    case 'combatStance': setModalState({ combatStanceModal: result.payload }); break;
                    case 'teleport': setModalState({ teleportModal: result.payload }); break;
                    case 'healingIllusion': setModalState({ healingIllusionModal: result.payload }); break;
                    case 'invokeDuplicity': setModalState({ invokeDuplicityModal: result.payload }); break;
                    case 'saveAttackHeal': setModalState({ saveAttackHealModal: result.payload }); break;
                    case 'divineSpark': setModalState({ divineSparkModal: result.payload }); break;
                    case 'divineIntervention':
                        setModalState({ divineInterventionAction: action, divineInterventionModal: result.payload });
                        break;
                    case 'moonlightStepResource': setModalState({ moonlightStepResourceModal: result.payload }); break;
                    case 'moonlightStepFallback': setModalState({ moonlightStepFallbackModal: result.payload }); break;
                    case 'starryFormConstellation': setModalState({ starryFormConstellationModal: result.payload }); break;
                    case 'twinklingConstellation': setModalState({ twinklingConstellationModal: result.payload }); break;
                    case 'arcaneCharge': setModalState({ arcaneChargeModal: result.payload }); break;
                    case 'warMagicCantrip': setModalState({ warMagicCantripModal: result.payload }); break;
                    case 'warMagicSpell': setModalState({ warMagicSpellModal: result.payload }); break;
                    case 'sacredWeaponDamageType': setModalState({ sacredWeaponModal: result.payload }); break;
                    case 'elderChampionRestore': setModalState({ elderChampionRestoreModal: result.payload }); break;
                    case 'primalCompanionBonusActionCommand': setModalState({ primalCompanionBonusActionModal: result.payload }); break;
                    case 'mistyWanderer': setModalState({ mistyWandererModal: result.payload }); break;
                    case 'feyReinforcements': setModalState({ feyReinforcementsModal: result.payload }); break;
                    case 'bonusActionChoice': setModalState({ bonusActionChoiceModal: result.payload }); break;
                    case 'stealthAttack': setModalState({ stealthAttackModal: result.payload }); break;
                    case 'revelationInFlesh': setModalState({ revelationInFleshModal: result.payload }); break;
                    case 'bastionOfLaw': setModalState({ bastionOfLawModal: result.payload }); break;
                    case 'elementalAffinity': {
                        const affPayload = result.payload;
                        const affAction = affPayload?.action;
                        const affTypes = affPayload?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];
                        setModalState({ elementalAffinityModal: { action: affAction, playerStats, campaignName, damageTypes: affTypes, existingType: affPayload?.existingType } });
                        break;
                    }
                    case 'fiendishResilience': {
                        const frPayload = result.payload;
                        const frAction = frPayload?.action;
                        const frTypes = frPayload?.damageTypes || ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
                        setModalState({ fiendishResilienceModal: { action: frAction, playerStats, campaignName, damageTypes: frTypes, existingType: frPayload?.existingType } });
                        break;
                    }
                    case 'boonOfEnergyResistance': {
                        const berPayload = result.payload;
                        const berAction = berPayload?.action;
                        const berTypes = berPayload?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];
                        setModalState({ boonOfEnergyResistanceModal: { action: berAction, playerStats, campaignName, damageTypes: berTypes, existingTypes: berPayload?.existingTypes, maxSelections: berPayload?.maxSelections || 2 } });
                        break;
                    }
                    case 'dragonCompanion':
                        setModalState({ dragonCompanionModal: result.payload });
                        break;
                    case 'wildMagicDoubleRoll':
                        setModalState({ wildMagicDoubleRollModal: result.payload });
                        break;
                    case 'weaponMasteryChoice':
                        setModalState({ weaponMasteryChoiceModal: result.payload });
                        break;
                    case 'weaponKindMastery':
                        setModalState({ weaponKindMasteryModal: result.payload });
                        break;
                    case 'wildMagicTamed':
                        setModalState({ wildMagicTamedModal: result.payload });
                        break;
                    case 'thirdEye':
                        setModalState({ thirdEyeModal: result.payload });
                        break;
                    case 'soulstitchSpells':
                        setModalState({ soulstitchSpellsModal: result.payload });
                        break;
                    case 'illusoryReality':
                        setModalState({ illusoryRealityModal: result.payload });
                        break;
                    case 'celestialRevelation':
                        setModalState({ celestialRevelationModal: result.payload });
                        break;
                    case 'elfishLineage':
                        setModalState({ elfishLineageModal: result.payload });
                        break;
                    case 'gnomishLineage':
                        setModalState({ gnomishLineageModal: result.payload });
                        break;
                    case 'fiendishLegacy':
                        setModalState({ fiendishLegacyModal: result.payload });
                        break;
                    case 'giantAncestry':
                        setModalState({ giantAncestryModal: result.payload });
                        break;
                    case 'breathWeaponShape': {
                        const bwPayload = result.payload;
                        setModalState({ breathWeaponShapeModal: { action: bwPayload.action, playerStats, campaignName, options: bwPayload.options } });
                        break;
                    }
                    case 'hypnoticPatternShake': {
                        const shakePayload = result.payload;
                        setModalState({ hypnoticPatternShakeModal: shakePayload });
                        break;
                    }
                    case 'combatSuperiority':
                        setModalState({ combatSuperiorityModal: result.payload });
                        break;
                    case 'sweepingAttackTarget':
                        setModalState({ sweepingAttackTargetModal: result.payload });
                        break;
                    case 'baitAndSwitchChoice':
                        setModalState({ baitAndSwitchChoiceModal: result.payload });
                        break;
                    case 'bulwarkOfForceTarget':
                        setModalState({ bulwarkOfForceModal: result.payload });
                        break;
                    case 'naturesSanctuaryCreatures':
                        setModalState({ naturesSanctuaryCreaturesModal: result.payload });
                        break;
                    case 'coronaEnemySelection':
                        setModalState({ coronaEnemySelectionModal: result.payload });
                        break;
                    case 'radianceOfDawn':
                        setModalState({ radianceOfDawnModal: result.payload });
                        break;
                    case 'mantleOfInspirationTarget':
                        setModalState({ mantleOfInspirationTarget: result.payload });
                        break;
                    case 'tricksterBlessing':
                        setModalState({ tricksterBlessingModal: result.payload });
                        break;
                    case 'bardicInspirationTarget':
                        setModalState({ bardicInspirationTargetModal: result.payload });
                        break;
                    case 'inspiringMovementAlly':
                        setModalState({ inspiringMovementAllyModal: result.payload });
                        break;
                    case 'arcaneWardRestore':
                        setModalState({ arcaneWardRestoreModal: result.payload });
                        break;
                    case 'oceanicGiftTarget':
                        setModalState({ oceanicGiftTargetModal: result.payload });
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
            result.logEntries.forEach(entry => addEntry(campaignName, entry).catch(() => { }));
        }

        if (result.type === 'popup' && (auto?.type === 'temp_buff' || auto?.type === 'combat_stance')) {
            if (onBuffsChange) onBuffsChange();
        }
    }

    const handleDivineInterventionCast = React.useCallback(async (selectedSpell) => {
        setModalState({ divineInterventionModal: null, divineInterventionAction: null });
        const action = modalState.divineInterventionAction;
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
    }, [modalState.divineInterventionAction, playerStats, campaignName, rollAttack, rollDamage, mapName, setPopupHtml, setModalState, characters]);


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

    const { pendingMetamagic: actionPendingMetamagic, gateMetamagic: actionGateMetamagic, handleConfirm: actionHandleConfirm, handleSkip: actionHandleSkip, pendingAid: actionPendingAid, handleAidConfirm: actionHandleAidConfirm, handleAidSkip: actionHandleAidSkip, pendingGreaterRestoration: actionPendingGreaterRestoration, handleGreaterRestorationConfirm: actionHandleGreaterRestorationConfirm, handleGreaterRestorationSkip: actionHandleGreaterRestorationSkip, pendingRemoveCurse: actionPendingRemoveCurse, handleRemoveCurseConfirm: actionHandleRemoveCurseConfirm, handleRemoveCurseSkip: actionHandleRemoveCurseSkip, pendingMagicMissile: actionPendingMagicMissile, handleMagicMissileConfirm: actionHandleMagicMissileConfirm, handleMagicMissileSkip: actionHandleMagicMissileSkip } = useSpellMetamagicFlow(playerStats, campaignName, actionCastAction, setModalState, characters);

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
                            }}>{getSpellDamageDisplay(spell)}</div>
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
                    modalState={modalState}
                    setModalState={setModalState}
                    combatSuperiorityModal={combatSuperiorityModal}
                    setCombatSuperiorityModal={setCombatSuperiorityModal}
                    handleCombatSuperiorityConfirm={handleCombatSuperiorityConfirm}
                    handleAttackRiderManeuverUse={handleAttackRiderManeuverUse}
                    handleAttackRiderManeuverSkip={handleAttackRiderManeuverSkip}
                    handleSweepingAttackConfirm={handleSweepingAttackConfirm}
                    handleBaitAndSwitchChoiceConfirm={handleBaitAndSwitchChoiceConfirm}
                    handleCommanderStrikeChoiceConfirm={handleCommanderStrikeChoiceConfirm}
                    handleRallyChoiceConfirm={handleRallyChoiceConfirm}
                    handleBulwarkOfForceConfirm={handleBulwarkOfForceConfirm}
                    handleNaturesSanctuaryConfirm={handleNaturesSanctuaryConfirm}
                    handleCoronaEnemySelectionConfirm={handleCoronaEnemySelectionConfirm}
                    handleRadianceOfDawnConfirm={handleRadianceOfDawnConfirm}
                    handleMantleOfInspirationConfirm={handleMantleOfInspirationConfirm}
                    handleTricksterBlessingConfirm={handleTricksterBlessingConfirm}
                    handleBardicInspirationConfirm={handleBardicInspirationConfirm}
                    handleInspiringMovementConfirm={handleInspiringMovementConfirm}
                    handleOceanicGiftConfirm={handleOceanicGiftConfirm}
                    handleDivineInterventionCast={handleDivineInterventionCast}
                    pendingDamage={pendingDamage}
                    buildCtx={buildCtx}
                    buildCtxSync={buildCtxSync}
                    autoDamageContext={autoDamageRollContext}
                    rollDamage={rollDamage}
                    setPopupHtml={setPopupHtml}
                    mapName={mapName}
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
                    handleRecklessAttackConfirm={handleRecklessAttackConfirm}
                    handleRecklessAttackCancel={handleRecklessAttackCancel}
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
                                    }).catch(() => { });
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
            {modalState.secondaryTargetModal && (
                <SecondaryTargetModal
                    title={modalState.secondaryTargetModal.title}
                    targets={modalState.secondaryTargetModal.targets}
                    onTargetSelected={modalState.secondaryTargetModal.onTargetSelected}
                    onSkip={modalState.secondaryTargetModal.onSkip}
                    featureDescription={modalState.secondaryTargetModal.featureDescription}
                    description={modalState.secondaryTargetModal.description}
                    confirmLabel={modalState.secondaryTargetModal.confirmLabel}
                />
            )}
        </div>
    )
}, areEqual);

export default CharActions
