import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';

const MAGICAL_CUNNING_KEY = 'magicalCunningUsed';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check long rest restriction
    const alreadyUsed = getRuntimeValue(playerName, MAGICAL_CUNNING_KEY, campaignName);
    if (alreadyUsed) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has already been used. It regains uses after a Long Rest.`,
                automation: auto,
            },
        };
    }

    // Determine if Eldritch Master (level 20) applies
    const isEldritchMaster = action.automation?.eldritchMaster === true;

    // Get max Pact Magic slots
    const maxPactMagic = playerStats.resources?.warlockPactMagic?.max ?? 0;
    if (maxPactMagic <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires Pact Magic spell slots.`,
                automation: auto,
            },
        };
    }

    // Calculate max regain: half maximum (round up)
    const maxRegain = Math.ceil(maxPactMagic / 2);

    // Find the highest spell slot level the warlock has
    const slotLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    let highestSlotLevel = 0;
    for (const level of slotLevels) {
        const slotKey = `spell_slots_level_${level}`;
        const max = playerStats.spellAbilities?.[slotKey] ?? 0;
        if (max > 0) highestSlotLevel = level;
    }

    if (highestSlotLevel <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires Pact Magic spell slots to be available.`,
                automation: auto,
            },
        };
    }

    const slotKey = `spell_slots_level_${highestSlotLevel}`;
    const maxSlots = playerStats.spellAbilities?.[slotKey] ?? 0;
    const currentSlots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? maxSlots);
    const expendedSlots = maxSlots - currentSlots;

    if (expendedSlots <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Pact Magic spell slots have been expended.`,
                automation: auto,
            },
        };
    }

    // Determine how many slots to regain
    let slotsToRegain;
    if (isEldritchMaster) {
        // Eldritch Master: regain ALL expended slots
        slotsToRegain = expendedSlots;
    } else {
        // Normal Magical Cunning: max half (round up)
        slotsToRegain = Math.min(expendedSlots, maxRegain);
    }

    if (slotsToRegain <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No slots to regain.`,
                automation: auto,
            },
        };
    }

    // Restore the slots
    const newSlotValue = currentSlots + slotsToRegain;
    await setRuntimeValue(playerName, slotKey, newSlotValue, campaignName);

    // Mark as used for this rest
    await setRuntimeValue(playerName, MAGICAL_CUNNING_KEY, true, campaignName);

    // Apply Celestial Resilience if the warlock has the Celestial Patron
    const isCelestial = playerStats.class?.major?.name === 'Celestial Patron'
        || playerStats.class?.subclass?.name === 'Celestial Patron';

    let celestText = '';
    if (isCelestial) {
        const warlockLevel = playerStats.level || 0;
        const chaMod = getAbilityModifier(playerStats.abilities, 'Charisma');
        const selfTempHp = warlockLevel + chaMod;
        const allyTempHp = Math.floor(warlockLevel / 2) + chaMod;

        // Grant self temp HP
        const existingTempHp = Number(getRuntimeValue(playerName, 'tempHp', campaignName) || 0);
        await setRuntimeValue(playerName, 'tempHp', existingTempHp + selfTempHp, campaignName);

        celestText = `<br/>Celestial Resilience: You gain ${selfTempHp} temporary hit points.`;
        if (allyTempHp > 0) {
            celestText += ` Up to 5 creatures you can see may gain ${allyTempHp} temporary hit points.`;
        }
    }

    const elderText = isEldritchMaster ? ' (Eldritch Master)' : '';
    const description = `${action.name}${elderText}: Regained ${slotsToRegain} ${highestSlotLevel}th-level Pact Magic spell slot${slotsToRegain > 1 ? 's' : ''}. (${newSlotValue}/${maxSlots} slots available)${celestText}`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used Magical Cunning, regaining ${slotsToRegain} expended Pact Magic spell slot(s).`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };
}

export function isMagicalCunningUsed(playerName, campaignName) {
    return getRuntimeValue(playerName, MAGICAL_CUNNING_KEY, campaignName) === true;
}
