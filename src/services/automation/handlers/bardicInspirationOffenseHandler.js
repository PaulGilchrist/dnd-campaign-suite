import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getLastDamageEvent } from '../../../hooks/useMetamagic.js';
import { getCombatContext } from '../../rules/damageUtils.js';
import { applyHealingToTarget } from '../../rules/applyHealing.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

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
    const damageEvent = getLastDamageEvent(playerName);
    let bonusDescription = '';
    let defenderHp = null;

    if (damageEvent && !isStale(damageEvent)) {
        const targetName = damageEvent.targetName;
        const combatSummary = await getCombatContext(campaignName);
        if (combatSummary && targetName) {
            const healResult = applyHealingToTarget(combatSummary, targetName, -rollResult.total, campaignName);
            defenderHp = healResult?.newHp ?? null;
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
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Bardic Inspiration (1d${dieSize}): rolled **${rollResult.total}** (${rollResult.rolls.join(', ')}). Add this to your attack's damage. Die granted by ${grantedBy}.${bonusDescription}${defenderHp != null ? ` ${damageEvent?.targetName} HP: ${defenderHp}` : ''}`,
            automation: action.automation,
        },
    };
}
