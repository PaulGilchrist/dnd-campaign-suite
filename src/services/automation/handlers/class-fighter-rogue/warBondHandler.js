import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const BONDED_KEY = 'warBondWeapons';
const SUMMONED_KEY = 'warBondSummoned';

// CLA-379: War Bond (Eldritch Knight lv3, 2024). The bond pool is written IN-APP
// via the "Bond Weapon:" chooser row (handleBond below, cap bondedWeaponCount).
// modalName 'warBondSummon' is registered in useCharActionsAutomation modalMap
// and rendered in CharActionModals.SecondaryModals.jsx. The sibling passive
// 'war_bond_disarm_protection' is DISPLAY-ONLY — no disarm mechanic exists
// app-wide, so there is nothing to enforce (recorded residual, do not build a
// disarm subsystem without its own ticket).

function logAbilityUse(campaignName, playerName, actionName, description) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: actionName,
        description,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[warBondHandler:log-error]', e); });
}

function logRefusal(campaignName, playerName, actionName, reason) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'war_bond_refused',
        name: actionName,
        description: `${actionName} refused — ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[warBondHandler:log-error]', e); });
}

function popup(action, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto?.type,
            description,
            automation: auto,
        },
    };
}

export function inventoryWeaponNames(playerStats) {
    const inventory = playerStats?.inventory || {};
    const names = [...(inventory.equipped || []), ...(inventory.backpack || [])];
    return [...new Set(names.map(n => (typeof n === 'string' ? n.trim() : '')).filter(Boolean))];
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxBonded = auto.bondedWeaponCount || 2;

    const bondedWeapons = getRuntimeValue(playerName, BONDED_KEY, campaignName);
    const bonded = Array.isArray(bondedWeapons) ? bondedWeapons : [];

    if (bonded.length === 0) {
        const reason = `No bonded weapons. Use "Bond Weapon:" to bond a weapon first (up to ${maxBonded}).`;
        logRefusal(campaignName, playerName, action.name, reason);
        return popup(action, auto, reason);
    }

    if (bonded.length === 1) {
        const weaponName = bonded[0];
        await setRuntimeValue(playerName, SUMMONED_KEY, weaponName, campaignName);
        logAbilityUse(campaignName, playerName, action.name,
            `${action.name}: ${weaponName} is summoned to ${playerName}'s hand.`);
        return popup(action, auto, `${action.name}: ${weaponName} is summoned to your hand.`);
    }

    return {
        type: 'modal',
        modalName: 'warBondSummon',
        payload: { action, playerStats, campaignName, bondedWeapons: bonded, maxBonded },
    };
}

export async function handleSummon(action, playerStats, campaignName, selectedWeapon) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (!selectedWeapon) {
        const reason = 'No weapon selected.';
        logRefusal(campaignName, playerName, action.name, reason);
        return popup(action, auto, reason);
    }

    await setRuntimeValue(playerName, SUMMONED_KEY, selectedWeapon, campaignName);
    logAbilityUse(campaignName, playerName, action.name,
        `${action.name}: ${selectedWeapon} is summoned to ${playerName}'s hand.`);
    return popup(action, auto, `${action.name}: ${selectedWeapon} is summoned to your hand.`);
}

export async function handleBond(selectedWeapons, playerStats, campaignName, maxBonded = 2) {
    const playerName = playerStats.name;
    const selected = [...new Set((Array.isArray(selectedWeapons) ? selectedWeapons : [])
        .map(w => (typeof w === 'string' ? w.trim() : '')).filter(Boolean))];

    if (selected.length === 0) {
        const reason = 'No weapon selected to bond.';
        logRefusal(campaignName, playerName, 'War Bond', reason);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'War Bond',
                description: reason,
            },
        };
    }

    const allowed = inventoryWeaponNames(playerStats);
    const invalid = selected.filter(w => !allowed.includes(w));
    if (invalid.length > 0) {
        const reason = `Not in inventory: ${invalid.join(', ')}. Bond only weapons you carry.`;
        logRefusal(campaignName, playerName, 'War Bond', reason);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'War Bond',
                description: reason,
            },
        };
    }

    const bonded = selected.slice(0, maxBonded);
    await setRuntimeValue(playerName, BONDED_KEY, bonded, campaignName);
    logAbilityUse(campaignName, playerName, 'War Bond',
        `War Bond: bonded ${bonded.join(', ')} (${bonded.length}/${maxBonded}).`);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'War Bond',
            description: `Bonded ${bonded.join(', ')} (${bonded.length}/${maxBonded}). Summon a bonded weapon as a Bonus Action.`,
        },
    };
}
