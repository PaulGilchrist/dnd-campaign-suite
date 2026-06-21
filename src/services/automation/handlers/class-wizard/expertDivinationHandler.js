import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const DIVINATION_SCHOOL = 'divination';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const spell = action.spell || {};
    const spellSlotLevel = action.spellSlotLevel || spell.level;

    const school = (spell.school || '').toLowerCase();
    if (school !== DIVINATION_SCHOOL) {
        return null;
    }

    if (!spellSlotLevel || spellSlotLevel < 2) {
        return null;
    }

    const maxRegainLevel = Math.min(5, spellSlotLevel - 1);
    if (maxRegainLevel < 1) {
        return null;
    }

    const spellAbilities = playerStats.spellAbilities || {};

    // Iterate from highest eligible level downward; pick the first level
    // that has at least one expended slot (0 < current < max)
    let bestLevel = null;
    let bestCurrentSlots = null;

    for (let level = maxRegainLevel; level >= 1; level--) {
        const slotKey = `spell_slots_level_${level}`;
        const maxSlots = spellAbilities[slotKey] ?? 0;
        if (maxSlots <= 0) continue;

        const currentSlots = getRuntimeValue(playerName, slotKey, campaignName);
        if (currentSlots != null && currentSlots > 0 && currentSlots < maxSlots) {
            bestLevel = level;
            bestCurrentSlots = currentSlots;
            break;
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

    const slotKey = `spell_slots_level_${bestLevel}`;
    const newCount = bestCurrentSlots + 1;
    await setRuntimeValue(playerName, slotKey, newCount, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}: regained 1 spell slot of level ${bestLevel} after casting ${spell.name} with a level ${spellSlotLevel} slot.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[expertDivination] Error:", e); throw e; });

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
