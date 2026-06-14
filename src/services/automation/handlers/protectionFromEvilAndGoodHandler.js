import { toggleBuff } from '../common/buffToggle.js';
import { addExpiration } from '../../rules/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

const PROTECTION_FROM_EVIL_AND_GOOD_KEY = 'protectionFromEvilAndGoodWardedTypes';
const WARDED_CREATURE_TYPES = ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const { wasActive } = toggleBuff(
        playerName,
        action.name,
        {
            ...auto,
            effect: 'protection_from_evil_and_good',
            wardedCreatureTypes: WARDED_CREATURE_TYPES,
        },
        campaignName
    );

    if (!wasActive) {
        addExpiration(playerName, playerName, [
            { type: 'remove_active_buff', buffName: action.name }
        ], campaignName);

        setRuntimeValue(
            playerName,
            PROTECTION_FROM_EVIL_AND_GOOD_KEY,
            WARDED_CREATURE_TYPES,
            campaignName
        );
    } else {
        setRuntimeValue(
            playerName,
            PROTECTION_FROM_EVIL_AND_GOOD_KEY,
            [],
            campaignName
        );
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: wasActive
                ? `${action.name} deactivated`
                : `${action.name} activated — warded creatures have Disadvantage on attack rolls against target, target can't be charmed/frightened/possessed by them, advantage on new saves against existing effects`,
            automation: auto,
        },
    };
}

export function getProtectionFromEvilAndGoodWardedTypes(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, PROTECTION_FROM_EVIL_AND_GOOD_KEY, campaignName);
    return Array.isArray(stored) ? stored : [];
}

export function isProtectionFromEvilAndGoodActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.name === 'Protection from Evil and Good' && b.effect === 'protection_from_evil_and_good');
}

export function isCreatureWarded(creatureType, playerName, campaignName) {
    if (!creatureType || !playerName) return false;
    const wardedTypes = getProtectionFromEvilAndGoodWardedTypes(playerName, campaignName);
    if (wardedTypes.length === 0) return false;
    const lowerType = String(creatureType).toLowerCase();
    return wardedTypes.some(t => t.toLowerCase() === lowerType);
}
