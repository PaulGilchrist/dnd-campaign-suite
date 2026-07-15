import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Cosmic Omen';

    const usesKey = getRuntimeUsesKey(featureName);
    let usesMax = auto.usesMax ?? 0;

    if (!usesMax && auto.uses_expression) {
        usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 0;
    }

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} has no uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    const omenEffectRaw = getRuntimeValue(playerName, 'cosmicOmenEffect', campaignName);
    if (!omenEffectRaw) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has no omen active. Consult your Star Map on Long Rest.`,
                automation: auto,
            },
        };
    }

    let omenEffect;
    try {
        omenEffect = JSON.parse(omenEffectRaw);
    } catch (_e) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has corrupted omen data.`,
                automation: auto,
            },
        };
    }

    const d6Roll = rollExpression('1d6');
    if (!d6Roll) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} roll failed.`,
                automation: auto,
            },
        };
    }

    const d6Value = d6Roll.total;
    const isWeal = omenEffect.type === 'Weal';
    const modifierLabel = isWeal ? `+${d6Value}` : `-${d6Value}`;

    const description = `<b>${featureName}</b><br/>Star Map result: <b>${omenEffect.type} (${omenEffect.isEven ? 'Even' : 'Odd'})</b>, Star Map roll: <b>${omenEffect.starMapRoll}</b><br/>1d6: <b>${d6Value}</b><br/>Next d20 test: <b>${modifierLabel}</b>`;

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    await setRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', JSON.stringify({
        value: d6Value,
        type: omenEffect.type,
    }), campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} (${omenEffect.type}). Rolled 1d6: ${d6Value}. Next d20 test modified ${modifierLabel}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`[${featureName}] Error:`, e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
        },
    };
}

export async function clearCosmicOmenEffect(playerName, campaignName) {
    await setRuntimeValue(playerName, 'cosmicOmenEffect', null, campaignName);
}
