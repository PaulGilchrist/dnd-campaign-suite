import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const ELDER_CHAMPION_KEY = 'elderChampionActive';
const ELDER_CHAMPION_REST_KEY = 'elderChampionRestUsed';

function isActionSpell(castingTime) {
    const ct = castingTime || '';
    const normalized = ct.toLowerCase().replace(/\s+/g, '');
    return normalized === '1action' || normalized === 'action';
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === action.name);

    if (wasActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} is already active.`,
                automation: auto,
            },
        };
    }

    // Check long rest - if already used, try to expend a level 5 spell slot
    const alreadyUsed = getRuntimeValue(playerName, ELDER_CHAMPION_REST_KEY, campaignName);
    if (alreadyUsed) {
        const slotKey = 'spell_slots_level_5';
        const currentSlots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? 0);
        if (currentSlots <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} cannot be used again until a long rest or level 5 spell slot becomes available.`,
                    automation: auto,
                },
            };
        }

        await setRuntimeValue(playerName, slotKey, currentSlots - 1, campaignName);
        await setRuntimeValue(playerName, ELDER_CHAMPION_KEY, true, campaignName);

        const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffList = Array.isArray(storedBuffs) ? storedBuffs : [];
        const buffEntry = {
            name: action.name,
            effect: 'elder_champion',
            duration: auto.duration || '1_minute',
            hasAutomation: true,
        };
        const newBuffs = activeBuffList.some(b => b.name === action.name)
            ? activeBuffList
            : [...activeBuffList, buffEntry];
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} activated Elder Champion by expending a level 5 spell slot.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[elderChampion] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} activated by expending a level 5 spell slot.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, ELDER_CHAMPION_KEY, true, campaignName);
    await setRuntimeValue(playerName, ELDER_CHAMPION_REST_KEY, true, campaignName);

    const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffList = Array.isArray(storedBuffs) ? storedBuffs : [];
    const buffEntry = {
        name: action.name,
        effect: 'elder_champion',
        duration: auto.duration || '1_minute',
        hasAutomation: true,
    };
    const newBuffs = activeBuffList.some(b => b.name === action.name)
        ? activeBuffList
        : [...activeBuffList, buffEntry];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Elder Champion. Aura of Protection is imbued with primal power for 1 minute.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[elderChampion] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Aura of Protection is imbued with primal power for 1 minute.`,
            automation: auto,
        },
    };
}

export function isElderChampionActive(playerName, campaignName) {
    return getRuntimeValue(playerName, ELDER_CHAMPION_KEY, campaignName) === true;
}

export function hasActionSpells(playerStats) {
    const spells = playerStats.spells || [];
    return spells.some(spell => isActionSpell(spell.casting_time));
}
