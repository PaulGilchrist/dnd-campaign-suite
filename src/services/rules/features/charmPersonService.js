import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';

/**
 * Check whether a creature (by name) is a Humanoid.
 * Players are always Humanoid. NPCs are checked against monster data.
 */
async function isTargetHumanoid(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return true;

    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) return true;

    if (creature.type === 'player') return true;

    try {
        const monsterData = await getMonsterData(targetName, null);
        if (monsterData?.type) {
            return monsterData.type.toLowerCase() === 'humanoid';
        }
    } catch {
        // If we can't load monster data, default to Humanoid
    }

    return true;
}

export async function triggerCharmPerson(spell, metaCtx, playerStats, campaignName, mapName) {
    const isCharmPerson = (spell.name || '').toLowerCase() === 'charm person';
    if (!isCharmPerson) return null;

    let targetName = metaCtx?.targetName;
    if (!targetName) {
        const cs = await getCombatContext(campaignName);
        if (cs?.creatures && cs.creatures.length > 0) {
            const nonCaster = cs.creatures.find(c => c.name !== playerStats.name);
            if (nonCaster) targetName = nonCaster.name;
        }
    }
    if (!targetName) {
        return { type: 'popup', payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected for Charm Person.' } };
    }

    // Check: Target is not a Humanoid
    const humanoid = await isTargetHumanoid(targetName, campaignName);
    if (!humanoid) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Charm Person',
            description: `${playerStats.name} casts Charm Person on ${targetName} but it has no effect — ${targetName} is not a Humanoid.`,
        }).catch(() => {});
        return { type: 'popup', payload: { type: 'automation_info', name: 'Charm Person', description: `No effect. ${targetName} is not a Humanoid.` } };
    }

    // Check if caster/target are in combat to determine if target gets advantage on save
    const cs = await getCombatContext(campaignName);
    const targetInCombat = cs?.creatures.some(c => c.name === targetName && c.name !== playerStats.name) ?? false;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 1;

    const action = {
        name: 'Charm Person',
        automation: {
            type: 'charm_person',
            saveDc: spellSaveDc,
            targetName: targetName,
            advantage: targetInCombat,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[charmPersonService] Failed to execute Charm Person handler:', e);
        return { type: 'popup', payload: { type: 'automation_info', name: 'Charm Person', description: `Failed to execute Charm Person.` } };
    }
}
