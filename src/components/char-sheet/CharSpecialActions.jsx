import { useState, useCallback, useEffect } from 'react';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { useCombatSuperiorityModal } from '../../hooks/combat/useCombatSuperiorityModal.js';
import { normalizeAutoDamage, resolveAttackDamageStandalone } from './useAttackDamageResolution.js';
import { applyTargetChoice as applyDestructiveStrideTargetChoice } from '../../services/automation/handlers/combat/destructiveStrideHandler.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { renderMarkdownInline } from '../../services/ui/sanitize.js';
import { loadFightingStyles } from '../../services/ui/dataLoader.js';
import { executeHandler } from '../../services/automation/index.js';
import { isInteractiveAutomation } from '../../services/combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js';
import { applyChoice } from '../../services/automation/handlers/class-ranger/defensiveTacticsHandler.js';
import { applyChoice as applyHunterPreyChoice } from '../../services/automation/handlers/class-ranger/hunterPreyHandler.js';
import { confirmTeleport } from '../../services/automation/handlers/class-warlock/tempTeleportHandler.js';
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';
import { onSpellMasterySelected } from '../../services/automation/handlers/class-wizard/spellMasteryHandler.js';
import { onSavantSelected } from '../../services/automation/handlers/class-wizard/SavantHandler.js';
import { applyPortentChoice } from '../../services/automation/handlers/class-wizard/portentHandler.js';
import { addEntry } from '../../services/ui/logService.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { confirmBolsteringPerformance } from '../../services/automation/handlers/buffs/tempHpBuffHandler.js';
import { confirmEncouragingSong, skipEncouragingSong } from '../../services/automation/handlers/buffs/encouragingSongHandler.js';
import { confirmElfisLineage } from '../../services/automation/handlers/class-other/elfishLineageHandler.js';
import { confirmGnomishLineage } from '../../services/automation/handlers/class-other/gnomishLineageHandler.js';
import CharSpecialActionsModals from './CharSpecialActionsModals.jsx';
import './CharSpecialActions.css';

// modalName -> setter for automation 'modal' results (exact-match dispatch map).
const MODAL_DISPATCH = {
    teleport: (payload, d) => d.setTeleportModal(payload),
    signatureSpells: (payload, d) => d.setSignatureSpellsModal(payload),
    spellMastery: (payload, d) => d.setSpellMasteryModal(payload),
    combatSuperiority: (payload, d) => d.setCombatSuperiorityModal(payload),
    weaponKindMastery: (payload, d) => d.setWeaponKindMasteryModal(payload),
    weaponMasteryChoice: (payload, d) => d.setWeaponMasteryChoiceModal(payload),
    resourcePool: (payload, d) => d.setResourcePoolModal(payload),
    naturalRecovery: (payload, d) => d.setNaturalRecoveryModal(payload),
    circleOfTheLandSpells: (payload, d) => d.setCircleOfTheLandSpellsModal(payload),
    moonlightStepFallback: (payload, d) => d.setMoonlightStepFallback(payload),
    elementalAffinity: (payload, d) => d.setElementalAffinityModal(payload),
    wildMagicSurge: (payload, d) => d.setWildMagicSurgeModal(payload),
    strideOfTheElements: (payload, d) => d.setStrideModal(payload),
    elementalEpitome: (payload, d) => d.setEpitomeModal(payload),
    destructiveStride: (payload, d) => d.setDestructiveStrideModal(payload),
    destructiveStrideTarget: (payload, d) => d.setDestructiveStrideTargetModal(payload),
    quiveringPalm: (payload, d) => d.setQuiveringPalmModal(payload),
    stepsOfTheFeyTaunt: (payload, d) => d.setStepsOfTheFeyTauntModal(payload),
    mistyWanderer: (payload, d) => d.setMistyWandererModal(payload),
    twinklingConstellation: (payload, d) => d.setTwinklingConstellationModal(payload),
    hurlThroughHell: (payload, d) => d.setHurlThroughHellModal(payload),
    clairvoyantCombatant: (payload, d) => d.setClairvoyantCombatantModal(payload),
    portentDiceChoice: (payload, d) => d.setPortentModal(payload),
    celestialResilienceModal: (payload, d) => d.setCelestialResilienceModal({ ...payload, playerStats: d.playerStats, campaignName: d.campaignName }),
    fiendishResilience: (payload, d) => d.setFiendishResilienceModal(payload),
    boonOfEnergyResistance: (payload, d) => d.setMultiResistanceModal(payload),
    bolsteringPerformanceTarget: (payload, d) => d.setBolsteringPerformanceModal(payload),
    encouragingSongTarget: (payload, d) => d.setEncouragingSongModal(payload),
    elfishLineage: (payload, d) => d.setElfisLineageModal(payload),
    gnomishLineage: (payload, d) => d.setGnomishLineageModal(payload),
    feyReinforcements: (payload, d) => d.setFeyReinforcementsModal(payload),
    fiendishLegacy: (payload, d) => d.setFiendishLegacyModal(payload),
};

function dispatchModalResult(modalName, payload, d) {
    if (modalName?.includes('Savant')) {
        d.setSavantModal(payload);
        return;
    }
    const setter = MODAL_DISPATCH[modalName];
    if (setter) setter(payload, d);
}

// Build the dismissable popup HTML for a generic automation popup result.
function buildAutomationPopupHtml(payload, action) {
    const name = payload?.name || action?.name || 'Automation';
    const description = payload?.description || '';
    return `<b>${name}</b><br/>${description}<br/><span class="dice-roll-hint">click to dismiss</span>`;
}

function showPayloadPopup(result, setPopupHtml) {
    if (result?.payload) {
        setPopupHtml(`<b>${result.payload.name}</b><br/>${result.payload.description}<br/><span class="dice-roll-hint">click to dismiss</span>`);
    }
}

// Deduplicated players + non-player combat creatures, for target-choice distribution.
function buildDistributeTargetList(characters, combatSummary) {
    const allCreatures = [
        ...(characters || []).map(c => ({ name: c.name, type: 'player' })),
        ...(combatSummary?.creatures || []).filter(c => c.type !== 'player').map(c => ({ name: c.name, type: 'monster' }))
    ];
    const seen = new Set();
    return allCreatures.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
}

const FIGHTING_STYLE_NAMES = ['Great Weapon Fighting', 'Interception', 'Protection', 'Two-Weapon Fighting'];

// First fighting style that isn't already a special action, appended if it exists in the map.
function appendFightingStyles(specialActions, fightingStylesMap, fightingStyles) {
    const match = FIGHTING_STYLE_NAMES.find(name => fightingStyles.includes(name) && !specialActions.find(sa => sa.name === name));
    if (match && fightingStylesMap[match]) specialActions.push(fightingStylesMap[match]);
}

// Build the Special Actions list: fighting-style additions, minus actions shown elsewhere.
function buildUniqueSpecialActions(playerStats, fightingStylesMap) {
    const specialActions = [...(playerStats.specialActions || [])];
    if (fightingStylesMap && playerStats.class.fightingStyles) {
        appendFightingStyles(specialActions, fightingStylesMap, playerStats.class.fightingStyles);
    }
    const actionNames = new Set(playerStats.actions?.map(action => action.name) || []);
    const bonusActionNames = new Set(playerStats.bonusActions?.map(action => action.name) || []);
    const reactionNames = new Set(playerStats.reactions?.map(action => action.name) || []);
    const characterAdvancementNames = new Set(playerStats.characterAdvancement?.map(feature => feature.name) || []);
    const categories = getCategories(playerStats.rules || '5e');
    const filteredActions = specialActions.filter(action =>
          !actionNames.has(action.name) &&
          !bonusActionNames.has(action.name) &&
          !reactionNames.has(action.name) &&
          !characterAdvancementNames.has(action.name) &&
          !categories.featuresToIgnore.includes(action.name) &&
          !(action.name && action.name.startsWith('Level 1 Spell [Instance'))
      );
    return Array.from(new Map(filteredActions.map(action => [action.name, action])).values());
}

function CharSpecialActions({ playerStats, campaignName, cannotAct, characters, mapName }) {
    const [teleportModal, setTeleportModal] = useState(null);
    const [moonlightStepFallback, setMoonlightStepFallback] = useState(null);
    const [signatureSpellsModal, setSignatureSpellsModal] = useState(null);
    const [spellMasteryModal, setSpellMasteryModal] = useState(null);
    const [savantModal, setSavantModal] = useState(null);
    const [weaponKindMasteryModal, setWeaponKindMasteryModal] = useState(null);
    const [weaponMasteryChoiceModal, setWeaponMasteryChoiceModal] = useState(null);
    const [resourcePoolModal, setResourcePoolModal] = useState(null);
    const [naturalRecoveryModal, setNaturalRecoveryModal] = useState(null);
    const [circleOfTheLandSpellsModal, setCircleOfTheLandSpellsModal] = useState(null);
    const [featureChoiceModal, setFeatureChoiceModal] = useState(null);
    const [aspectOfTheWildsModal, setAspectOfTheWildsModal] = useState(null);
    const [elementalAffinityModal, setElementalAffinityModal] = useState(null);
    const [wildMagicSurgeModal, setWildMagicSurgeModal] = useState(null);
    const [strideModal, setStrideModal] = useState(null);
    const [epitomeModal, setEpitomeModal] = useState(null);
    const [destructiveStrideModal, setDestructiveStrideModal] = useState(null);
    const [destructiveStrideTargetModal, setDestructiveStrideTargetModal] = useState(null);
    const [quiveringPalmModal, setQuiveringPalmModal] = useState(null);
    const [celestialResilienceModal, setCelestialResilienceModal] = useState(null);
    const [fiendishResilienceModal, setFiendishResilienceModal] = useState(null);
    const [fiendishLegacyModal, setFiendishLegacyModal] = useState(null);
    const [multiResistanceModal, setMultiResistanceModal] = useState(null);
    const [stepsOfTheFeyTauntModal, setStepsOfTheFeyTauntModal] = useState(null);
    const [mistyWandererModal, setMistyWandererModal] = useState(null);
    const [twinklingConstellationModal, setTwinklingConstellationModal] = useState(null);
    const [hurlThroughHellModal, setHurlThroughHellModal] = useState(null);
    const [clairvoyantCombatantModal, setClairvoyantCombatantModal] = useState(null);
    const [portentModal, setPortentModal] = useState(null);
    const [replenishingMealModal, setReplenishingMealModal] = useState(null);
    const [bolsteringTreatsModal, setBolsteringTreatsModal] = useState(null);
    const [bolsteringPerformanceModal, setBolsteringPerformanceModal] = useState(null);
    const [encouragingSongModal, setEncouragingSongModal] = useState(null);
    const [elfishLineageModal, setElfisLineageModal] = useState(null);
    const [gnomishLineageModal, setGnomishLineageModal] = useState(null);
    const [feyReinforcementsModal, setFeyReinforcementsModal] = useState(null);
    const [fightingStylesMap, setFightingStylesMap] = useState(null);
    const { setPopupHtml } = useDiceRollPopup();
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats?.name, campaignName, {
        characters,
        autoDamageSource: 'char-special-actions',
        autoDamageRoll: async (autoDamage, isCrit) => {
            const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit, playerStats);
            await resolveAttackDamageStandalone(attack, ctxOverrides, { playerStats, campaignName, setPopupHtml, rollDamage, setModalState: () => {} });
            if (autoDamage.ripostePopup) {
                const payload = autoDamage.ripostePopup;
                const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                setPopupHtml(html);
            }
        },
    });
    const {
        combatSuperiorityModal,
        setCombatSuperiorityModal,
        handleCombatSuperiorityConfirm,
        handleCombatSuperiorityReopenSelection,
    } = useCombatSuperiorityModal(playerStats, campaignName, rollAttack, rollDamage, setPopupHtml);
    const hasReplenishingMeal = (playerStats.automation?.passives ?? []).some(
        p => p.type === 'passive_rule' && p.effect === 'bonus_healing' && p.name === 'Replenishing Meal'
    );
    const replenishingMeals = useRuntimeValue(playerStats.name, 'replenishingMeals', campaignName);
    const replenishingMealMax = hasReplenishingMeal ? 4 + (playerStats.proficiency || 0) : 0;
    const handleReplenishingMealClick = useCallback(async () => {
        if (cannotAct) return;
        if (!hasReplenishingMeal) return;
        const current = Number(replenishingMeals ?? replenishingMealMax);
        if (current <= 0) {
            setPopupHtml('<b>Replenishing Meal</b><br/>No meals remaining.<br/><span class="dice-roll-hint">click to dismiss</span>');
            return;
        }
        const combatSummary = await getCombatContext(campaignName);
        const targets = buildDistributeTargetList(characters, combatSummary);
        setReplenishingMealModal({ targets, maxTargets: current });
    }, [cannotAct, hasReplenishingMeal, replenishingMeals, replenishingMealMax, campaignName, characters, setPopupHtml]);
    const handleReplenishingMealConfirm = useCallback(async (selectedNames) => {
        if (!replenishingMealModal) return;
        const { maxTargets } = replenishingMealModal;
        const count = Math.min(selectedNames.length, maxTargets);
        for (const name of selectedNames.slice(0, count)) {
            setRuntimeValue(name, 'replenishingMeals', 1, campaignName);
        }
        const current = Number(replenishingMeals ?? replenishingMealMax);
        setRuntimeValue(playerStats.name, 'replenishingMeals', Math.max(0, current - count), campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Replenishing Meal',
            description: `${playerStats.name} distributed ${count} replenishing meal${count > 1 ? 's' : ''} to ${selectedNames.slice(0, count).join(', ')}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[charSpecialActions:log-error]", e); });
        const html = `<b>Replenishing Meal</b><br/>Granted ${count} meal${count > 1 ? 's' : ''} to: ${selectedNames.slice(0, count).join(', ')}.<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
        setReplenishingMealModal(null);
    }, [replenishingMealModal, replenishingMeals, replenishingMealMax, campaignName, setPopupHtml, playerStats.name]);
    const hasBolsteringTreats = (playerStats.automation?.specialActions ?? []).some(
        p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
    );
    const chefBolsteringTreats = useRuntimeValue(playerStats.name, 'chefBolsteringTreats', campaignName);
    const bolsteringTreatsMax = hasBolsteringTreats ? (playerStats.proficiency || 0) : 0;
    const handleBolsteringTreatsClick = useCallback(async () => {
        if (cannotAct) return;
        if (!hasBolsteringTreats) return;
        const current = Number(chefBolsteringTreats ?? bolsteringTreatsMax);
        if (current <= 0) {
            setPopupHtml('<b>Bolstering Treats</b><br/>No treats remaining.<br/><span class="dice-roll-hint">click to dismiss</span>');
            return;
        }
        const combatSummary = await getCombatContext(campaignName);
        const targets = buildDistributeTargetList(characters, combatSummary);
        setBolsteringTreatsModal({ targets, maxTargets: current });
    }, [cannotAct, hasBolsteringTreats, chefBolsteringTreats, bolsteringTreatsMax, campaignName, characters, setPopupHtml]);
    const handleBolsteringTreatsConfirm = useCallback(async (selectedNames) => {
        if (!bolsteringTreatsModal) return;
        const { maxTargets } = bolsteringTreatsModal;
        const count = Math.min(selectedNames.length, maxTargets);
        for (const name of selectedNames.slice(0, count)) {
            setRuntimeValue(name, 'bolsteringTreat', 1, campaignName);
        }
        const current = Number(chefBolsteringTreats ?? bolsteringTreatsMax);
        setRuntimeValue(playerStats.name, 'chefBolsteringTreats', Math.max(0, current - count), campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Bolstering Treats',
            description: `${playerStats.name} distributed ${count} bolstering treat${count > 1 ? 's' : ''} to ${selectedNames.slice(0, count).join(', ')}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[charSpecialActions:log-error]", e); });
        const html = `<b>Bolstering Treats</b><br/>Granted ${count} treat${count > 1 ? 's' : ''} to: ${selectedNames.slice(0, count).join(', ')}.<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
        setBolsteringTreatsModal(null);
    }, [bolsteringTreatsModal, chefBolsteringTreats, bolsteringTreatsMax, campaignName, setPopupHtml, playerStats.name]);
    const hasPoisonerFeat = (playerStats.automation?.specialActions ?? []).some(
        p => p.type === 'brew_poison' && p.name === 'Brew Poison'
    );
    const poisonDoses = useRuntimeValue(playerStats.name, 'poisonDoses', campaignName);
    const poisonDosesMax = hasPoisonerFeat ? (playerStats.proficiency || 0) : 0;
    const handleBrewPoisonClick = useCallback(async () => {
        if (cannotAct) return;
        if (!hasPoisonerFeat) return;
        const current = Number(poisonDoses ?? 0);
        const max = poisonDosesMax;
        if (current >= max) {
            const html = `<b>Brew Poison</b><br/>Poison doses are already at maximum (${max}/${max}).<br/>Cost: 50 GP + 1 hour using a Poisoner's Kit.<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
            return;
        }
        const allItems = [
            ...(playerStats.inventory?.equipped || []),
            ...(playerStats.inventory?.backpack || []),
        ];
        const hasPoisonersKit = allItems.some(item => {
            const itemName = typeof item === 'string' ? item : (item.name || '');
            return itemName.toLowerCase().includes("poisoner's kit");
        });
        if (!hasPoisonersKit) {
            const html = `<b>Brew Poison</b><br/>You need a Poisoner's Kit in your inventory (equipped or backpack) to brew poison.<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
            return;
        }
        const existingGold = Number(getRuntimeValue(playerStats.name, 'gold', campaignName) ?? playerStats.inventory?.gold ?? 0);
        if (existingGold < 50) {
            const html = `<b>Brew Poison</b><br/>You need at least 50 GP to brew poison. You have ${existingGold} GP.<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
            return;
        }
        setRuntimeValue(playerStats.name, 'gold', existingGold - 50, campaignName);
        setRuntimeValue(playerStats.name, 'poisonDoses', max, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Brew Poison',
            description: `${playerStats.name} brewed poison doses using a Poisoner's Kit, expending 50 GP and 1 hour. Doses: ${max}/${max}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[charSpecialActions:log-error]", e); });
        const html = `<b>Brew Poison</b><br/>Brewed ${max - current} poison dose${max - current !== 1 ? 's' : ''} using a Poisoner's Kit (50 GP, 1 hour). Poison Doses: ${max}/${max}.<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [cannotAct, hasPoisonerFeat, poisonDoses, poisonDosesMax, campaignName, setPopupHtml, playerStats.inventory, playerStats.name]);
    const handleBolsteringPerformanceConfirm = useCallback(async (selectedTargets) => {
        if (!bolsteringPerformanceModal) return;
        const result = await confirmBolsteringPerformance(
            bolsteringPerformanceModal.action,
            bolsteringPerformanceModal.playerStats,
            bolsteringPerformanceModal.campaignName,
            selectedTargets,
            bolsteringPerformanceModal.tempHp
        );
        showPayloadPopup(result, setPopupHtml);
        setBolsteringPerformanceModal(null);
    }, [bolsteringPerformanceModal, setPopupHtml]);
    const handleEncouragingSongConfirm = useCallback(async (selectedTargets) => {
        if (!encouragingSongModal) return;
        const result = await confirmEncouragingSong(
            encouragingSongModal.action,
            encouragingSongModal.playerStats,
            encouragingSongModal.campaignName,
            selectedTargets
        );
        showPayloadPopup(result, setPopupHtml);
        setEncouragingSongModal(null);
    }, [encouragingSongModal, setPopupHtml]);
    const handleEncouragingSongSkip = useCallback(async () => {
        if (!encouragingSongModal) return;
        const result = await skipEncouragingSong(
            encouragingSongModal.action,
            encouragingSongModal.playerStats,
            encouragingSongModal.campaignName
        );
        showPayloadPopup(result, setPopupHtml);
        setEncouragingSongModal(null);
    }, [encouragingSongModal, setPopupHtml]);
    const handleElfisLineageConfirm = useCallback(async (chosenLineage, playerStats, campaignName) => {
        if (!elfishLineageModal) return;
        const result = await confirmElfisLineage(playerStats, chosenLineage, campaignName);
        showPayloadPopup(result, setPopupHtml);
        setElfisLineageModal(null);
    }, [elfishLineageModal, setPopupHtml]);
    const handleGnomishLineageConfirm = useCallback(async (chosenLineage, playerStats, campaignName) => {
        if (!gnomishLineageModal) return;
        const result = await confirmGnomishLineage(playerStats, chosenLineage, campaignName);
        showPayloadPopup(result, setPopupHtml);
        setGnomishLineageModal(null);
    }, [gnomishLineageModal, setPopupHtml]);
    useEffect(() => {
        let cancelled = false;
        loadFightingStyles().then(styles => {
            if (cancelled) return;
            const map = {};
            styles.forEach(s => { map[s.name] = s; });
            setFightingStylesMap(map);
        });
        return () => { cancelled = true; };
    }, []);
    const handleFeatureChoiceConfirm = useCallback(async (choice) => {
        if (!featureChoiceModal) return;
        const { action, optionKey } = featureChoiceModal;
        if (action.automation?.type === 'defensive_tactics') {
            const result = await applyChoice(playerStats, campaignName, choice);
            if (result?.type === 'popup') {
                setPopupHtml(result.payload);
            }
            setFeatureChoiceModal(null);
            return;
        }
        if (action.automation?.type === 'hunter_prey') {
            const result = await applyHunterPreyChoice(playerStats, campaignName, choice);
            if (result?.type === 'popup') {
                setPopupHtml(result.payload);
            }
            setFeatureChoiceModal(null);
            return;
        }
        setRuntimeValue(playerStats.name, optionKey, choice, campaignName);
        setFeatureChoiceModal(null);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `Chose option: ${choice}`,
        }).catch((e) => { console.error("[charSpecialActions:log-error]", e); });
        const restMessage = (action.automation?.type === 'defensive_tactics' || action.automation?.type === 'hunter_prey')
            ? 'This choice can be changed on a Short Rest or Long Rest.'
            : 'This choice can be changed by clicking the feature again.';
        const html = `<b>${action.name}</b><br/>Option chosen: <b>${choice}</b>. ${restMessage}`;
        setPopupHtml(html);
    }, [featureChoiceModal, playerStats, campaignName, setPopupHtml]);
    const handleFeatureChoiceSkip = useCallback(() => {
        setFeatureChoiceModal(null);
    }, []);
    const handleAspectOfTheWildsConfirm = useCallback(async (choice) => {
        const existingBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
        const currentBuffs = Array.isArray(existingBuffs) ? [...existingBuffs] : [];
        const aspectBuffIndex = currentBuffs.findIndex(b => b.name === 'Aspect of the Wilds');
        if (aspectBuffIndex !== -1) {
            currentBuffs[aspectBuffIndex] = {
                name: 'Aspect of the Wilds',
                effect: choice === 'Owl' ? 'darkvision_aspect' : choice === 'Panther' ? 'climb_speed_aspect' : 'swim_speed_aspect',
                duration: 'infinite',
                optionName: choice,
            };
        } else {
            currentBuffs.push({
                name: 'Aspect of the Wilds',
                effect: choice === 'Owl' ? 'darkvision_aspect' : choice === 'Panther' ? 'climb_speed_aspect' : 'swim_speed_aspect',
                duration: 'infinite',
                optionName: choice,
            });
        }
        setRuntimeValue(playerStats.name, 'activeBuffs', currentBuffs, campaignName);
        setRuntimeValue(playerStats.name, 'aspectOfTheWildsOption', choice, campaignName);
        setRuntimeValue(playerStats.name, 'aspectOfTheWildsUsedThisRest', true, campaignName);
        setAspectOfTheWildsModal(null);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Aspect of the Wilds',
            description: `Chose ${choice} aspect`,
        }).catch((e) => { console.error("[charSpecialActions:log-error]", e); });
        const effects = {
            Owl: 'Darkvision 60 ft.',
            Panther: 'Climb speed equal to walking speed',
            Salmon: 'Swim speed equal to walking speed',
        };
        const html = `<b>Aspect of the Wilds</b><br/>Chose <b>${choice}</b>: ${effects[choice]}<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [playerStats, campaignName, setPopupHtml]);
    const handleAspectOfTheWildsSkip = useCallback(() => {
        setAspectOfTheWildsModal(null);
    }, []);
    const handleAutomationClick = useCallback(async (action) => {
        if (cannotAct) return;
        const auto = action.automation;
        if (auto?.type === 'defensive_tactics') {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setFeatureChoiceModal({ action, options: ['Escape the Horde', 'Multiattack Defense'], optionKey });
                return;
            }
        }
        if (auto?.type === 'hunter_prey') {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setFeatureChoiceModal({ action, options: ['Colossus Slayer', 'Horde Breaker'], optionKey });
                return;
            }
        }
        if (auto?.type === 'damage_bonus' && auto.options?.length > 0 && auto.options.every(o => typeof o === 'string')) {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
            setFeatureChoiceModal({ action, options: auto.options, optionKey });
            return;
        }
        if (auto?.type === 'animal_aspect') {
            const alreadyUsed = getRuntimeValue(playerStats.name, 'aspectOfTheWildsUsedThisRest', campaignName);
            if (alreadyUsed) {
                const html = `<b>Aspect of the Wilds</b><br/>Already chosen this rest. It can be changed after a Long Rest.<br/><span class="dice-roll-hint">click to dismiss</span>`;
                setPopupHtml(html);
                return;
            }
            setAspectOfTheWildsModal(true);
            return;
        }
        if (auto?.type === 'passive_rule' && auto?.effect === 'bonus_healing') {
            handleReplenishingMealClick();
            return;
        }
        if (auto?.type === 'temp_hp_buff' && auto?.craftCount) {
            handleBolsteringTreatsClick();
            return;
        }
        if (auto?.type === 'brew_poison') {
            handleBrewPoisonClick();
            return;
        }
        if (auto?.type === 'memorize_spell') {
            // CLA-226: the swap UI lives in the Short Rest modal — open it (CharSummary listens).
            window.dispatchEvent(new CustomEvent('open-short-rest'));
            return;
        }
        const result = await executeHandler(action, playerStats, campaignName, mapName, characters);
        if (!result) return;
        if (result.type === 'modal') {
            dispatchModalResult(result.modalName, result.payload, {
                playerStats, campaignName,
                setTeleportModal, setSignatureSpellsModal, setSpellMasteryModal, setSavantModal,
                setCombatSuperiorityModal, setWeaponKindMasteryModal, setWeaponMasteryChoiceModal,
                setResourcePoolModal, setNaturalRecoveryModal, setCircleOfTheLandSpellsModal,
                setMoonlightStepFallback, setElementalAffinityModal, setWildMagicSurgeModal,
                setStrideModal, setEpitomeModal, setDestructiveStrideModal, setDestructiveStrideTargetModal,
                setQuiveringPalmModal, setStepsOfTheFeyTauntModal, setMistyWandererModal,
                setTwinklingConstellationModal, setHurlThroughHellModal, setClairvoyantCombatantModal,
                setPortentModal, setCelestialResilienceModal, setFiendishResilienceModal,
                setMultiResistanceModal, setBolsteringPerformanceModal, setEncouragingSongModal,
                setElfisLineageModal, setGnomishLineageModal, setFeyReinforcementsModal, setFiendishLegacyModal,
            });
        } else if (result.type === 'popup') {
            setPopupHtml(buildAutomationPopupHtml(result.payload, action));
        }
    }, [playerStats, campaignName, cannotAct, mapName, characters, setCombatSuperiorityModal, setPopupHtml, handleReplenishingMealClick, handleBolsteringTreatsClick, handleBrewPoisonClick, setFeyReinforcementsModal, setGnomishLineageModal]);
    const handleStrideConfirm = useCallback(async (optionName, buffEntry) => {
        if (!strideModal) return;
        const { action, playerStats: modalPlayerStats, campaignName: modalCampaign } = strideModal;
        setStrideModal(null);
        const stored = getRuntimeValue(modalPlayerStats.name, 'activeBuffs', modalCampaign);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const existingStride = activeBuffs.find(b => b.name === 'Stride of the Elements');
        const newBuffs = existingStride
            ? activeBuffs.map(b => b.name === 'Stride of the Elements' ? { ...b, ...buffEntry } : b)
            : [...activeBuffs, { name: 'Stride of the Elements', ...buffEntry }];
        await setRuntimeValue(modalPlayerStats.name, 'activeBuffs', newBuffs, modalCampaign);
        const descriptions = {
            'Ice Walk': 'You can walk across and climb icy or wet surfaces without needing to make an Ability Check. You ignore difficult terrain that is composed of ice or snow.',
            '+10 Speed': 'Your Speed increases by 10 feet.',
            'Fly Speed': 'You gain a Fly Speed equal to your Speed.',
            'Teleport 30 ft': 'You can teleport up to 30 ft to an unoccupied space you can see.',
        };
        const description = `Chose ${optionName}: ${descriptions[optionName] || optionName}`;
        await addEntry(modalCampaign, {
            type: 'ability_use',
            characterName: modalPlayerStats.name,
            abilityName: action.name,
            description,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[StrideOfTheElements] Error logging:', e); });
        const html = `<b>${action.name}</b><br/>Chose <strong>${optionName}</strong>. ${descriptions[optionName] || optionName}<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [strideModal, setPopupHtml]);
    const handleCelestialResilienceConfirm = useCallback(async (selectedTargets) => {
        if (!celestialResilienceModal) return;
        const { action, playerStats: modalPlayerStats, campaignName: modalCampaign, allyTempHp } = celestialResilienceModal;
        if (!selectedTargets || selectedTargets.length === 0) {
            setPopupHtml(`<b>${action.name}</b><br/>No allies selected.<br/><span class="dice-roll-hint">click to dismiss</span>`);
            setCelestialResilienceModal(null);
            return;
        }
        for (const targetName of selectedTargets) {
            await setTempHp(targetName, allyTempHp, modalCampaign);
        }
        await addEntry(modalCampaign, {
            type: 'ability_use',
            characterName: modalPlayerStats.name,
            abilityName: action.name,
            description: `${modalPlayerStats.name} grants ${allyTempHp} temporary hit points to ${selectedTargets.join(', ')}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[celestialResilience] Error logging:', e); });
        const html = `<b>${action.name}</b><br/>Granted ${allyTempHp} temporary hit points to ${selectedTargets.join(', ')}.<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
        setCelestialResilienceModal(null);
    }, [celestialResilienceModal, setPopupHtml]);
    const handleCelestialResilienceSkip = useCallback(() => {
        if (!celestialResilienceModal) return;
        const { action } = celestialResilienceModal;
        setPopupHtml(`<b>${action.name}</b><br/>No allies selected.<br/><span class="dice-roll-hint">click to dismiss</span>`);
        setCelestialResilienceModal(null);
    }, [celestialResilienceModal, setPopupHtml]);
    const handleEpitomeConfirm = useCallback(async (payload) => {
        if (!epitomeModal) return;
        const { action } = epitomeModal;
        setEpitomeModal(null);
        const html = `<b>${action.name}</b><br/>${payload?.description || 'Elemental Epitome activated.'}<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [epitomeModal, setPopupHtml]);
    const handleEpitomeClose = useCallback(() => {
        setEpitomeModal(null);
    }, []);
    const handleDestructiveStrideConfirm = useCallback(async (result) => {
        setDestructiveStrideModal(null);
        if (result?.type === 'modal' && result.modalName === 'destructiveStrideTarget') {
            setDestructiveStrideTargetModal(result.payload);
        } else if (result?.type === 'popup') {
            const html = `<b>${result.payload?.name || 'Destructive Stride'}</b><br/>${result.payload?.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [setPopupHtml]);
    const handleDestructiveStrideTargetConfirm = useCallback(async (targetName) => {
        if (!destructiveStrideTargetModal) return;
        const { action, playerStats: modalPlayerStats, campaignName: modalCampaign, chosenType, martialArtsDie } = destructiveStrideTargetModal;
        setDestructiveStrideTargetModal(null);
        const result = await applyDestructiveStrideTargetChoice(action, modalPlayerStats, modalCampaign, targetName, chosenType, martialArtsDie);
        if (result?.type === 'popup') {
            const html = `<b>${result.payload?.name || 'Destructive Stride'}</b><br/>${result.payload?.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [destructiveStrideTargetModal, setPopupHtml]);
    const handleDestructiveStrideTargetSkip = useCallback(() => {
        setDestructiveStrideTargetModal(null);
    }, []);
    const handleMoonlightStepFallbackConfirm = useCallback(async () => {
        if (!moonlightStepFallback) return;
        const { action, playerStats: fallbackStats, campaignName: fallbackCampaign, slotLevel } = moonlightStepFallback;
        setMoonlightStepFallback(null);
        const res = await confirmTeleport(action, fallbackStats, fallbackCampaign, false, slotLevel);
        if (res?.type === 'popup') {
            const payload = res.payload;
            const html = `<b>${payload.name || action.name}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [moonlightStepFallback, setPopupHtml]);
    const handleSignatureSpellsConfirm = useCallback(async (spell1, spell2) => {
        if (!signatureSpellsModal) return;
        const result = await onSignatureSpellsSelected(signatureSpellsModal.action, playerStats, campaignName, spell1, spell2);
        setSignatureSpellsModal(null);
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-magic"></i> ${payload.name || 'Signature Spells'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [signatureSpellsModal, playerStats, campaignName, setPopupHtml]);
    const handleSpellMasteryConfirm = useCallback(async (spell1, spell2) => {
        if (!spellMasteryModal) return;
        const result = await onSpellMasterySelected(spellMasteryModal.action, playerStats, campaignName, spell1, spell2);
        setSpellMasteryModal(null);
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-magic"></i> ${payload.name || 'Spell Mastery'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [spellMasteryModal, playerStats, campaignName, setPopupHtml]);
    const handleSavantConfirm = useCallback(async (spell1, spell2) => {
        if (!savantModal) return;
        const result = await onSavantSelected(savantModal.action, playerStats, campaignName, spell1, spell2, savantModal.school);
        setSavantModal(null);
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-magic"></i> ${payload.name || savantModal.school} Savant</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [savantModal, playerStats, campaignName, setPopupHtml]);
    const handlePortentDieChoice = useCallback(async (chosenDie) => {
        if (!portentModal) return;
        const { action, playerStats: ps, campaignName: cn, targetName, eventType, eventData, context } = portentModal;
        try {
            const result = await applyPortentChoice(action, ps, cn, targetName, eventType, eventData, context, chosenDie);
            setPortentModal(null);
            if (result?.type === 'popup') {
                const payload = result.payload;
                const html = `<b>${payload.name || 'Portent'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                setPopupHtml(html);
            }
        } catch (e) {
            console.error('[Portent] Failed to apply die choice:', e);
            setPortentModal(null);
        }
    }, [portentModal, setPopupHtml]);
    const handlePortentModalClose = useCallback(() => {
        setPortentModal(null);
    }, []);
    const uniqueActions = buildUniqueSpecialActions(playerStats, fightingStylesMap);
    return (
            <div className='char-special-actions'>
                <div className='sectionHeader'>Special Actions</div>
                <CharSpecialActionsModals
                teleportModal={teleportModal} setTeleportModal={setTeleportModal}
                moonlightStepFallback={moonlightStepFallback} setMoonlightStepFallback={setMoonlightStepFallback}
                signatureSpellsModal={signatureSpellsModal} setSignatureSpellsModal={setSignatureSpellsModal}
                spellMasteryModal={spellMasteryModal} setSpellMasteryModal={setSpellMasteryModal}
                savantModal={savantModal} setSavantModal={setSavantModal}
                combatSuperiorityModal={combatSuperiorityModal} setCombatSuperiorityModal={setCombatSuperiorityModal}
                weaponKindMasteryModal={weaponKindMasteryModal} setWeaponKindMasteryModal={setWeaponKindMasteryModal}
                weaponMasteryChoiceModal={weaponMasteryChoiceModal} setWeaponMasteryChoiceModal={setWeaponMasteryChoiceModal}
                resourcePoolModal={resourcePoolModal} setResourcePoolModal={setResourcePoolModal}
                naturalRecoveryModal={naturalRecoveryModal} setNaturalRecoveryModal={setNaturalRecoveryModal}
                circleOfTheLandSpellsModal={circleOfTheLandSpellsModal} setCircleOfTheLandSpellsModal={setCircleOfTheLandSpellsModal}
                elementalAffinityModal={elementalAffinityModal} setElementalAffinityModal={setElementalAffinityModal}
                wildMagicSurgeModal={wildMagicSurgeModal} setWildMagicSurgeModal={setWildMagicSurgeModal}
                strideModal={strideModal} setStrideModal={setStrideModal}
                epitomeModal={epitomeModal} setEpitomeModal={setEpitomeModal}
                destructiveStrideModal={destructiveStrideModal} setDestructiveStrideModal={setDestructiveStrideModal}
                destructiveStrideTargetModal={destructiveStrideTargetModal} setDestructiveStrideTargetModal={setDestructiveStrideTargetModal}
                quiveringPalmModal={quiveringPalmModal} setQuiveringPalmModal={setQuiveringPalmModal}
                celestialResilienceModal={celestialResilienceModal} setCelestialResilienceModal={setCelestialResilienceModal}
                fiendishResilienceModal={fiendishResilienceModal} setFiendishResilienceModal={setFiendishResilienceModal}
                multiResistanceModal={multiResistanceModal} setMultiResistanceModal={setMultiResistanceModal}
                stepsOfTheFeyTauntModal={stepsOfTheFeyTauntModal} setStepsOfTheFeyTauntModal={setStepsOfTheFeyTauntModal}
                mistyWandererModal={mistyWandererModal} setMistyWandererModal={setMistyWandererModal}
                twinklingConstellationModal={twinklingConstellationModal} setTwinklingConstellationModal={setTwinklingConstellationModal}
                hurlThroughHellModal={hurlThroughHellModal} setHurlThroughHellModal={setHurlThroughHellModal}
                clairvoyantCombatantModal={clairvoyantCombatantModal} setClairvoyantCombatantModal={setClairvoyantCombatantModal}
                portentModal={portentModal} setPortentModal={setPortentModal}
                replenishingMealModal={replenishingMealModal} setReplenishingMealModal={setReplenishingMealModal}
                bolsteringTreatsModal={bolsteringTreatsModal} setBolsteringTreatsModal={setBolsteringTreatsModal}
                bolsteringPerformanceModal={bolsteringPerformanceModal} setBolsteringPerformanceModal={setBolsteringPerformanceModal}
                encouragingSongModal={encouragingSongModal} setEncouragingSongModal={setEncouragingSongModal}
                elfishLineageModal={elfishLineageModal} setElfisLineageModal={setElfisLineageModal}
                gnomishLineageModal={gnomishLineageModal} setGnomishLineageModal={setGnomishLineageModal}
                feyReinforcementsModal={feyReinforcementsModal} setFeyReinforcementsModal={setFeyReinforcementsModal}
                fiendishLegacyModal={fiendishLegacyModal} setFiendishLegacyModal={setFiendishLegacyModal}
                featureChoiceModal={featureChoiceModal} setFeatureChoiceModal={setFeatureChoiceModal}
                aspectOfTheWildsModal={aspectOfTheWildsModal} setAspectOfTheWildsModal={setAspectOfTheWildsModal}
                playerStats={playerStats} campaignName={campaignName}
                handleMoonlightStepFallbackConfirm={handleMoonlightStepFallbackConfirm}
                handleSignatureSpellsConfirm={handleSignatureSpellsConfirm}
                handleSpellMasteryConfirm={handleSpellMasteryConfirm}
                handleSavantConfirm={handleSavantConfirm}
                handleCombatSuperiorityConfirm={handleCombatSuperiorityConfirm}
                handleCombatSuperiorityReopenSelection={handleCombatSuperiorityReopenSelection}
                handleStrideConfirm={handleStrideConfirm}
                handleEpitomeConfirm={handleEpitomeConfirm}
                handleEpitomeClose={handleEpitomeClose}
                handleDestructiveStrideConfirm={handleDestructiveStrideConfirm}
                handleDestructiveStrideTargetConfirm={handleDestructiveStrideTargetConfirm}
                handleDestructiveStrideTargetSkip={handleDestructiveStrideTargetSkip}
                handleCelestialResilienceConfirm={handleCelestialResilienceConfirm}
                handleCelestialResilienceSkip={handleCelestialResilienceSkip}
                handlePortentModalClose={handlePortentModalClose}
                handlePortentDieChoice={handlePortentDieChoice}
                handleFeatureChoiceConfirm={handleFeatureChoiceConfirm}
                handleFeatureChoiceSkip={handleFeatureChoiceSkip}
                handleAspectOfTheWildsConfirm={handleAspectOfTheWildsConfirm}
                handleAspectOfTheWildsSkip={handleAspectOfTheWildsSkip}
                handleReplenishingMealConfirm={handleReplenishingMealConfirm}
                handleBolsteringTreatsConfirm={handleBolsteringTreatsConfirm}
                handleBolsteringPerformanceConfirm={handleBolsteringPerformanceConfirm}
                handleEncouragingSongConfirm={handleEncouragingSongConfirm}
                handleEncouragingSongSkip={handleEncouragingSongSkip}
                handleElfisLineageConfirm={handleElfisLineageConfirm}
                setElfisLineageModal={setElfisLineageModal}
                handleGnomishLineageConfirm={handleGnomishLineageConfirm}
                setGnomishLineageModal={setGnomishLineageModal}
                setPopupHtml={setPopupHtml}
                />
                {uniqueActions.map((specialAction, index) => {
                const isInteractive = isInteractiveAutomation(specialAction);
                const auto = specialAction.automation;
                const hasStringOptions = auto?.type === 'damage_bonus' && auto.options?.length > 0 && auto.options.every(o => typeof o === 'string');
                const isClickable = isInteractive || (hasStringOptions);
                return <div key={specialAction.name || `special-action-${index}`}>
                        <b className={isClickable ? "clickable" : ""} onClick={isClickable ? () => handleAutomationClick(specialAction) : undefined}>{specialAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: renderMarkdownInline(specialAction.description) }}></span>
                    </div>
                })}
               </div>
           )
}
export default CharSpecialActions;
