import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const GLORIOUS_DEFENSE_KEY = 'gloriousDefenseActive';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    // Part 1: AC bonus reaction — apply passive buff for next attack
    if (auto.effect === 'ac_bonus') {
        return handleAcBonus(action, playerStats, campaignName);
    }

    // Part 2: Counter-attack reaction — triggered when attack misses
    if (auto.effect === 'counter_attack') {
        return handleCounterAttack(action, playerStats, campaignName);
    }

    // Default: activate the defensive buff
    return handleAcBonus(action, playerStats, campaignName);
}

async function handleAcBonus(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check uses remaining
    const chaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
    const usesMax = Math.max(1, chaBonus);
    const usesKey = 'gloriousDefenseUses';
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    // Activate the AC bonus buff
    await setRuntimeValue(playerName, GLORIOUS_DEFENSE_KEY, true, campaignName);
    await setRuntimeValue(playerName, 'gloriousDefenseBonus', Math.max(1, chaBonus), campaignName);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated ${action.name}. CHA modifier (${chaBonus}, min +1) added to AC as a Reaction.`,
        timestamp: Date.now(),
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Add ${Math.max(1, chaBonus)} (Charisma modifier, minimum +1) to AC until the start of your next turn or until used. (${currentUses - 1} uses remaining)`,
            automation: auto,
        },
    };
}

async function handleCounterAttack(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check uses remaining
    const chaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
    const usesMax = Math.max(1, chaBonus);
    const usesKey = 'gloriousDefenseUses';
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    // Get the attacker from combat context
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    // Find a melee weapon attack
    const meleeAttacks = (playerStats.attacks || []).filter(
        a => a.type === 'Action' && a.range === MELEE_REACH_FEET
    );
    const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

    if (!attack) {
        await setRuntimeValue(playerName, usesKey, currentUses, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No melee attack available.`,
                automation: auto,
            },
        };
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to make a weapon attack against ${targetName || 'attacker'}.`,
        timestamp: Date.now(),
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName,
            sourceName: action.name,
        },
    };
}

export function hasGloriousDefenseActive(playerStats) {
    const passives = playerStats?.automation?.passives || [];
    return passives.some(p => p.name === 'Glorious Defense' && p.effect === 'glorious_defense_ac');
}

export function isGloriousDefenseActive(playerName, campaignName) {
    return getRuntimeValue(playerName, GLORIOUS_DEFENSE_KEY, campaignName) === true;
}
