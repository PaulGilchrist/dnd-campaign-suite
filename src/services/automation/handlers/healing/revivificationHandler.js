import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import storage from '../../../ui/storage.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const storedRage = getRuntimeValue(playerName, 'ragePoints', campaignName);
    const currentRage = storedRage != null ? Number(storedRage) : 0;
    if (currentRage <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Rage remaining to power Revivification.',
                automation: auto,
            },
        };
    }

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat active.',
                automation: auto,
            },
        };
    }

    const target = getTargetFromAttacker(cs, playerName);
    if (!target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Select a target in the combat tracker first.',
                automation: auto,
            },
        };
    }

    const targetHp = target.type === 'player'
        ? (getRuntimeValue(target.name, 'currentHitPoints', campaignName) ?? 0)
        : (target.currentHp ?? 0);

    if (targetHp > 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${target.name} is not at 0 Hit Points.`,
                automation: auto,
            },
        };
    }

    const healAmount = playerStats.level || 1;

    await setRuntimeValue(playerName, 'ragePoints', currentRage - 1, campaignName);

    if (target.type === 'player') {
        await setRuntimeValue(target.name, 'currentHitPoints', healAmount, campaignName);
    } else {
        target.currentHp = healAmount;
        const summary = cs;
        if (summary) {
            storage.set('combatSummary', summary, campaignName);
        }
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    postLogEntry(campaignName, {
        type: 'heal',
        characterName: playerName,
        targetName: target.name,
        amount: healAmount,
        abilityName: action.name,
        timestamp: Date.now(),
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerName} uses Revivification to save ${target.name}, setting their Hit Points to ${healAmount} and expending 1 Rage.`,
            automation: auto,
        },
    };
}
