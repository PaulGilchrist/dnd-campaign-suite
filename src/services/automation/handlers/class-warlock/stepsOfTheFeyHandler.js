import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Steps of the Fey';

    const usesMax = evaluateAutoExpression(auto.uses_expression || 'CHA modifier_min_1', playerStats) || 1;
    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free uses of Steps of the Fey remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    const newCount = currentCount - 1;
    await setRuntimeValue(playerName, freeCastCountKey, newCount, campaignName);

    // Refreshing Step: gain 1d10 Temporary Hit Points
    const tempHpRoll = rollDie(10);
    const existingTempHp = Number(getRuntimeValue(playerName, 'tempHp', campaignName) ?? 0);
    const newTempHp = Math.max(existingTempHp, tempHpRoll);
    await setRuntimeValue(playerName, 'tempHp', newTempHp, campaignName);

    // Build description
    let description = `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/>`;
    description += `<b>Refreshing Step:</b> Gained ${tempHpRoll} Temporary Hit Points.`;

    // Taunting Step: attempt to target the selected creature for a WIS save
    const saveDc = buildSaveDc(auto, playerStats);
    const targetInfo = await resolveTarget(campaignName, playerName);
    const targetName = targetInfo?.target?.name;

    if (targetName) {
        const { promptId } = createSaveListener(campaignName, {
            targetName,
            saveType: 'WIS',
            saveDc,
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${featureName} triggered — ${targetName} must make WIS save (DC ${saveDc}) or have Disadvantage on attack rolls against creatures other than ${playerName}.`,
            promptId,
        }).catch((e) => { console.error("[stepsOfTheFey] Error:", e); throw e; });

        const handleSaveResult = async (event) => {
            if (event.detail.promptId !== promptId) return;

            const isSuccessful = event.detail.success;

            if (!isSuccessful) {
                const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                const conditions = Array.isArray(storedConditions) ? storedConditions : [];
                const conditionKey = 'taunted_by_' + playerName.replace(/\s+/g, '_').toLowerCase();
                if (!conditions.some(c => String(c).toLowerCase() === conditionKey)) {
                    await setRuntimeValue(targetName, 'activeConditions', [...conditions, conditionKey], campaignName);
                }

                addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    rollType: `save-${auto.type}`,
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: false,
                    description: `${targetName} failed WIS save. ${targetName} has Disadvantage on attack rolls against creatures other than ${playerName} until start of ${playerName}'s next turn.`,
                }).catch((e) => { console.error("[stepsOfTheFey] Error:", e); throw e; });

                // Duration: roughly 1 round (until start of taunter's next turn)
                addExpiration(playerName, targetName, [
                    { type: 'condition', condition: conditionKey }
                ], campaignName, 1);
            } else {
                addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    rollType: `save-${auto.type}`,
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: true,
                    description: `${targetName} succeeded on WIS save from ${featureName}. No effect.`,
                }).catch((e) => { console.error("[stepsOfTheFey] Error:", e); throw e; });
            }

            window.removeEventListener('save-result', handleSaveResult);
        };

        window.addEventListener('save-result', handleSaveResult);

        description += `<br/><br/><b>Taunting Step:</b> ${targetName} must make a WIS save (DC ${saveDc}). On a failed save, ${targetName} has Disadvantage on attack rolls against creatures other than ${playerName} until the start of ${playerName}'s next turn.`;
    } else {
        description += `<br/><br/><b>Taunting Step:</b> No target selected. Creatures within 5 feet of the space you left must make a WIS save (DC ${saveDc}) or have Disadvantage on attack rolls against creatures other than you.`;
    }

    // Log the full action
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — free Misty Step cast (${newCount} remaining), gained ${tempHpRoll} temp HP, Taunting Step triggered.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
            triggerMistyStep: true,
        },
    };
}
