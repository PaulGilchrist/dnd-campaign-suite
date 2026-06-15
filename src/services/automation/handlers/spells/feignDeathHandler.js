import { addExpiration } from '../../../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

const FEIGN_DEATH_CONDITIONS = ['blinded', 'incapacitated', 'speed_zero'];
const FEIGN_DEATH_RESISTANCES = [
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'radiant', 'slashing', 'thunder',
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const sourceName = playerStats.name;
    const targetName = auto.targetName || sourceName;

    // Directly manipulate the activeBuffs array (like combatStanceHandler)
    // so we can store arbitrary properties (resistanceTypes, conditionImmunity)
    // that toggleBuff's fixed property list would strip.
    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === action.name);

    if (wasActive) {
        // Deactivating — remove buff and conditions
        setRuntimeValue(
            targetName,
            'activeBuffs',
            activeBuffs.filter(b => b.name !== action.name),
            campaignName
        );
        removeFeignDeathConditions(targetName, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} expired on ${targetName}.`,
                automation: auto,
            },
        };
    }

    // Activating — build the buff object with all properties
    const buff = {
        name: action.name,
        effect: 'feign_death',
        duration: auto.duration || '1 hour',
        resistanceTypes: FEIGN_DEATH_RESISTANCES,
        conditionImmunity: ['poisoned'],
        sourceCharacter: sourceName,
    };

    setRuntimeValue(targetName, 'activeBuffs', [...activeBuffs, buff], campaignName);

    // Apply conditions to target
    applyFeignDeathConditions(targetName, campaignName);

    // Remove poisoned if target somehow had it (redundant with immunity, but immediate)
    const currentConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    if (Array.isArray(currentConditions)) {
        const filtered = currentConditions.filter(c => String(c).toLowerCase() !== 'poisoned');
        if (filtered.length !== currentConditions.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        }
    }

    // Register expiration so the buff auto-cleans when duration elapses
    addExpiration(sourceName, targetName, [
        { type: 'remove_feign_death_buff', buffName: action.name },
    ], campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated on ${targetName} — target is Blinded, Incapacitated, Speed 0, Resistant to all damage except Psychic, and Immune to Poisoned. Appears dead to inspection and detection spells.`,
            automation: auto,
        },
    };
}

function applyFeignDeathConditions(targetName, campaignName) {
    const currentConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(currentConditions) ? currentConditions : [];
    const updated = [...conditions];
    for (const cond of FEIGN_DEATH_CONDITIONS) {
        if (!updated.some(c => String(c).toLowerCase() === cond)) {
            updated.push(cond);
        }
    }
    setRuntimeValue(targetName, 'activeConditions', updated, campaignName);
}

function removeFeignDeathConditions(targetName, campaignName) {
    const currentConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(currentConditions) ? currentConditions : [];
    const filtered = conditions.filter(c => !FEIGN_DEATH_CONDITIONS.includes(String(c).toLowerCase()));
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }
}
