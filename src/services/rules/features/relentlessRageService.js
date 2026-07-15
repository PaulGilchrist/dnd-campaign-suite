import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import utils from '../../ui/utils.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

function evaluateHealExpression(expression, playerComputed) {
    if (typeof expression === 'number') return expression;
    if (!expression) return playerComputed?.level || 1;

    const match = String(expression).match(/2\s*\*\s*barbarian_level/i);
    if (match) {
        const barbarianLevel = playerComputed?.class?.class_levels?.find(
            cl => cl.name === 'Barbarian'
        )?.level || playerComputed?.level || 1;
        return 2 * barbarianLevel;
    }

    const numericMatch = String(expression).match(/^(\d+)\s*\*\s*(\w+)$/);
    if (numericMatch) {
        const multiplier = parseInt(numericMatch[1], 10);
        const field = numericMatch[2].toLowerCase();
        let value = 0;
        if (field === 'barbarian_level') {
            value = playerComputed?.class?.class_levels?.find(
                cl => cl.name === 'Barbarian'
            )?.level || playerComputed?.level || 1;
        } else if (field === 'level') {
            value = playerComputed?.level || 1;
        }
        return multiplier * value;
    }

    return playerComputed?.level || 1;
}

export function checkRelentlessRage(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const allFeatures = rawAllFeatures;
    let featureAutomation = null;

    for (const feature of allFeatures) {
        if (feature?.name === 'Relentless Rage' && feature?.automation) {
            featureAutomation = feature.automation;
            break;
        }
    }

    if (!featureAutomation) {
        return { intercepted: false };
    }

    const storedRage = getRuntimeValue(creature.name, 'ragePoints', campaignName);
    const currentRage = storedRage != null ? Number(storedRage) : 0;
    if (currentRage <= 0) {
        return { intercepted: false };
    }

    const usesKey = getRuntimeUsesKey('Relentless Rage');
    const currentUses = Number(getRuntimeValue(creature.name, usesKey) ?? 0);

    const baseDc = featureAutomation.saveDc || 10;
    const scaling = featureAutomation.dcScaling || 0;
    const saveDc = baseDc + (currentUses * scaling);

    const { promptId } = createSaveListener(campaignName, {
        targetName: creature.name,
        saveType: featureAutomation.saveType || 'CON',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: creature.name,
        abilityName: 'Relentless Rage',
        description: `Relentless Rage triggered — ${creature.name} must make ${featureAutomation.saveType || 'CON'} save (DC ${saveDc})`,
        source: 'Relentless Rage',
        promptId,
    }).catch((e) => { console.error("[relentlessRage] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const healAmount = evaluateHealExpression(featureAutomation.healExpression, playerComputed);
        const saveRoll = event.detail.roll;
        const saveBonus = event.detail.saveBonus;
        const saveTotal = event.detail.total;

        if (event.detail.success) {
            await setRuntimeValue(creature.name, 'currentHitPoints', healAmount, campaignName);

            creature.currentHp = healAmount;

            await setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
            await setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);

            const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
            const conditions = rawConditions || [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
            await setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: creature.name,
                abilityName: 'Relentless Rage',
                description: `${creature.name} succeeded on CON save. Relentless Rage sets Hit Points to ${healAmount}.`,
                saveRoll,
                saveBonus,
                saveTotal,
                saveDc,
                saveSuccess: true,
                hpGained: healAmount,
                source: 'Relentless Rage',
            }).catch((e) => { console.error("[relentlessRage] Error:", e); });

            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        } else {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: creature.name,
                abilityName: 'Relentless Rage',
                description: `${creature.name} failed CON save. Relentless Rage did not activate.`,
                saveRoll,
                saveBonus,
                saveTotal,
                saveDc,
                saveSuccess: false,
                source: 'Relentless Rage',
            }).catch((e) => { console.error("[relentlessRage] Error:", e); });

            const currentHp = getRuntimeValue(creature.name, 'currentHitPoints', campaignName);
            if (currentHp != null && Number(currentHp) <= 0) {
                const deathSavePromptId = utils.guid();
                sendDeathSavePrompt(campaignName, {
                    promptId: deathSavePromptId,
                    targetName: creature.name,
                });

                const handleDeathSaveResult = (deathEvent) => {
                    if (deathEvent.detail?.promptId !== deathSavePromptId) return;
                    window.removeEventListener('death-save-result', handleDeathSaveResult);

                    const dsResult = deathEvent.detail;
                    const currentSaves = getRuntimeValue(creature.name, 'deathSaves', campaignName) || [false, false, false];
                    const currentFailures = getRuntimeValue(creature.name, 'deathFailures', campaignName) || [false, false, false];

                    let newSaves = [...currentSaves];
                    let newFailures = [...currentFailures];

                    if (dsResult.isNat20) {
                        newSaves = [false, false, false];
                        newFailures = [false, false, false];
                        setRuntimeValue(creature.name, 'currentHitPoints', 1, campaignName);
                    } else if (dsResult.success) {
                        const firstEmpty = newSaves.indexOf(false);
                        if (firstEmpty !== -1) newSaves[firstEmpty] = true;
                    } else {
                        const failMultiplier = dsResult.isNat1 ? 2 : 1;
                        for (let i = 0; i < failMultiplier; i++) {
                            const firstEmpty = newFailures.indexOf(false);
                            if (firstEmpty !== -1) newFailures[firstEmpty] = true;
                        }
                    }

                    setRuntimeValue(creature.name, 'deathSaves', newSaves, campaignName);
                    setRuntimeValue(creature.name, 'deathFailures', newFailures, campaignName);

                    addEntry(campaignName, {
                        type: 'death_save',
                        characterName: creature.name,
                        roll: dsResult.roll,
                        isNatural20: dsResult.isNat20,
                        isNatural1: dsResult.isNat1,
                        success: dsResult.success || dsResult.result === 'nat20' || dsResult.result === 'stable',
                    }).catch((e) => { console.error("[relentlessRage] Error:", e); });
                };

                window.addEventListener('death-save-result', handleDeathSaveResult);
            }
        }

        await setRuntimeValue(creature.name, usesKey, currentUses + 1, campaignName);
        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        intercepted: true,
        awaitingSave: true,
    };
}

export { evaluateHealExpression, getRuntimeUsesKey };
