import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

function getBardicInspirationMax(playerStats) {
    const charisma = playerStats.abilities?.find(a => a.name === 'Charisma');
    return charisma?.bonus || 0;
}

function findLowestAvailableSpellSlot(playerStats) {
    const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const level of levels) {
        const key = `spell_slots_level_${level}`;
        const current = getRuntimeValue(playerStats.name, key);
        const max = playerStats.spellAbilities?.[key] ?? 0;
        const stored = current != null ? Number(current) : max;
        if (stored > 0) {
            return { level, key };
        }
    }
    return null;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Font of Inspiration';

    const biMax = getBardicInspirationMax(playerStats);
    const biCurrent = getRuntimeValue(playerName, 'bardicInspirationUses');
    const biStored = biCurrent != null ? Number(biCurrent) : biMax;

    if (biStored >= biMax) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: Bardic Inspiration uses are already at maximum (${biMax}/${biMax}).`,
                automation: auto,
            },
        };
    }

    const spellSlot = findLowestAvailableSpellSlot(playerStats);
    if (!spellSlot) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No spell slots available to expend.`,
                automation: auto,
            },
        };
    }

    const currentSlot = getRuntimeValue(playerName, spellSlot.key);
    const slotMax = playerStats.spellAbilities?.[spellSlot.key] ?? 0;
    const slotStored = currentSlot != null ? Number(currentSlot) : slotMax;

    if (slotStored <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No spell slots of level ${spellSlot.level} available.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, spellSlot.key, slotStored - 1, campaignName);
    await setRuntimeValue(playerName, 'bardicInspirationUses', biStored + 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}: expended a level ${spellSlot.level} spell slot to regain 1 Bardic Inspiration use.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automation: auto,
            description: `${featureName}: Expended a level ${spellSlot.level} spell slot. Bardic Inspiration uses: ${biStored + 1}/${biMax}.`,
        },
    };
}
