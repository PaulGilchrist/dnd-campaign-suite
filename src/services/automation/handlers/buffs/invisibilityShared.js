import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

function applyInvisibilityToSingleTarget({ playerStats, campaignName, targetName, buffName, abilityName, invisKeyPrefix, duration, logPrefix }) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
    if (!buffs.some(b => b.name === buffName)) {
        buffs.push({
            name: buffName,
            effect: 'invisible',
            duration,
            sourceCharacter: playerStats.name,
        });
        setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
    }

    const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const condArray = Array.isArray(conditions) ? conditions : [];
    if (!condArray.some(c => String(c).toLowerCase() === 'invisible')) {
        setRuntimeValue(targetName, 'activeConditions', [...condArray, 'invisible'], campaignName);
    }

    setRuntimeValue('campaign', `${invisKeyPrefix}${targetName}`, playerStats.name, campaignName);

    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const invisEffect = {
        target: targetName,
        effect: 'invisible',
        source: playerStats.name,
        condition: 'invisible',
        duration: 'concentration',
    };
    setRuntimeValue('campaign', 'targetEffects', [...targetEffects, invisEffect], campaignName);

    addExpiration({ attackerName: playerStats.name, targetName, effects: [
        { type: 'remove_active_buff', buffName }
    ], campaignName });

    const isSelf = targetName === playerStats.name;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName,
        description: `${playerStats.name} cast ${abilityName} on ${isSelf ? 'themself' : targetName}. Target gains the Invisible condition. Spell ends if target makes an attack roll, deals damage, casts a spell, or rolls initiative.`,
    }).catch((e) => { console.error(`[${logPrefix}] Error logging:`, e); });
}

// Shared apply logic for Invisibility / Greater Invisibility: stamps buff, condition,
// campaign key, target effect, expiration and log entry per target, then returns info popup.
export function applyInvisibilityToTargets({
    action, playerStats, campaignName, targetNames,
    buffName, abilityName, invisKeyPrefix, logPrefix, duration,
}) {
    if (!Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const targets = [];

    for (const targetName of targetNames) {
        applyInvisibilityToSingleTarget({ playerStats, campaignName, targetName, buffName, abilityName, invisKeyPrefix, logPrefix, duration });
        targets.push(targetName);
    }

    const targetsList = targets.length === 1 ? targets[0] : targets.join(', ');
    const description = targets.length === 1
        ? `${playerStats.name} gained ${abilityName} from ${action.name}.`
        : `${targets.length} targets gained ${abilityName} from ${action.name}: ${targetsList}.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
        },
    };
}
