import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const DIVINATION_SCHOOL = 'Divination';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const spell = action.spell || {};
    const spellSlotLevel = action.spellSlotLevel || spell.level;

    // Only trigger when casting a Divination spell with a 2+ spell slot
    const school = (spell.school || '').toLowerCase();
    if (school !== DIVINATION_SCHOOL) {
        return null;
    }

    if (!spellSlotLevel || spellSlotLevel < 2) {
        return null;
    }

    // Determine which slot levels we can regain: lower than expended, max level 5
    const maxRegainLevel = Math.min(5, spellSlotLevel - 1);
    if (maxRegainLevel < 1) {
        return null;
    }

    // Check each eligible slot level for available slots
    let bestLevel = null;
    let bestRemaining = 0;

    for (let level = 1; level <= maxRegainLevel; level++) {
        const slotKey = `spell_slots_level_${level}`;
        const currentSlots = getRuntimeValue(playerName, slotKey, campaignName);
        if (currentSlots != null && currentSlots > 0 && currentSlots > bestRemaining) {
            bestLevel = level;
            bestRemaining = currentSlots;
        }
    }

    if (bestLevel == null) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No eligible spell slots available to regain.`,
                automation: auto,
            },
        };
    }

    // Restore one slot of the best available level
    const slotKey = `spell_slots_level_${bestLevel}`;
    const newCount = bestRemaining + 1;
    await setRuntimeValue(playerName, slotKey, newCount, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}: regained 1 spell slot of level ${bestLevel} after casting ${spell.name} with a level ${spellSlotLevel} slot.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name}: You regain 1 expended spell slot. The slot is level ${bestLevel} (must be lower than the expended slot level ${spellSlotLevel} and no higher than level 5).`,
            automation: auto,
        },
    };
}
