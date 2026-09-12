import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { infoPopup } from '../../common/infoPopup.js';
import { handle as handleCelestialResilience } from '../class-warlock/celestialResilienceHandler.js';

const MAGICAL_CUNNING_KEY = 'magicalCunningUsed';

function findHighestSlotLevel(playerStats) {
    const slotLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    let highestSlotLevel = 0;
    for (const level of slotLevels) {
        const slotKey = `spell_slots_level_${level}`;
        const max = playerStats.spellAbilities?.[slotKey] ?? 0;
        if (max > 0) highestSlotLevel = level;
    }
    return highestSlotLevel;
}

function resolveRegainPlan(playerStats, highestSlotLevel, isEldritchMaster, campaignName) {
    // Get max Pact Magic slots: from resource if available, otherwise derive from highest spell slot level
    const maxPactMagic = playerStats.resources?.warlockPactMagic?.max ?? 0;
    const maxSlots = playerStats.spellAbilities?.[`spell_slots_level_${highestSlotLevel}`] ?? 0;
    const effectiveMaxPactMagic = maxPactMagic > 0 ? maxPactMagic : maxSlots;

    // Calculate max regain: half maximum (round up)
    const maxRegain = Math.ceil(effectiveMaxPactMagic / 2);

    const slotKey = `spell_slots_level_${highestSlotLevel}`;
    const currentSlots = Number(getRuntimeValue(playerStats.name, slotKey, campaignName) ?? maxSlots);
    const expendedSlots = maxSlots - currentSlots;

    // Determine how many slots to regain:
    // Eldritch Master regains ALL expended slots; Magical Cunning max half (round up).
    const slotsToRegain = isEldritchMaster ? expendedSlots : Math.min(expendedSlots, maxRegain);

    return { slotKey, maxSlots, currentSlots, expendedSlots, slotsToRegain };
}

async function resolveCelestialResilienceOutcome(action, playerStats, campaignName, _mapName) {
    const celestialResult = await handleCelestialResilience(action, playerStats, campaignName, _mapName);
    if (!celestialResult) return { celestText: '', celestialModal: null };
    if (celestialResult.type === 'modal') return { celestText: '', celestialModal: celestialResult };
    if (celestialResult.payload?.description) {
        return { celestText: `<br/>Celestial Resilience: ${celestialResult.payload.description}`, celestialModal: null };
    }
    return { celestText: '', celestialModal: null };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check long rest restriction
    const alreadyUsed = getRuntimeValue(playerName, MAGICAL_CUNNING_KEY, campaignName);
    if (alreadyUsed) {
        return infoPopup(action.name, `${action.name} has already been used. It regains uses after a Long Rest.`, auto);
    }

    // Determine if Eldritch Master (level 20) applies
    // Check both direct automation flag and passive character advancement feature
    const isEldritchMaster = action.automation?.eldritchMaster === true
        || playerStats.specialActions?.some(f => f.name === 'Eldritch Master');

    const highestSlotLevel = findHighestSlotLevel(playerStats);

    if (highestSlotLevel <= 0) {
        return infoPopup(action.name, `${action.name} requires Pact Magic spell slots to be available.`, auto);
    }

    const { slotKey, maxSlots, currentSlots, expendedSlots, slotsToRegain } =
        resolveRegainPlan(playerStats, highestSlotLevel, isEldritchMaster, campaignName);

    if (expendedSlots <= 0) {
        return infoPopup(action.name, `${action.name}: No Pact Magic spell slots have been expended.`, auto);
    }

    if (slotsToRegain <= 0) {
        return infoPopup(action.name, `${action.name}: No slots to regain.`, auto);
    }

    // Restore the slots
    const newSlotValue = currentSlots + slotsToRegain;
    await setRuntimeValue(playerName, slotKey, newSlotValue, campaignName);

    // Mark as used for this rest
    await setRuntimeValue(playerName, MAGICAL_CUNNING_KEY, true, campaignName);

    const { celestText, celestialModal } = await resolveCelestialResilienceOutcome(action, playerStats, campaignName, _mapName);

    const elderText = isEldritchMaster ? ' (Eldritch Master)' : '';
    const description = `${action.name}${elderText}: Regained ${slotsToRegain} ${highestSlotLevel}th-level Pact Magic spell slot${slotsToRegain > 1 ? 's' : ''}. (${newSlotValue}/${maxSlots} slots available)${celestText}`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used Magical Cunning, regaining ${slotsToRegain} expended Pact Magic spell slot(s).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[magicalCunning] Error:", e); });

    if (celestialModal) {
        return celestialModal;
    }

    return infoPopup(action.name, description, auto);
}

export function isMagicalCunningUsed(playerName, campaignName) {
    return getRuntimeValue(playerName, MAGICAL_CUNNING_KEY, campaignName) === true;
}
