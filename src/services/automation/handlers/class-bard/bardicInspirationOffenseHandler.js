import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';

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
    const lastAttack = await findLastAttack(campaignName);
    let bonusDescription = '';
    let defenderHp = null;

    if (lastAttack && lastAttack.attackerName === playerName) {
        const targetName = lastAttack.targetName;
        if (targetName) {
            bonusDescription = ` Bonus damage applied to ${targetName}.`;
        }
    }

    if (!bonusDescription) {
        bonusDescription = ` No recent damage event found. Add ${rollResult.total} damage to your last hit manually.`;
    }

    setRuntimeValue(playerName, 'bardicInspirationDie', null, campaignName);
    setRuntimeValue(playerName, 'bardicInspirationGrantedBy', null, campaignName);
    setRuntimeValue(playerName, 'bardicInspirationCombatOptions', null, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}: rolled 1d${dieSize} (${rollResult.total}).${bonusDescription}`,
        biDieRoll: rollResult.total,
        biDieSize: dieSize,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[bardicInspirationOffense] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Bardic Inspiration (1d${dieSize}): rolled **${rollResult.total}** (${rollResult.rolls.join(', ')}). Add this to your attack's damage. Die granted by ${grantedBy}.${bonusDescription}${defenderHp != null ? ` ${lastAttack?.targetName} HP: ${defenderHp}` : ''}`,
            automation: action.automation,
        },
    };
}
