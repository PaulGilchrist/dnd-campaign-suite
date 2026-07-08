import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const BULWARK_KEY = 'bulwarkOfForceActive';
const BULWARK_TARGETS_KEY = 'bulwarkOfForceTargets';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if bulwark is already active
    const isActive = getRuntimeValue(playerName, BULWARK_KEY, campaignName);
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

    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const maxTargets = Math.max(1, intMod);

    // Gather creature targets from combat context (exclude self)
    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures
            .filter(c => c.name !== playerName)
            .map(c => ({ name: c.name }))
        : [];

    return {
        type: 'modal',
        modalName: 'bulwarkOfForceTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            maxTargets,
        },
    };
}

export async function activateBulwarkOfForce(action, playerStats, campaignName, targetNames) {
    const playerName = playerStats.name;
    const auto = action.automation;
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const maxTargets = Math.max(1, intMod);

    // Clamp targets to max allowed
    const finalTargets = (targetNames || []).slice(0, maxTargets);

    // Activate the bulwark
    await setRuntimeValue(playerName, BULWARK_KEY, true, campaignName);
    await setRuntimeValue(playerName, BULWARK_TARGETS_KEY, finalTargets, campaignName);

    // Set up expiration for start of next turn
    addExpiration(playerName, playerName, [
        { type: 'remove_bulwark_of_force' }
    ], campaignName, undefined, playerName);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Bulwark of Force, granting Half Cover to ${finalTargets.join(', ') || 'no one'}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[bulwarkOfForce] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Granting Half Cover to ${finalTargets.length} target(s) (${finalTargets.join(', ') || 'none'}).`,
            automation: auto,
        },
    };
}
