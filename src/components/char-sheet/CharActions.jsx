import React, { useState, useEffect } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import AidTargetPopup from './popups/AidTargetPopup.jsx'
import GreaterRestorationPopup from './popups/GreaterRestorationPopup.jsx'
import RemoveCursePopup from './popups/RemoveCursePopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import EmpoweredSpellPopup from './popups/EmpoweredSpellPopup.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { parseMagicItemName } from '../../services/rules/core/attackCalc.js';
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import { useSpellUpcastFlow } from '../../hooks/useSpellUpcastFlow.js'
import { rollExpression, rollExpressionDoubled, rollExpressionMaximized } from '../../services/dice/diceRoller.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { computeFeatRangeEffects } from '../../services/character/featRangeService.js';
import { hasAutomation } from '../../services/combat/automationService.js'
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import HealingPoolModal from './modals/HealingPoolModal.jsx'
import HandOfHealingModal from './modals/HandOfHealingModal.jsx'
import FontOfMagicModal from './modals/FontOfMagicModal.jsx'
import ResourcePoolModal from './modals/ResourcePoolModal.jsx'
import WildCompanionModal from './modals/WildCompanionModal.jsx'
import SetConditionModal from './modals/SetConditionModal.jsx'
import EyebiteEffectModal from './modals/EyebiteEffectModal.jsx'
import DivineSparkModal from './modals/DivineSparkModal.jsx'
import DivineInterventionModal from './modals/DivineInterventionModal.jsx'
import AttackRiderModal from './modals/AttackRiderModal.jsx'
import OpenHandTechniqueModal from './modals/OpenHandTechniqueModal.jsx'
import WeaponMasteryModal from './modals/WeaponMasteryModal.jsx'
import WeaponMasteryChoiceModal from './modals/WeaponMasteryChoiceModal.jsx'
import BastionOfLawModal from './modals/BastionOfLawModal.jsx'
import CombatStanceModal from './modals/CombatStanceModal.jsx'
import TeleportModal from './modals/TeleportModal.jsx'
import HealingIllusionModal from './modals/HealingIllusionModal.jsx'
import SaveAttackHealModal from './modals/SaveAttackHealModal.jsx'
import MoonlightStepResourceModal from './modals/MoonlightStepResourceModal.jsx'
import ConstellationSelectionModal from './modals/ConstellationSelectionModal.jsx'
import ArcaneChargeModal from './modals/ArcaneChargeModal.jsx'
import WarMagicCantripModal from './modals/WarMagicCantripModal.jsx'
import WarMagicSpellModal from './modals/WarMagicSpellModal.jsx'
import SacredWeaponModal from './modals/SacredWeaponModal.jsx'
import ElderChampionRestoreModal from './modals/ElderChampionRestoreModal.jsx'
import PrimalCompanionBonusActionModal from './modals/PrimalCompanionBonusActionModal.jsx'
import MistyWandererModal from './modals/MistyWandererModal.jsx'
import BonusActionChoiceModal from './modals/BonusActionChoiceModal.jsx'
import RevelationInFleshModal from './modals/RevelationInFleshModal.jsx'
import ElementalAffinityModal from './modals/ElementalAffinityModal.jsx'
import FiendishResilienceModal from './modals/FiendishResilienceModal.jsx'
import BoonOfEnergyResistanceModal from './modals/BoonOfEnergyResistanceModal.jsx'
import DragonCompanionModal from './modals/DragonCompanionModal.jsx'
import WildMagicDoubleRollModal from './modals/WildMagicDoubleRollModal.jsx'
import WildMagicTamedModal from './modals/WildMagicTamedModal.jsx'
import SoulstitchSpellsModal from './modals/SoulstitchSpellsModal.jsx'
import IllusoryRealityModal from './modals/IllusoryRealityModal.jsx'
import CelestialRevelationModal from './modals/CelestialRevelationModal.jsx'
import ElfisLineageModal from './modals/ElfisLineageModal.jsx'
import GnomishLineageModal from './modals/GnomishLineageModal.jsx'
import FiendishLegacyModal from './modals/FiendishLegacyModal.jsx'
import GiantAncestryModal from './modals/GiantAncestryModal.jsx'
import BreathWeaponShapeModal from './modals/BreathWeaponShapeModal.jsx'
import HypnoticPatternShakeModal from './modals/HypnoticPatternShakeModal.jsx'
import CharBonusActions from './CharBonusActions.jsx'
import { executeHandler } from '../../services/automation/index.js';
import { onSpellSelected as onDivineInterventionSpellSelected } from '../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js';
import { getClassFeatures } from '../../services/character/classFeatures.js';
import { addEntry } from '../../services/ui/logService.js';
import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'
import { getTargetFromAttacker, getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { endFriendsOnHostileAction } from '../../services/rules/features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getNearestPlacedItem } from '../../services/rules/combat/rangeValidation.js';
import { getInnateSorceryBonus } from '../../services/combat/buffService.js';
import { buildAttackContext, buildAttackContextSync } from '../../services/automation/contextBuilder.js';
import { buildEmpoweredSpellState, executeEmpoweredReroll, getEmpoweredSpellDescription } from '../../services/rules/spells/empoweredSpellService.js';
import { hasEmpoweredEvocation, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { useActionSpellMetamagic } from '../../hooks/useActionSpellMetamagic.js';
import useCharActionModals from './useCharActionModals.js';
import DivinationSavantModal from './modals/DivinationSavantModal.jsx';
import { onDivinationSavantSelected } from '../../services/automation/handlers/class-wizard/divinationSavantHandler.js';
import IllusionSavantModal from './modals/IllusionSavantModal.jsx';
import { onIllusionSavantSelected } from '../../services/automation/handlers/class-wizard/illusionSavantHandler.js';
import { handleClearWard, handleSpendDice, handleApply } from '../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js';
import ThirdEyeModal from './modals/ThirdEyeModal.jsx';
import useInitiativeEffects from './useInitiativeEffects.js';
import './CharActions.css'
import { isEqual } from 'lodash';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function isElderChampionActive(playerName, campaignName) {
    try {
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        return activeBuffs.some(b => b.name === 'Elder Champion');
    } catch { return false; }
}

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats) && prevProps.conditionAttackMode === nextProps.conditionAttackMode && prevProps.exhaustionPenalty === nextProps.exhaustionPenalty && prevProps.cannotAct === nextProps.cannotAct;

const CharActions = React.memo(function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, onBuffsChange, characters }) {
    const [actions, setActions] = useState([]);
    const [selectedActionSpell, setSelectedActionSpell] = useState(null);
    const [featRangeEffects, setFeatRangeEffects] = useState(null);
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

    const { popupHtml, setPopupHtml, rollAttack, rollDamage, quickRollPlayerSave, triggerGloriousDefenseCounterAttack } = useLoggedDiceRoll(playerStats.name, campaignName, {
        characters,
        autoDamageRoll: async (autoDamage, isCrit) => {
            let autoFormula = autoDamage.formula;
            const hasEmpoweredEvoc = hasEmpoweredEvocation(playerStats);
            const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(playerStats) : 0;
            const spellSchool = (autoDamage.spellSchool || '').toLowerCase();
            const isEvocation = spellSchool === 'evocation';
            const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && empEvocIntMod > 0;
            if (shouldApplyEmpoweredEvoc) {
                autoFormula = `${autoFormula} + ${empEvocIntMod}[Empowered Evocation]`;
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
            if (overchannelResult) {
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
                rollDamage(autoDamage.name, autoFormula, overchannelResult.total, overchannelResult.rolls, overchannelResult.modifier, context);

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
                        }).catch(() => {});
                    }
                    const usesKey = '_Overchannel_uses';
                    const restKey = '_Overchannel_restTimestamp';
                    const now = Date.now();
                    const lastRestTimestamp = getRuntimeValue(playerStats.name, restKey, campaignName);
                    let currentUses;
                    if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
                        currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 1);
                    } else if (!lastRestTimestamp) {
                        currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 1);
                    } else {
                        currentUses = 1;
                    }
                    if (currentUses > 0) {
                        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
                    }
                }
            }
            // Remarkable Athlete: after critical hit, enable movement without opportunity attacks
            if (isCrit) {
                const hasRemarkableAthlete = (playerStats.automation?.passives || []).some(
                    p => p.type === 'auto_effect' && p.effect === 'remarkable_athlete_movement'
                );
                if (hasRemarkableAthlete) {
                    setRuntimeValue(playerStats.name, 'remarkableAthleteNoOA', Date.now(), campaignName);
                }
            }
        },
    });

    useInitiativeEffects(playerStats, campaignName, rollDamage);

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
        boonOfEnergyResistanceModal, setBoonOfEnergyResistanceModal,
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
        fiendishLegacyModal, setFiendishLegacyModal,
        giantAncestryModal, setGiantAncestryModal,
        eyebiteEffectModal, setEyebiteEffectModal,
        breathWeaponShapeModal, setBreathWeaponShapeModal,
        divineFuryChoice,
        damageTypeChoice,
        featureChoice, setFeatureChoice,
        handleDamageClick,
        handleMasteryClose,
        handleWeaponMasteryChoice,
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
        cleaveAttackPending,
        handleCleaveAttack,
        handleCleaveSkip,
        hypnoticPatternShakeModal, setHypnoticPatternShakeModal,
    } = useCharActionModals({
        playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects,
        popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
    });

    const handleAttackClick = React.useCallback((attack) => {
        if (cannotAct) return;
        // Making an attack roll ends any active Friends spell early
        endFriendsOnHostileAction(playerStats.name, campaignName);
        endInvisibilityOnHostileAction(playerStats.name, campaignName);
        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch(() => { });
    }, [cannotAct, buildCtx, rollAttack, exhaustionPenalty, playerStats.name, campaignName]);

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
                    case 'wildMagicTamed':
                        setWildMagicTamedModal(result.payload);
                        break;
                    case 'divinationSavant':
                        setDivinationSavantModal(result.payload);
                        break;
                    case 'illusionSavant':
                        setIllusionSavantModal(result.payload);
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
    }, [divineInterventionAction, playerStats, campaignName, rollAttack, rollDamage, mapName, setPopupHtml, setDivineInterventionModal, setDivineInterventionAction]);

    const handleDivinationSavantConfirm = React.useCallback(async (spell1, spell2) => {
        if (!divinationSavantModal) return;
        const result = await onDivinationSavantSelected(divinationSavantModal.payload.action, playerStats, campaignName, spell1, spell2);
        setDivinationSavantModal(null);
        if (result && result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }, [divinationSavantModal, playerStats, campaignName, setPopupHtml, setDivinationSavantModal]);

    const handleIllusionSavantConfirm = React.useCallback(async (spell1, spell2) => {
        if (!illusionSavantModal) return;
        const result = await onIllusionSavantSelected(illusionSavantModal.payload.action, playerStats, campaignName, spell1, spell2);
        setIllusionSavantModal(null);
        if (result && result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }, [illusionSavantModal, playerStats, campaignName, setPopupHtml, setIllusionSavantModal]);

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
    const elderChampionActive = isElderChampionActive(playerStats.name, campaignName);
    const actionSpells = playerStats.spellAbilities?.spells?.filter(spell => {
        const isAction = actionCastingTimes.includes(spell.casting_time);
        if (!isAction) return false;
        if (elderChampionActive) return false;
        return (spell.prepared === 'Always' || spell.prepared === 'Prepared') &&
            !actionAttackNames.has(spell.name) &&
            spell.damage
    }) || [];
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
    const { pendingMetamagic: actionPendingMetamagic, gateMetamagic: actionGateMetamagic, handleConfirm: actionHandleConfirm, handleSkip: actionHandleSkip, pendingAid: actionPendingAid, handleAidConfirm: actionHandleAidConfirm, handleAidSkip: actionHandleAidSkip, pendingGreaterRestoration: actionPendingGreaterRestoration, handleGreaterRestorationConfirm: actionHandleGreaterRestorationConfirm, handleGreaterRestorationSkip: actionHandleGreaterRestorationSkip, pendingRemoveCurse: actionPendingRemoveCurse, handleRemoveCurseConfirm: actionHandleRemoveCurseConfirm, handleRemoveCurseSkip: actionHandleRemoveCurseSkip } = useSpellMetamagicFlow(playerStats, campaignName, actionCastAction);
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
                                    <DiceRollResult {...popupHtml} onQuickRoll={popupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined} onCounterAttack={popupHtml.gloriousDefenseBonus > 0 && !popupHtml.hit && popupHtml.targetName ? triggerGloriousDefenseCounterAttack : undefined} />}
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
                        bloodiedOnly={healingPoolModal.bloodiedOnly}
                        restoringTouchConditions={healingPoolModal.restoringTouchConditions}
                        maxDicePerUse={healingPoolModal.maxDicePerUse}
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
                {resourcePoolModal && (
                    <ResourcePoolModal
                        playerStats={playerStats}
                        campaignName={campaignName}
                        automation={resourcePoolModal.automation}
                        onClose={() => setResourcePoolModal(null)}
                    />
                )}
                {moonlightStepResourceModal && (
                    <MoonlightStepResourceModal
                        playerStats={playerStats}
                        campaignName={campaignName}
                        automation={moonlightStepResourceModal.automation}
                        onClose={() => setMoonlightStepResourceModal(null)}
                    />
                )}
                {wildCompanionModal && (
                    <WildCompanionModal
                        playerStats={playerStats}
                        campaignName={campaignName}
                        onClose={() => setWildCompanionModal(null)}
                    />
                )}
                {setConditionModal && (
                    <SetConditionModal
                        {...setConditionModal}
                        characters={characters}
                        onClose={() => setSetConditionModal(null)}
                    />
                )}
                {eyebiteEffectModal && (
                    <EyebiteEffectModal
                        {...eyebiteEffectModal}
                        characters={characters}
                        onClose={() => setEyebiteEffectModal(null)}
                    />
                )}
                {attackRiderModal && (
                    <AttackRiderModal
                        {...attackRiderModal}
                        onClose={() => { setAttackRiderModal(null); window.dispatchEvent(new CustomEvent('target-effects-updated')); }}
                    />
                )}
                {openHandTechniqueModal && (
                    <OpenHandTechniqueModal
                        {...openHandTechniqueModal}
                        onClose={() => { setOpenHandTechniqueModal(null); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
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
                {weaponMasteryChoiceModal && (
                    <WeaponMasteryChoiceModal
                        {...weaponMasteryChoiceModal}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        onClose={() => { setWeaponMasteryChoiceModal(null); }}
                        onConfirm={handleWeaponMasteryChoice}
                    />
                )}
                {cleaveAttackPending && (
                    <div className="sp-overlay" onClick={handleCleaveSkip}>
                        <div className="sp-modal" onClick={e => e.stopPropagation()}>
                            <div className="sp-header">
                                <i className="fa-solid fa-crosshairs"></i> Cleave — Choose Second Target
                            </div>
                            <div className="sp-body">
                                <p>Choose a creature within 5 feet of the first target for the Cleave extra attack:</p>
                                <div style={{ textAlign: 'left', marginTop: '12px' }}>
                                    {cleaveAttackPending.secondTargets.map((target, i) => {
                                        const hp = target.currentHp ?? target.maxHp;
                                        const maxHp = target.maxHp;
                                        const pct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
                                        return (
                                            <label key={i} style={{
                                                display: 'block', padding: '8px 12px', margin: '4px 0',
                                                borderRadius: '6px', cursor: 'pointer',
                                                background: 'transparent',
                                                border: '1px solid transparent',
                                            }} onClick={() => handleCleaveAttack(target.name)}>
                                                <strong>{target.name}</strong>
                                                <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                                                    {hp}/{maxHp} HP ({pct}%)
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: '8px' }}>
                                    On a hit, the second creature takes weapon damage (no ability modifier to damage unless negative). Once per turn.
                                </p>
                            </div>
                            <div className="sp-actions">
                                <button className="sp-dismiss-btn" onClick={handleCleaveSkip}>Skip</button>
                            </div>
                        </div>
                    </div>
                )}
                {combatStanceModal && (
                    <CombatStanceModal
                        {...combatStanceModal}
                        onClose={() => { setCombatStanceModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    />
                )}
                {revelationInFleshModal && (
                    <RevelationInFleshModal
                        {...revelationInFleshModal}
                        onClose={() => { setRevelationInFleshModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    />
                )}
                {bastionOfLawModal && (
                    <BastionOfLawModal
                        {...bastionOfLawModal}
                        campaignName={campaignName}
                        onConfirm={async (spAmount, targetName, diceToSpend, clearWard) => {
                            if (clearWard) {
                                const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                                return await handleClearWard(action, playerStats, campaignName);
                            }
                            if (diceToSpend !== undefined && diceToSpend !== null) {
                                const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                                return await handleSpendDice(action, playerStats, campaignName, diceToSpend);
                            }
                            const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                            return await handleApply(action, playerStats, campaignName, spAmount, targetName);
                        }}
                        onClose={() => setBastionOfLawModal(null)}
                    />
                )}
                {teleportModal && (
                    <TeleportModal
                        {...teleportModal}
                        onClose={() => { setTeleportModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    />
                )}
                {healingIllusionModal && (
                    <HealingIllusionModal
                        {...healingIllusionModal}
                        onClose={() => { setHealingIllusionModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    />
                )}
                {saveAttackHealModal && (
                    <SaveAttackHealModal
                        {...saveAttackHealModal}
                        onClose={() => setSaveAttackHealModal(null)}
                    />
                )}
                {divineSparkModal && (
                    <DivineSparkModal
                        {...divineSparkModal}
                        playerStats={playerStats}
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
                {arcaneChargeModal && (
                    <ArcaneChargeModal
                        {...arcaneChargeModal}
                        onClose={() => setArcaneChargeModal(null)}
                    />
                )}
                {warMagicCantripModal && (
                    <WarMagicCantripModal
                        {...warMagicCantripModal}
                        onClose={() => setWarMagicCantripModal(null)}
                    />
                )}
                {warMagicSpellModal && (
                    <WarMagicSpellModal
                        {...warMagicSpellModal}
                        onClose={() => setWarMagicSpellModal(null)}
                    />
                )}
                {sacredWeaponModal && (
                    <SacredWeaponModal
                        {...sacredWeaponModal}
                        onClose={() => setSacredWeaponModal(null)}
                    />
                )}
                {elderChampionRestoreModal && (
                    <ElderChampionRestoreModal
                        action={elderChampionRestoreModal.payload.action}
                        playerStats={elderChampionRestoreModal.payload.playerStats}
                        campaignName={elderChampionRestoreModal.payload.campaignName}
                        onConfirm={() => {
                            handleElderChampionRestore(elderChampionRestoreModal.payload);
                            setElderChampionRestoreModal(null);
                        }}
                        onClose={() => setElderChampionRestoreModal(null)}
                    />
                )}
                {primalCompanionBonusActionModal && (
                    <PrimalCompanionBonusActionModal
                        {...primalCompanionBonusActionModal}
                        onClose={() => setPrimalCompanionBonusActionModal(null)}
                    />
                )}
                {mistyWandererModal && (
                    <MistyWandererModal
                        {...mistyWandererModal}
                        onClose={() => setMistyWandererModal(null)}
                    />
                )}
                {bonusActionChoiceModal && (
                    <BonusActionChoiceModal
                        {...bonusActionChoiceModal}
                        onClose={() => setBonusActionChoiceModal(null)}
                    />
                )}
                {bastionOfLawModal && (
                    <BastionOfLawModal
                        {...bastionOfLawModal}
                        onClose={() => setBastionOfLawModal(null)}
                    />
                )}
                {elementalAffinityModal && (
                    <ElementalAffinityModal
                        {...elementalAffinityModal}
                        onClose={() => setElementalAffinityModal(null)}
                    />
                )}
                {fiendishResilienceModal && (
                    <FiendishResilienceModal
                        {...fiendishResilienceModal}
                        onClose={() => setFiendishResilienceModal(null)}
                    />
                )}
                {boonOfEnergyResistanceModal && (
                    <BoonOfEnergyResistanceModal
                        {...boonOfEnergyResistanceModal}
                        onClose={() => setBoonOfEnergyResistanceModal(null)}
                    />
                )}
                {dragonCompanionModal && (
                    <DragonCompanionModal
                        {...dragonCompanionModal}
                        onClose={() => setDragonCompanionModal(null)}
                    />
                )}
                {wildMagicDoubleRollModal && (
                    <WildMagicDoubleRollModal
                        {...wildMagicDoubleRollModal}
                        onClose={() => setWildMagicDoubleRollModal(null)}
                    />
                )}
                {wildMagicTamedModal && (
                    <WildMagicTamedModal
                        {...wildMagicTamedModal}
                        onClose={() => setWildMagicTamedModal(null)}
                    />
                )}
                {divinationSavantModal && (
                    <DivinationSavantModal
                        payload={divinationSavantModal.payload}
                        onConfirm={handleDivinationSavantConfirm}
                        onClose={() => setDivinationSavantModal(null)}
                    />
                )}
                {illusionSavantModal && (
                    <IllusionSavantModal
                        payload={illusionSavantModal.payload}
                        onConfirm={handleIllusionSavantConfirm}
                        onClose={() => setIllusionSavantModal(null)}
                    />
                )}
                {thirdEyeModal && (
                    <ThirdEyeModal
                        action={thirdEyeModal.action}
                        playerStats={thirdEyeModal.playerStats}
                        campaignName={thirdEyeModal.campaignName}
                        onClose={() => setThirdEyeModal(null)}
                    />
                )}
                {soulstitchSpellsModal && (
                    <SoulstitchSpellsModal
                        {...soulstitchSpellsModal}
                        mapName={mapName}
                        onClose={() => setSoulstitchSpellsModal(null)}
                    />
                )}
                {illusoryRealityModal && (
                    <IllusoryRealityModal
                        {...illusoryRealityModal}
                        onClose={() => setIllusoryRealityModal(null)}
                    />
                )}
                {celestialRevelationModal && (
                    <CelestialRevelationModal
                        {...celestialRevelationModal}
                        onClose={() => setCelestialRevelationModal(null)}
                    />
                )}
                {elfishLineageModal && (
                    <ElfisLineageModal
                        {...elfishLineageModal}
                        onClose={() => setElfisLineageModal(null)}
                    />
                )}
                {gnomishLineageModal && (
                    <GnomishLineageModal
                        {...gnomishLineageModal}
                        onClose={() => setGnomishLineageModal(null)}
                    />
                )}
                {fiendishLegacyModal && (
                    <FiendishLegacyModal
                        {...fiendishLegacyModal}
                        onClose={() => setFiendishLegacyModal(null)}
                    />
                )}
                {giantAncestryModal && (
                    <GiantAncestryModal
                        {...giantAncestryModal}
                        onClose={() => setGiantAncestryModal(null)}
                    />
                )}
                {breathWeaponShapeModal && (
                    <BreathWeaponShapeModal
                        {...breathWeaponShapeModal}
                        onClose={() => setBreathWeaponShapeModal(null)}
                    />
                )}
                {hypnoticPatternShakeModal && (
                    <HypnoticPatternShakeModal
                        {...hypnoticPatternShakeModal}
                        onClose={() => setHypnoticPatternShakeModal(null)}
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
                    <div className="sp-overlay" onClick={() => {
                        if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedSkip();
                        else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierSkip();
                        else handleGenericDamageTypeSkip();
                    }}>
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
                                            onClick={() => {
                                                if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedChoice(type);
                                                else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierChoice(type);
                                                else handleGenericDamageTypeChoice(type);
                                            }}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="sp-actions">
                                <button className="sp-dismiss-btn" onClick={() => {
                                    if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedSkip();
                                    else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierSkip();
                                    else handleGenericDamageTypeSkip();
                                }}>Skip</button>
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
                                    {featureChoice.options.map((opt, i) => {
                                        const optName = typeof opt === 'string' ? opt : opt.name;
                                        return (
                                            <button
                                                key={optName || i}
                                                className="sp-roll-btn"
                                                style={{ margin: '0 6px 8px 6px' }}
                                                onClick={() => handleFeatureChoiceConfirm(optName)}
                                            >
                                                {optName}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="sp-actions">
                                <button className="sp-dismiss-btn" onClick={handleFeatureChoiceSkip}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
                {starryFormConstellationModal && (
                    <ConstellationSelectionModal
                        action={starryFormConstellationModal.payload.action}
                        playerStats={starryFormConstellationModal.payload.playerStats}
                        campaignName={starryFormConstellationModal.payload.campaignName}
                        isTwinkled={false}
                        onConfirm={(option) => handleConstellationSelect(starryFormConstellationModal.payload, option)}
                        onClose={() => setStarryFormConstellationModal(null)}
                    />
                )}
                {twinklingConstellationModal && (
                    <ConstellationSelectionModal
                        action={twinklingConstellationModal.payload.action}
                        playerStats={twinklingConstellationModal.payload.playerStats}
                        campaignName={twinklingConstellationModal.payload.campaignName}
                        isTwinkled={true}
                        onConfirm={(option) => handleConstellationSelect(twinklingConstellationModal.payload, option)}
                        onClose={() => setTwinklingConstellationModal(null)}
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
                {actionPendingAid && (
                    <AidTargetPopup
                        spell={{ name: actionPendingAid.spellName, level: actionPendingAid.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        range={actionPendingAid.range}
                        rangeFt={actionPendingAid.rangeFt}
                        creatureTargets={actionPendingAid.creatureTargets}
                        maxTargets={actionPendingAid.maxTargets}
                        attackerPos={actionPendingAid.attackerPos}
                        onConfirm={actionHandleAidConfirm}
                        onSkip={actionHandleAidSkip}
                    />
                )}
                {actionPendingGreaterRestoration && (
                    <GreaterRestorationPopup
                        spell={{ name: actionPendingGreaterRestoration.spellName, level: actionPendingGreaterRestoration.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        creatureTargets={actionPendingGreaterRestoration.creatureTargets}
                        range={actionPendingGreaterRestoration.range}
                        onConfirm={actionHandleGreaterRestorationConfirm}
                        onSkip={actionHandleGreaterRestorationSkip}
                    />
                )}
                {actionPendingRemoveCurse && (
                    <RemoveCursePopup
                        spell={{ name: actionPendingRemoveCurse.spellName, level: actionPendingRemoveCurse.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        creatureTargets={actionPendingRemoveCurse.creatureTargets}
                        range={actionPendingRemoveCurse.range}
                        onConfirm={actionHandleRemoveCurseConfirm}
                        onSkip={actionHandleRemoveCurseSkip}
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
