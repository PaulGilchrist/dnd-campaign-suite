import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { infoPopup } from '../../common/infoPopup.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

function resolveOmenUsesMax(auto, playerStats) {
    const usesMax = auto.usesMax ?? 0;
    if (usesMax || !auto.uses_expression) return usesMax;
    return evaluateAutoExpression(auto.uses_expression, playerStats) || 0;
}

function checkOmenUses(usesMax, playerName, featureName, campaignName, auto) {
    if (!(usesMax > 0)) return null;
    const currentUses = Number(getRuntimeValue(playerName, getRuntimeUsesKey(featureName), campaignName) ?? usesMax);
    if (currentUses <= 0) {
        return infoPopup(featureName, `${featureName} has no uses remaining. Recharges on a Long Rest.`, auto);
    }
    return null;
}

async function consumeOmenUses(usesMax, playerName, featureName, campaignName) {
    if (!(usesMax > 0)) return;
    const usesKey = getRuntimeUsesKey(featureName);
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
}

function parseOmenEffect(omenEffectRaw, featureName, auto) {
    try {
        return { omenEffect: JSON.parse(omenEffectRaw) };
    } catch (_e) {
        return { popup: infoPopup(featureName, `${featureName} has corrupted omen data.`, auto) };
    }
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Cosmic Omen';

    const usesMax = resolveOmenUsesMax(auto, playerStats);

    const usesRefusal = checkOmenUses(usesMax, playerName, featureName, campaignName, auto);
    if (usesRefusal) return usesRefusal;

    const omenEffectRaw = getRuntimeValue(playerName, 'cosmicOmenEffect', campaignName);
    if (!omenEffectRaw) {
        return infoPopup(featureName, `${featureName} has no omen active. Consult your Star Map on Long Rest.`, auto);
    }

    const parsed = parseOmenEffect(omenEffectRaw, featureName, auto);
    if (parsed.popup) return parsed.popup;
    const omenEffect = parsed.omenEffect;

    const d6Roll = rollExpression('1d6');
    if (!d6Roll) {
        return infoPopup(featureName, `${featureName} roll failed.`, auto);
    }

    const d6Value = d6Roll.total;
    const isWeal = omenEffect.type === 'Weal';
    const modifierLabel = isWeal ? `+${d6Value}` : `-${d6Value}`;

    const description = `<b>${featureName}</b><br/>Star Map result: <b>${omenEffect.type} (${omenEffect.isEven ? 'Even' : 'Odd'})</b>, Star Map roll: <b>${omenEffect.starMapRoll}</b><br/>1d6: <b>${d6Value}</b><br/>Next d20 test: <b>${modifierLabel}</b>`;

    await consumeOmenUses(usesMax, playerName, featureName, campaignName);

    await setRuntimeValue(playerName, 'cosmicOmenPendingBonus', JSON.stringify({
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
