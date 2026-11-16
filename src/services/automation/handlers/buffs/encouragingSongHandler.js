import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../encounters/combatData.js';
import { getRuntimeUsesKey } from '../../../shared/usesKey.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const maxUses = auto.usesMax ?? 0;
    const usesKey = auto.resourceKey || getRuntimeUsesKey(action.name);
    const rawValue = getRuntimeValue(playerName, usesKey);
    const currentUses = Number(rawValue ?? maxUses);

    if (maxUses > 0 && currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has been used and cannot be used again until a short or long rest.`,
                automation: auto,
            },
        };
    }

    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures
            .map(c => ({ name: c.name, type: c.type || 'player', currentHp: c.currentHp || 0, maxHp: c.maxHp || 0 }))
        : [];

    return {
        type: 'modal',
        modalName: 'encouragingSongTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            maxTargets: playerStats.proficiency || 0,
        },
    };
}

export async function confirmEncouragingSong(action, playerStats, campaignName, selectedTargets) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const maxUses = auto.usesMax ?? 0;

    if (maxUses > 0) {
        const usesKey = auto.resourceKey || getRuntimeUsesKey(action.name);
        const currentUses = Number(getRuntimeValue(playerName, usesKey) ?? maxUses);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has been used and cannot be used again until a short or long rest.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    const finalTargets = (selectedTargets || []).slice(0, playerStats.proficiency || 0);

    for (const targetName of finalTargets) {
        await setRuntimeValue(targetName, 'hasInspiration', true, campaignName);
    }

    const targetList = finalTargets.length > 0 ? finalTargets.join(', ') : 'no targets selected';
    const targetDetail = finalTargets.length !== 1 ? 'allies' : 'ally';
    const description = `${action.name}: Granted Heroic Inspiration to ${finalTargets.length} ${targetDetail} (${targetList}).`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to grant Heroic Inspiration to ${finalTargets.length} ${targetDetail}: ${targetList}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[encouragingSongHandler] Error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
    };
}

export async function skipEncouragingSong(action, playerStats, campaignName) {
    const playerName = playerStats.name;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} skipped using ${action.name}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[encouragingSongHandler] Error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation.type,
            description: `${action.name}: No allies selected.`,
            automation: action.automation,
        },
    };
}
