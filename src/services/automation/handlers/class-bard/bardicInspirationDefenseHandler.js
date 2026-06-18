import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const dieSize = getRuntimeValue(playerName, 'bardicInspirationDie', campaignName);
    if (!dieSize) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'You do not have a Bardic Inspiration die.',
            },
        };
    }

    const rollResult = rollExpression(`1d${dieSize}`);
    if (!rollResult) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Roll failed.',
            },
        };
    }

    const grantedBy = getRuntimeValue(playerName, 'bardicInspirationGrantedBy', campaignName) || 'unknown';

    setRuntimeValue(playerName, 'bardicInspirationDie', null, campaignName);
    setRuntimeValue(playerName, 'bardicInspirationGrantedBy', null, campaignName);
    setRuntimeValue(playerName, 'bardicInspirationCombatOptions', null, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}: rolled 1d${dieSize} (${rollResult.total}). AC boosted by ${rollResult.total} as a Reaction.`,
        biDieRoll: rollResult.total,
        biDieSize: dieSize,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Bardic Inspiration (1d${dieSize}): rolled **${rollResult.total}** (${rollResult.rolls.join(', ')}). Use your Reaction to add this to your AC for that attack. Die granted by ${grantedBy}.`,
            automation: action.automation,
        },
    };
}
