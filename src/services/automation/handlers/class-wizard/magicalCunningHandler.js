import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { grantCelestialResilience } from '../class-warlock/celestialResilienceHandler.js';

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
    // Check both direct automation flag and passive character advancement feature
    const isEldritchMaster = action.automation?.eldritchMaster === true
        || playerStats.specialActions?.some(f => f.name === 'Eldritch Master');

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

    // Get max Pact Magic slots: from resource if available, otherwise derive from highest spell slot level
    const maxPactMagic = playerStats.resources?.warlockPactMagic?.max ?? 0;
    const maxSlots = playerStats.spellAbilities?.[`spell_slots_level_${highestSlotLevel}`] ?? 0;
    const effectiveMaxPactMagic = maxPactMagic > 0 ? maxPactMagic : maxSlots;

    // Calculate max regain: half maximum (round up)
    const maxRegain = Math.ceil(effectiveMaxPactMagic / 2);

    const slotKey = `spell_slots_level_${highestSlotLevel}`;
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
    let celestText = '';
    const celestialResult = await grantCelestialResilience(playerStats, campaignName, 'magical_cunning');
    if (celestialResult) {
        celestText = `<br/>Celestial Resilience: ${celestialResult.message}`;
        if (celestialResult.allyTempHp && celestialResult.allyTempHp > 0) {
            celestText += ` Up to ${celestialResult.maxAllies} creatures you can see may gain ${celestialResult.allyTempHp} temporary hit points.`;
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
    }).catch((e) => { console.error("[magicalCunning] Error:", e); });

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
