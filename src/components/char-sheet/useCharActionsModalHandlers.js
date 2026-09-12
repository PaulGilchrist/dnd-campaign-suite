import { toggleBuff } from '../../services/automation/common/buffToggle.js'
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js'
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../services/ui/logService.js'
import { executeSweepingAttack, executeBaitAndSwitchChoice, executeCommanderStrikeChoice, executeRallyChoice } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js'
import { activateBulwarkOfForce } from '../../services/automation/handlers/class-sorcerer/bulwarkOfForceHandler.js'
import { confirmZealousPresence } from '../../services/automation/handlers/class-barbarian/zealousPresenceHandler.js'
import { confirmPsychicWhispers } from '../../services/automation/handlers/buffs/buffHandler.js'
import { confirmMassHeal } from '../../services/automation/handlers/healing/massHealHandler.js'
import { confirmClockworkCavalcadeHeal, confirmClockworkCavalcadeDispel, confirmClockworkCavalcadeRepair } from '../../services/automation/handlers/class-sorcerer/clockworkCavalcadeHandler.js'
import { confirmMassCureWounds } from '../../services/automation/handlers/healing/massCureWoundsHandler.js'
import { confirmPrayerOfHealing } from '../../services/automation/handlers/healing/prayerOfHealingHandler.js'
import { confirmPowerWordFortify } from '../../services/automation/handlers/buffs/powerWordFortifyHandler.js'
import { confirmMassHealingWord } from '../../services/automation/handlers/healing/massHealingWordHandler.js'
import { activateNaturesSanctuary, moveNaturesSanctuary } from '../../services/automation/handlers/class-ranger/naturesSanctuaryHandler.js'
import { activateCoronaOfLight } from '../../services/automation/handlers/class-cleric-paladin/coronaOfLightHandler.js'
import { confirmRadianceOfDawn } from '../../services/automation/handlers/class-cleric-paladin/radianceOfDawnHandler.js'
import { confirmMantleOfInspiration, confirmVitalityOfTheTree } from '../../services/automation/handlers/buffs/tempHpBuffHandler.js'
import { confirmCelestialResilience, skipCelestialResilience } from '../../services/automation/handlers/class-warlock/celestialResilienceHandler.js'
import { confirmOceanicGift } from '../../services/automation/handlers/class-druid/oceanicGiftHandler.js'
import { applyBardicInspiration } from '../../services/automation/handlers/class-bard/bardicInspirationHandler.js'
import { applyInspiringMovement } from '../../services/automation/handlers/reactions/reactionBonusHandler.js'

export default function useCharActionsModalHandlers({
    setPopupHtml,
    setModalState,
    modalState,
    mergedModalState,
}) {
    async function handleSweepingAttackConfirm(targetName, modalData) {
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
    }

    async function handleBaitAndSwitchChoiceConfirm(targetName, modalData) {
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
    }

    async function handleCommanderStrikeChoiceConfirm(targetName, modalData) {
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
    }

    async function handleRallyChoiceConfirm(targetName, modalData) {
        if (!targetName || !modalData) return;
        const result = await executeRallyChoice({
            action: {
                dieValue: modalData.dieValue,
                maneuverName: modalData.maneuverName,
            },
            playerStats: modalData.playerStats,
            campaignName: modalData.campaignName,
            chosenName: targetName,
            totalHp: modalData.totalHp,
            extraHp: modalData.extraHp,
            description: modalData.description,
        });
        if (result.payload) {
            setPopupHtml(result.payload);
        }
        if (result?.logEntries) {
            result.logEntries.forEach(entry => addEntry(modalData.campaignName, entry).catch((e) => { console.error("[useCharActionsModalHandlers:log-error]", e); }));
        }
        setModalState({ rallyChoiceModal: null });
    }

    async function handleBulwarkOfForceConfirm(targetNames) {
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
    }

    async function handleZealousPresenceConfirm(targetNames) {
        if (!targetNames || !modalState.zealousPresenceModal) return;
        const result = await confirmZealousPresence(
            modalState.zealousPresenceModal.action,
            modalState.zealousPresenceModal.playerStats,
            modalState.zealousPresenceModal.campaignName,
            targetNames
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ zealousPresenceModal: null });
    }

    async function handlePsychicWhispersConfirm(targetNames) {
        if (!targetNames || !modalState.psychicWhispersModal) return;
        const result = await confirmPsychicWhispers(
            modalState.psychicWhispersModal.action,
            modalState.psychicWhispersModal.playerStats,
            modalState.psychicWhispersModal.campaignName,
            targetNames
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ psychicWhispersModal: null });
    }

    async function handleMassHealConfirm(distribution) {
        if (!distribution || !modalState.massHealModal) return;
        const { action, playerStats, campaignName, totalPool, bonusHeal, bonusDetails } = modalState.massHealModal;
        const result = await confirmMassHeal({ action, playerStats, campaignName, distribution, totalPool, bonusHeal, bonusDetails });
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ massHealModal: null });
    }

    async function handleClockworkCavalcadeHealConfirm(distribution) {
        if (!distribution || !mergedModalState.clockworkCavalcadeHealModal) return;
        const { action, playerStats, campaignName } = mergedModalState.clockworkCavalcadeHealModal;
        const result = await confirmClockworkCavalcadeHeal(action, playerStats, campaignName, distribution, mergedModalState.clockworkCavalcadeHealModal.maxHeal);
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ clockworkCavalcadeHealModal: null });
    }

    async function handleClockworkCavalcadeDispelConfirm(targetNames) {
        if (!targetNames || !mergedModalState.clockworkCavalcadeDispelModal) return;
        const { action, playerStats, campaignName } = mergedModalState.clockworkCavalcadeDispelModal;
        const result = await confirmClockworkCavalcadeDispel(action, playerStats, campaignName, targetNames);
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ clockworkCavalcadeDispelModal: null });
    }

    async function handleClockworkCavalcadeRepairConfirm() {
        if (!mergedModalState.clockworkCavalcadeRepairModal) return;
        const { action, playerStats, campaignName } = mergedModalState.clockworkCavalcadeRepairModal;
        const result = await confirmClockworkCavalcadeRepair(action, playerStats, campaignName);
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ clockworkCavalcadeRepairModal: null });
    }

    async function handleMassCureWoundsConfirm(targetNames) {
        if (!targetNames || !mergedModalState.massCureWoundsModal) return;
        const { action, playerStats, campaignName, healExpression, maximize, bonusHeal, bonusDetails, slotLevel } = mergedModalState.massCureWoundsModal;
        const result = await confirmMassCureWounds({ action, playerStats, campaignName, selectedTargetNames: targetNames, healExpression, maximize, bonusHeal, bonusDetails, slotLevel });
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ massCureWoundsModal: null });
    }

    async function handlePrayerOfHealingConfirm(targetNames) {
        if (!targetNames || !mergedModalState.prayerOfHealingModal) return;
        const { action, playerStats, campaignName, healExpression, maximize, bonusHeal, bonusDetails, slotLevel, currentRound } = mergedModalState.prayerOfHealingModal;
        const result = await confirmPrayerOfHealing({ action, playerStats, campaignName, selectedTargetNames: targetNames, healExpression, maximize, bonusHeal, bonusDetails, slotLevel, currentRound });
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ prayerOfHealingModal: null });
    }

    async function handlePowerWordFortifyConfirm(distribution) {
        if (!distribution || !mergedModalState.powerWordFortifyModal) return;
        const { action, playerStats, campaignName } = mergedModalState.powerWordFortifyModal;
        const result = await confirmPowerWordFortify(action, playerStats, campaignName, distribution, mergedModalState.powerWordFortifyModal.totalTempHp, mergedModalState.powerWordFortifyModal.tempHpExpression);
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ powerWordFortifyModal: null });
    }

    async function handleMassHealingWordConfirm(targetNames) {
        if (!targetNames || !mergedModalState.massHealingWordModal) return;
        const { action, playerStats, campaignName, healExpression, maximize, bonusHeal, bonusDetails, slotLevel } = mergedModalState.massHealingWordModal;
        const result = await confirmMassHealingWord({ action, playerStats, campaignName, selectedTargetNames: targetNames, healExpression, maximize, bonusHeal, bonusDetails, slotLevel });
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ massHealingWordModal: null });
    }

    async function handleNaturesSanctuaryConfirm(targetNames, mapName) {
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
    }

    async function handleCoronaEnemySelectionConfirm(selectedEnemies) {
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
    }

    async function handleRadianceOfDawnConfirm(selectedTargets) {
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
    }

    async function handleMantleOfInspirationConfirm(selectedTargets) {
        if (!selectedTargets || !modalState.mantleOfInspirationTarget) return;
        const mantleModal = modalState.mantleOfInspirationTarget;
        const result = await confirmMantleOfInspiration({
            action: mantleModal.action,
            playerStats: mantleModal.playerStats,
            campaignName: mantleModal.campaignName,
            selectedTargets,
            dieRoll: mantleModal.dieRoll,
            bardicDieSize: mantleModal.bardicDieSize,
            tempHp: mantleModal.tempHp,
        });
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ mantleOfInspirationTarget: null });
    }

    async function handleCelestialResilienceConfirm(selectedTargets) {
        if (!selectedTargets || !modalState.celestialResilienceModal) return;
        const result = await confirmCelestialResilience(
            modalState.celestialResilienceModal.action,
            modalState.celestialResilienceModal.playerStats,
            modalState.celestialResilienceModal.campaignName,
            selectedTargets
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ celestialResilienceModal: null });
    }

    async function handleCelestialResilienceSkip() {
        if (!modalState.celestialResilienceModal) return;
        const result = await skipCelestialResilience(
            modalState.celestialResilienceModal.action,
            modalState.celestialResilienceModal.playerStats,
            modalState.celestialResilienceModal.campaignName
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ celestialResilienceModal: null });
    }

    async function handleInspiringSmiteConfirm(distribution) {
        if (!distribution || !modalState.inspiringSmiteModal) return;
        const { action, playerStats: ps, campaignName: cn, channelDivinityCharges } = modalState.inspiringSmiteModal;
        const playerName = ps.name;

        const targetNames = Object.keys(distribution);
        if (targetNames.length === 0) return;

        for (const targetName of targetNames) {
            const amount = distribution[targetName];
            setTempHp(targetName, amount, cn);
        }

        setRuntimeValue(playerName, 'channelDivinityCharges', channelDivinityCharges - 1, cn);

        const totalDistributed = Object.values(distribution).reduce((sum, v) => sum + v, 0);
        addEntry(cn, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name} (${totalDistributed} temp HP). Distribution: ${targetNames.map(n => `${n}=${distribution[n]}`).join(', ')}`,
        }).catch((e) => { console.error("[useCharActionsModalHandlers:log-error]", e); });

        const distributionStr = targetNames.map(n => `${n} (${distribution[n]} HP)`).join(', ');
        const html = `<b>${action.name}</b><br/>Granted ${totalDistributed} temporary hit points: ${distributionStr}.`;
        setPopupHtml(html);
        setModalState({ inspiringSmiteModal: null });
    }

    async function handleVitalityOfTheTreeConfirm(selectedTargets) {
        if (!selectedTargets || !modalState.vitalityOfTheTreeTarget) return;
        const result = await confirmVitalityOfTheTree(
            modalState.vitalityOfTheTreeTarget.action,
            modalState.vitalityOfTheTreeTarget.playerStats,
            modalState.vitalityOfTheTreeTarget.campaignName,
            selectedTargets,
            modalState.vitalityOfTheTreeTarget.tempHp,
            modalState.vitalityOfTheTreeTarget.maxTargets
        );
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
        setModalState({ vitalityOfTheTreeTarget: null });
    }

    async function handleTricksterBlessingConfirm(targetName) {
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
    }

    async function handleBardicInspirationConfirm(targetName) {
        if (!modalState.bardicInspirationTargetModal) return;
        const { action, playerStats: biPlayerStats, campaignName: biCampaignName, dieSize, hasCombatOptions } = modalState.bardicInspirationTargetModal;
        setModalState({ bardicInspirationTargetModal: null });
        if (!targetName) return;
        const result = await applyBardicInspiration(action, biPlayerStats, biCampaignName, targetName, dieSize, hasCombatOptions);
        if (!result) return;
        if (result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }

    async function handleInspiringMovementConfirm(allyName) {
        if (!modalState.inspiringMovementAllyModal) return;
        const { action, playerStats: imPlayerStats, campaignName: imCampaignName, halfSpeed, noOAs } = modalState.inspiringMovementAllyModal;
        setModalState({ inspiringMovementAllyModal: null });
        if (!allyName) return;
        const result = await applyInspiringMovement(action, imPlayerStats, imCampaignName, allyName, halfSpeed, noOAs);
        if (!result) return;
        if (result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }

    async function handleOceanicGiftConfirm(selectedAllyName, doubleOverride) {
        if (!modalState.oceanicGiftTargetModal) return;
        const { action, playerStats: ogPlayerStats, campaignName: ogCampaignName, spellSaveDc, wisMod, doubleEmanation } = modalState.oceanicGiftTargetModal;
        setModalState({ oceanicGiftTargetModal: null });
        if (!selectedAllyName) return;
        const isDouble = doubleOverride ?? doubleEmanation;
        const result = await confirmOceanicGift({ action, playerStats: ogPlayerStats, campaignName: ogCampaignName, selectedAllyName, spellSaveDc, wisMod, doubleEmanation: isDouble });
        if (!result) return;
        if (result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }

    return {
        handleSweepingAttackConfirm,
        handleBaitAndSwitchChoiceConfirm,
        handleCommanderStrikeChoiceConfirm,
        handleRallyChoiceConfirm,
        handleBulwarkOfForceConfirm,
        handleZealousPresenceConfirm,
        handlePsychicWhispersConfirm,
        handleMassHealConfirm,
        handleClockworkCavalcadeHealConfirm,
        handleClockworkCavalcadeDispelConfirm,
        handleClockworkCavalcadeRepairConfirm,
        handleMassCureWoundsConfirm,
        handlePrayerOfHealingConfirm,
        handlePowerWordFortifyConfirm,
        handleMassHealingWordConfirm,
        handleNaturesSanctuaryConfirm,
        handleCoronaEnemySelectionConfirm,
        handleRadianceOfDawnConfirm,
        handleMantleOfInspirationConfirm,
        handleCelestialResilienceConfirm,
        handleCelestialResilienceSkip,
        handleInspiringSmiteConfirm,
        handleVitalityOfTheTreeConfirm,
        handleTricksterBlessingConfirm,
        handleBardicInspirationConfirm,
        handleInspiringMovementConfirm,
        handleOceanicGiftConfirm,
    };
}
