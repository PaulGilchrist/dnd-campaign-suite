import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { addExpiration } from '../../rules/expirations.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';

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

    const starMapRoll = rollExpression('1d20');
    if (!starMapRoll) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'Star Map roll failed.',
                automation: auto,
            },
        };
    }

    const isEven = starMapRoll.total % 2 === 0;
    const d6Roll = rollExpression('1d6');
    const d6Value = d6Roll?.total ?? 0;

    const result = isEven ? 'Weal' : 'Woe';
    const description = `<b>${featureName}</b><br/>Star Map roll: 1d20 = <b>${starMapRoll.total}</b> (${isEven ? 'Even' : 'Odd'})<br/>Result: <b>${result}</b><br/>1d6 = <b>${d6Value}</b><br/>${isEven
        ? `Allies add ${d6Value} to D20 tests.`
        : `Enemies subtract ${d6Value} from D20 tests.`}`;

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    await setRuntimeValue(playerName, 'cosmicOmenEffect', JSON.stringify({
        type: result,
        d6Value,
        isEven,
        starMapRoll: starMapRoll.total,
    }), campaignName);

    addExpiration(playerName, playerName, [
        { type: 'remove_cosmic_omen' }
    ], campaignName, 100);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
            cosmicOmenResult: {
                type: result,
                d6Value,
                isEven,
                starMapRoll: starMapRoll.total,
            },
        },
    };
}

export async function clearCosmicOmenEffect(playerName, campaignName) {
    await setRuntimeValue(playerName, 'cosmicOmenEffect', null, campaignName);
}
