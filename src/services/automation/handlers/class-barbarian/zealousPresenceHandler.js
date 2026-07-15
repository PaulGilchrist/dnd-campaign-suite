import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { toggleBuff } from '../../common/buffToggle.js';

const ZEALOUS_PRESENCE_KEY = 'zealousPresenceActive';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if Zealous Presence is already active
    const isActive = getRuntimeValue(playerName, ZEALOUS_PRESENCE_KEY, campaignName);
    if (isActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} is already active.`,
                automation: auto,
            },
        };
    }

    // Handle uses and rage expenditure (same pattern as saveAttackHandler.js)
    const maxUses = auto.usesMax ?? auto.uses ?? 0;
    if (maxUses > 0) {
        const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? maxUses);
        if (currentUses <= 0) {
            if (auto.recharge === 'long_rest_or_expend_rage') {
                const storedRage = getRuntimeValue(playerName, 'ragePoints', campaignName);
                const currentRage = storedRage != null ? Number(storedRage) : (playerStats._trackedResources?.ragePoints?.current ?? 0);
                if (currentRage <= 0) {
                    return {
                        type: 'popup',
                        payload: {
                            type: 'automation_info',
                            name: action.name,
                            description: `${action.name} has been used and cannot be used again until a long rest.`,
                            automation: auto,
                        },
                    };
                }
                await setRuntimeValue(playerName, 'ragePoints', currentRage - 1, campaignName);
            } else {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${action.name} has been used and cannot be used again until a long rest.`,
                        automation: auto,
                    },
                };
            }
        } else {
            await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
        }
    }

    // Gather creature targets from combat context (exclude self)
    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures
            .filter(c => c.name !== playerName)
            .map(c => ({ name: c.name }))
        : [];

    return {
        type: 'modal',
        modalName: 'zealousPresenceTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            maxTargets: auto.targets || 10,
        },
    };
}

export async function confirmZealousPresence(action, playerStats, campaignName, targetNames) {
    const playerName = playerStats.name;
    const auto = action.automation;
    const finalTargets = (targetNames || []).slice(0, auto.targets || 10);

    // Activate the Zealous Presence marker
    await setRuntimeValue(playerName, ZEALOUS_PRESENCE_KEY, true, campaignName);

    // Apply buff to each selected creature
    for (const targetName of finalTargets) {
        toggleBuff(
            targetName,
            'Zealous Presence',
            {
                effect: 'advantage_attacks_and_saves',
                duration: auto.duration || 'until_start_of_next_turn',
            },
            campaignName
        );

        // Register expiration for start of barbarian's next turn
        addExpiration(playerName, targetName, [
            { type: 'remove_active_buff', buffName: 'Zealous Presence' },
            { type: 'clear_runtime_value', creatureName: playerName, key: ZEALOUS_PRESENCE_KEY }
        ], campaignName, undefined, playerName);
    }

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Zealous Presence, granting Advantage on attack rolls and saving throws to ${finalTargets.join(', ') || 'no one'} until the start of their next turn.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[zealousPresence] Error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Granting Advantage on attack rolls and saving throws to ${finalTargets.length} target(s) (${finalTargets.join(', ') || 'none'}).`,
            automation: auto,
        },
    };
}
