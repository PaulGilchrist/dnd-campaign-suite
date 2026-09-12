import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';


/**
 * Check whether a creature (by name) is a Beast.
 * Players are never Beasts. NPCs are checked against monster data.
 */
async function isTargetBeast(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return true;

    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) return true;

    // Players are never Beasts
    if (creature.type === 'player') return false;

    try {
        const monsterData = await getMonsterData(targetName, null);
        if (monsterData?.type) {
            return monsterData.type.toLowerCase() === 'beast';
        }
    } catch (error) {
        // If we can't load monster data, default to not a Beast
        console.warn('[animalFriendshipService] Monster data unavailable, defaulting to not a Beast:', error);
    }

    return false;
}

async function collectBeastTargetNames(campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) return [];
    const beasts = [];
    for (const creature of cs.creatures) {
        const isBeast = await isTargetBeast(creature.name, campaignName);
        if (isBeast) {
            beasts.push(creature.name);
        }
    }
    return beasts;
}

function resolveSpellSaveDc(metaCtx, playerStats) {
    return metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
}

export async function triggerAnimalFriendship(spell, metaCtx, playerStats, campaignName, mapName) {
    const isAnimalFriendship = (spell.name || '').toLowerCase() === 'animal friendship';
    if (!isAnimalFriendship) return null;

    let targetNames = metaCtx?.targetNames;

    if (!targetNames || targetNames.length === 0) {
        targetNames = await collectBeastTargetNames(campaignName);
    }

    if (!targetNames || targetNames.length === 0) {
        return { type: 'popup', payload: { type: 'automation_info', name: 'Animal Friendship', description: 'No Beast targets available for Animal Friendship.' } };
    }

    const spellSaveDc = resolveSpellSaveDc(metaCtx, playerStats);
    const slotLevel = metaCtx?.slotLevel || spell.level || 1;

    const action = {
        name: 'Animal Friendship',
        automation: {
            type: 'animal_friendship',
            saveDc: spellSaveDc,
            targetNames: targetNames,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[animalFriendshipService] Failed to execute Animal Friendship:', e);
        return { type: 'popup', payload: { type: 'automation_info', name: 'Animal Friendship', description: `Failed to execute Animal Friendship.` } };
    }
}
