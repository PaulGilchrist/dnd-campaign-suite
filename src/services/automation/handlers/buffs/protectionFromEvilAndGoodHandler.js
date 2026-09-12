import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { rangeToFeet } from '../../../../services/rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const PROTECTION_FROM_EVIL_AND_GOOD_KEY = 'protectionFromEvilAndGoodWardedTypes';
const WARDED_CREATURE_TYPES = ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];
const SPELL_NAME = 'Protection from Evil and Good';

function getProtectionDuration(spell) {
    return spell.duration || 'Concentration, up to 10 minutes';
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const spell = action.spell || {};
    const casterName = playerStats.name;

    const rangeFt = rangeToFeet(spell.range || 'Touch');

    const positions = _mapName ? await resolveMapPositions(campaignName, _mapName, casterName) : null;
    const attackerPos = positions?.attackerPos || null;

    const combatSummary = getCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];

    // Include the caster in the target list (willing creature you touch)
    const creatureTargets = allCreatures.map(c => c.name);
    if (!creatureTargets.includes(casterName)) {
        creatureTargets.unshift(casterName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'protectionFromEvilAndGood_target_selection',
            name: action.name,
            creatureTargets,
            range: spell.range || 'Touch',
            rangeFt,
            duration: getProtectionDuration(spell),
            attackerPos,
        },
    };
}

export async function applyProtectionFromEvilAndGood(action, playerStats, campaignName, _mapName, targetName) {
    if (!targetName) {
        return null;
    }

    const spell = action.spell || {};
    const casterName = playerStats.name;

    const combatSummary = getCombatSummary(campaignName);

    // Check if already active on this target
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const wasAlreadyActive = activeBuffs.some(b => b.name === SPELL_NAME && b.effect === 'protection_from_evil_and_good');

    if (!wasAlreadyActive) {
        await activateProtection(spell, casterName, targetName, combatSummary, campaignName);
    } else {
        await deactivateProtection(spell, casterName, targetName, combatSummary, campaignName);
    }

    const isSelf = targetName === casterName;
    const isToggle = wasAlreadyActive;
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: SPELL_NAME,
            description: isToggle
                ? `${SPELL_NAME} deactivated on ${targetName}.`
                : `${SPELL_NAME} ${isSelf ? 'self-cast' : `cast on ${targetName}`}. Target is protected against Aberrations, Celestials, Elementals, Fey, Fiends, and Undead. Those creatures have Disadvantage on attack rolls against the target, and the target can't gain the Charmed or Frightened conditions from them. Expires on concentration loss, initiative roll, short rest, or long rest.`,
        },
    };
}

async function activateProtection(spell, casterName, targetName, combatSummary, campaignName) {
    // Toggle the buff on
    toggleBuff(targetName, SPELL_NAME, {
        type: 'protection_from_evil_and_good',
        effect: 'protection_from_evil_and_good',
        wardedCreatureTypes: WARDED_CREATURE_TYPES,
        duration: getProtectionDuration(spell),
        casting_time: spell.casting_time || '1 action',
        range: spell.range || 'Touch',
    }, campaignName);

    // Register concentration
    if (combatSummary) {
        addConcentration(combatSummary, casterName, SPELL_NAME, 0);
        setRuntimeValue('campaign', 'combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    // Register target effect for badge rendering
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const existingFiltered = storedEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return !(teTarget === targetName && te.effect === 'protection_from_evil_and_good');
    });
    const newEffect = {
        target: targetName,
        effect: 'protection_from_evil_and_good',
        source: casterName,
        duration: 'concentration',
    };
    setRuntimeValue('campaign', 'targetEffects', [...existingFiltered, newEffect], campaignName);

    // Store warded types on the target
    setRuntimeValue(targetName, PROTECTION_FROM_EVIL_AND_GOOD_KEY, WARDED_CREATURE_TYPES, campaignName);

    // Register expiration: expires on initiative roll (when target's turn starts), concentration loss, short rest, long rest
    addExpiration(casterName, targetName, [
        { type: 'remove_active_buff', buffName: SPELL_NAME },
        { type: 'remove_target_effect', effectKey: 'protection_from_evil_and_good', source: casterName },
    ], campaignName, Infinity, targetName);

    // Log to campaign
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: SPELL_NAME,
        description: `${casterName} cast ${SPELL_NAME} on ${targetName}. Target is protected against Aberrations, Celestials, Elementals, Fey, Fiends, and Undead. Those creatures have Disadvantage on attack rolls against the target, and the target can't gain the Charmed or Frightened conditions from them.`,
    }).catch((e) => { console.error('[protectionFromEvilAndGood] Error logging:', e); });
}

async function deactivateProtection(spell, casterName, targetName, combatSummary, campaignName) {
    // Toggle off — deactivate
    toggleBuff(targetName, SPELL_NAME, {
        type: 'protection_from_evil_and_good',
        effect: 'protection_from_evil_and_good',
        wardedCreatureTypes: [],
        duration: getProtectionDuration(spell),
    }, campaignName);

    // Clear warded types
    setRuntimeValue(targetName, PROTECTION_FROM_EVIL_AND_GOOD_KEY, [], campaignName);

    // Remove target effect
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const filtered = storedEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return !(teTarget === targetName && te.effect === 'protection_from_evil_and_good');
    });
    if (filtered.length !== storedEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
    }

    // Clear concentration if this was the active concentration
    if (combatSummary) {
        const creature = combatSummary.creatures.find(c => c.name === casterName);
        if (creature && creature.concentration && creature.concentration.spell === SPELL_NAME) {
            creature.concentration = null;
            setRuntimeValue('campaign', 'combatSummary', combatSummary, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }
    }

    // Log deactivation
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: SPELL_NAME,
        description: `${casterName} deactivated ${SPELL_NAME} on ${targetName}.`,
    }).catch((e) => { console.error('[protectionFromEvilAndGood] Error logging deactivation:', e); });
}

export function getProtectionFromEvilAndGoodWardedTypes(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, PROTECTION_FROM_EVIL_AND_GOOD_KEY, campaignName);
    return Array.isArray(stored) ? stored : [];
}

export function isProtectionFromEvilAndGoodActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.name === SPELL_NAME && b.effect === 'protection_from_evil_and_good');
}

export function isCreatureWarded(creatureType, playerName, campaignName) {
    if (!creatureType || !playerName) return false;
    const wardedTypes = getProtectionFromEvilAndGoodWardedTypes(playerName, campaignName);
    if (wardedTypes.length === 0) return false;
    const lowerType = String(creatureType).toLowerCase();
    return wardedTypes.some(t => t.toLowerCase() === lowerType);
}
