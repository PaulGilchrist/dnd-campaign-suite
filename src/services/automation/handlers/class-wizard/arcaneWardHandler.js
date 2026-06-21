import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const ARCAN_WARD_KEY = 'arcaneWardHp';
const ARCAN_WARD_ACTIVE_KEY = 'arcaneWardActive';
const ARCAN_WARD_MAX_KEY = 'arcaneWardMax';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if ward is active
    const isActive = getRuntimeValue(playerName, ARCAN_WARD_ACTIVE_KEY, campaignName);
    if (!isActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Arcane Ward is not active. Cast an Abjuration spell with a spell slot to create the ward.`,
                automation: auto,
            },
        };
    }

    const currentHp = Number(getRuntimeValue(playerName, ARCAN_WARD_KEY, campaignName) ?? 0);
    const maxHp = Number(getRuntimeValue(playerName, ARCAN_WARD_MAX_KEY, campaignName) ?? 0);

    // Show ward status
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Ward HP: ${currentHp}/${maxHp}.<br/><br/>
                <b>On Long Rest:</b> Ward is destroyed.<br/>
                <b>On Abjuration spell cast:</b> Ward regains HP = 2 × spell slot level.<br/>
                <b>Bonus Action:</b> Expend a spell slot to restore Ward HP = 2 × spell slot level.`,
            automation: auto,
        },
    };
}

export async function onArcaneWardRestore(action, playerStats, spellSlotLevel, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const spellSlotLevelNum = Number(spellSlotLevel) || 1;

    const restoreAmount = spellSlotLevelNum * 2;

    const maxHp = Number(getRuntimeValue(playerName, ARCAN_WARD_MAX_KEY, campaignName) ?? 0);
    const currentHp = Number(getRuntimeValue(playerName, ARCAN_WARD_KEY, campaignName) ?? 0);
    const newHp = Math.min(maxHp, currentHp + restoreAmount);

    await setRuntimeValue(playerName, ARCAN_WARD_KEY, newHp, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used Arcane Ward (Bonus Action) to restore ${restoreAmount} HP to the ward (${currentHp} → ${newHp}/${maxHp}). Expend spell slot level ${spellSlotLevelNum}.`,
    }).catch(() => { });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Ward restored ${restoreAmount} HP (${currentHp} → ${newHp}/${maxHp}). Expend spell slot level ${spellSlotLevelNum}.`,
            automation: auto,
        },
    };
}

export async function onArcaneWardBonusActionRestore(action, playerStats, campaignName) {
    const playerName = playerStats.name;

    // Find the lowest available spell slot level
    let lowestSlotLevel = null;
    for (let level = 1; level <= 9; level++) {
        const slotKey = `spell_slots_level_${level}`;
        const slots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? 0);
        if (slots > 0) {
            lowestSlotLevel = level;
            break;
        }
    }

    if (lowestSlotLevel === null) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No spell slots available to expend.`,
                automation: action.automation,
            },
        };
    }

    const isActive = getRuntimeValue(playerName, ARCAN_WARD_ACTIVE_KEY, campaignName);
    if (!isActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Arcane Ward is not active. Cast an Abjuration spell with a spell slot to create the ward.`,
                automation: action.automation,
            },
        };
    }

    const restoreAmount = lowestSlotLevel * 2;
    const maxHp = Number(getRuntimeValue(playerName, ARCAN_WARD_MAX_KEY, campaignName) ?? 0);
    const currentHp = Number(getRuntimeValue(playerName, ARCAN_WARD_KEY, campaignName) ?? 0);
    const newHp = Math.min(maxHp, currentHp + restoreAmount);

    await setRuntimeValue(playerName, ARCAN_WARD_KEY, newHp, campaignName);
    await setRuntimeValue(playerName, `spell_slots_level_${lowestSlotLevel}`, getRuntimeValue(playerName, `spell_slots_level_${lowestSlotLevel}`, campaignName) - 1, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used Arcane Ward (Bonus Action) to restore ${restoreAmount} HP to the ward (${currentHp} → ${newHp}/${maxHp}). Expend spell slot level ${lowestSlotLevel}.`,
    }).catch(() => { });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: `${action.name}: Ward restored ${restoreAmount} HP (${currentHp} → ${newHp}/${maxHp}). Expend spell slot level ${lowestSlotLevel}.`,
            automation: action.automation,
        },
    };
}

export async function onArcaneWardDestroy(action, playerStats, campaignName) {
    const playerName = playerStats.name;

    await setRuntimeValue(playerName, ARCAN_WARD_ACTIVE_KEY, false, campaignName);
    await setRuntimeValue(playerName, ARCAN_WARD_KEY, 0, campaignName);
    await setRuntimeValue(playerName, ARCAN_WARD_MAX_KEY, 0, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name}: Ward is destroyed (Long Rest).`,
            automation: action.automation,
        },
    };
}

export async function onArcaneWardLevelUp(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const wizardLevel = playerStats.level;
    const newMaxHp = wizardLevel * 2 + intMod;

    const isActive = getRuntimeValue(playerName, ARCAN_WARD_ACTIVE_KEY, campaignName);
    if (!isActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Arcane Ward is not active. Cast an Abjuration spell with a spell slot to create the ward.`,
                automation: action.automation,
            },
        };
    }

    const currentHp = Number(getRuntimeValue(playerName, ARCAN_WARD_KEY, campaignName) ?? 0);
    const prevMaxHp = Number(getRuntimeValue(playerName, ARCAN_WARD_MAX_KEY, campaignName) ?? 0);

    // Scale up current HP proportionally if the max increased
    let newHp = currentHp;
    if (prevMaxHp > 0 && newMaxHp > prevMaxHp) {
        const ratio = newMaxHp / prevMaxHp;
        newHp = Math.min(newMaxHp, Math.round(currentHp * ratio));
    }

    await setRuntimeValue(playerName, ARCAN_WARD_MAX_KEY, newMaxHp, campaignName);
    await setRuntimeValue(playerName, ARCAN_WARD_KEY, newHp, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Arcane Ward HP increased to ${newMaxHp} (${newHp} current). New max: 2 × Wizard level (${wizardLevel}) + INT modifier (${intMod}) = ${newMaxHp}.`,
            automation: action.automation,
        },
    };
}

export async function onAbjurationSpellCast(action, playerStats, spellName, spellSlotLevel, campaignName) {
    const playerName = playerStats.name;
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const wizardLevel = playerStats.level;

    const spellSlotLevelNum = Number(spellSlotLevel) || 1;
    const restoreAmount = spellSlotLevelNum * 2;

    // Check if ward is already active
    let isActive = getRuntimeValue(playerName, ARCAN_WARD_ACTIVE_KEY, campaignName);

    if (!isActive) {
        // Create new ward
        const maxHp = wizardLevel * 2 + intMod;
        await setRuntimeValue(playerName, ARCAN_WARD_ACTIVE_KEY, true, campaignName);
        await setRuntimeValue(playerName, ARCAN_WARD_MAX_KEY, maxHp, campaignName);
        await setRuntimeValue(playerName, ARCAN_WARD_KEY, maxHp, campaignName);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Arcane Ward',
            description: `${playerName} created Arcane Ward by casting ${spellName} (level ${spellSlotLevelNum}). Ward HP: ${maxHp}.`,
        }).catch(() => { });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Arcane Ward',
                description: `Arcane Ward created by casting ${spellName}! Ward HP: ${maxHp}/${maxHp}. Regains ${restoreAmount} HP when you cast an Abjuration spell with a spell slot.`,
                automation: action.automation,
            },
        };
    }

    // Ward already active — restore HP
    const currentHp = Number(getRuntimeValue(playerName, ARCAN_WARD_KEY, campaignName) ?? 0);
    const maxHp = Number(getRuntimeValue(playerName, ARCAN_WARD_MAX_KEY, campaignName) ?? 0);
    const newHp = Math.min(maxHp, currentHp + restoreAmount);

    await setRuntimeValue(playerName, ARCAN_WARD_KEY, newHp, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Arcane Ward',
        description: `${playerName} cast ${spellName} (level ${spellSlotLevelNum}). Arcane Ward restored ${restoreAmount} HP (${currentHp} → ${newHp}/${maxHp}).`,
    }).catch(() => { });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Arcane Ward',
            description: `Arcane Ward restored ${restoreAmount} HP (${currentHp} → ${newHp}/${maxHp}) by casting ${spellName}.`,
            automation: action.automation,
        },
    };
}
