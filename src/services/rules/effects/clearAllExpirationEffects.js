import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import storage from '../../ui/storage.js';
import { getCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import { removeSummonedCreatures } from '../../combat/summons/summonedCreatureService.js';
import { addEntry } from '../../ui/logService.js';
import { clearExpirationEffects } from './clearExpirationEffects.js';
import { KEY } from './turnStartEffects.js';

// Clear all active buffs (Innate Sorcery, Reckless Attack, etc.)
// Preserve 8-hour duration buffs (Mage Armor, Death Ward) - only ends on long rest
function clearSelfBuffs(characterName, campaignName) {
    const existingBuffs = getRuntimeValue(characterName, 'activeBuffs') || [];
    const preservedBuffs = Array.isArray(existingBuffs) ? existingBuffs.filter(b => b.name === 'Mage Armor' || b.name === 'Death Ward') : [];
    setRuntimeValue(characterName, 'activeBuffs', preservedBuffs, campaignName);
    setRuntimeValue(characterName, 'mantleOfMajestyActive', null, campaignName);
    setRuntimeValue(characterName, 'innerRadianceActive', null, campaignName);
    setRuntimeValue(characterName, 'unbreakableMajestyActive', null, campaignName);
    setRuntimeValue(characterName, 'unbreakableMajestySaveDc', null, campaignName);

    // Clear Bait and Switch (Evasive Footwork) AC bonus
    const wasActive = getRuntimeValue(characterName, 'baitAndSwitchActive');
    if (wasActive) {
        setRuntimeValue(characterName, 'baitAndSwitchActive', null, campaignName);
        setRuntimeValue(characterName, 'baitAndSwitchBonus', null, campaignName);
        setRuntimeValue(characterName, 'baitAndSwitchSource', null, campaignName);
    }

    // Clear Smite of Protection cover
    setRuntimeValue(characterName, 'smiteOfProtectionActive', null, campaignName);
    // Clear Bulwark of Force cover
    setRuntimeValue(characterName, 'bulwarkOfForceActive', null, campaignName);
    setRuntimeValue(characterName, 'bulwarkOfForceTargets', null, campaignName);
    // Clear Nature's Sanctuary cover
    setRuntimeValue(characterName, 'naturesSanctuaryActive', null, campaignName);
    setRuntimeValue(characterName, 'naturesSanctuaryCreatures', null, campaignName);
    setRuntimeValue(characterName, 'naturesSanctuaryRange', null, campaignName);
}

// --- "From me": clear all effects I have on other targets ---
function clearMyOutgoingExpirations(characterName, campaignName) {
    const myList = getRuntimeValue(characterName, KEY);
    if (!Array.isArray(myList)) {
        setRuntimeValue(characterName, KEY, [], campaignName);
        return;
    }
    for (const entry of myList) {
        clearExpirationEffects(entry.effects, entry.target, characterName, campaignName);
    }
    setRuntimeValue(characterName, KEY, [], campaignName);
}

// --- Scan all runtime stores for "to me" entries ---
function clearIncomingExpirations(charLower, campaignName) {
    const allKeys = getAllStoreKeys();
    for (const key of allKeys) {
        if (typeof key !== 'string') continue;
        if (key.toLowerCase() === charLower) continue;

        const list = getRuntimeValue(key, KEY);
        if (!Array.isArray(list)) continue;
        if (!list.length) continue;

        const kept = [];
        for (const entry of list) {
            const targetLower = utils.getName(entry.target).toLowerCase();

            // Clear if the effect targets me
            if (targetLower === charLower) {
                clearExpirationEffects(entry.effects, entry.target, key, campaignName);
                continue;
            }

            kept.push(entry);
        }

        setRuntimeValue(key, KEY, kept, campaignName);
    }
}

// Filter campaign targetEffects and write back only when something was removed.
function removeTargetEffectsIfChanged(campaignName, predicate) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const cleanedEffects = storedEffects.filter(predicate);
    if (cleanedEffects.length !== storedEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
    }
}

// Clean up Flesh to Stone recurring save tracking on rest
function cleanFleshToStoneTracking(characterName, campaignName) {
    const ftsAllKeys = getAllStoreKeys();
    for (const ftsKey of ftsAllKeys) {
        if (typeof ftsKey !== 'string') continue;
        const ftsValue = getRuntimeValue('campaign', ftsKey, campaignName);
        if (!ftsValue || !ftsKey.startsWith('_fleshToStone_')) continue;
        if (ftsValue.casterName !== characterName) continue;
        const ftsTargetName = ftsKey.replace('_fleshToStone_', '').replace(/_/g, ' ');
        const ftsConditions = getRuntimeValue(ftsTargetName, 'activeConditions', campaignName) || [];
        const ftsFiltered = ftsConditions.filter(c => String(c).toLowerCase() !== 'restrained');
        if (ftsFiltered.length !== ftsConditions.length) {
            setRuntimeValue(ftsTargetName, 'activeConditions', ftsFiltered, campaignName);
        }
        const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const ftsCleanedEffects = allTargetEffects.filter(te => !(te.target === ftsTargetName && te.effect === 'flesh_to_stone' && te.source === characterName));
        setRuntimeValue('campaign', 'targetEffects', ftsCleanedEffects, campaignName);
        setRuntimeValue('campaign', ftsKey, null, campaignName);
    }
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: characterName,
        abilityName: 'Flesh to Stone',
        description: 'Rest; Flesh to Stone ends.',
    }).catch((e) => { console.error("[clearAllExpirationEffects:log-error]", e); });
}

function cleanPrismaticSprayTarget(psTargetName, isIndigo, characterName, campaignName) {
    const psConditions = getRuntimeValue(psTargetName, 'activeConditions', campaignName) || [];
    const psFiltered = psConditions.filter(c => String(c).toLowerCase() !== (isIndigo ? 'restrained' : 'blinded'));
    if (psFiltered.length !== psConditions.length) {
        setRuntimeValue(psTargetName, 'activeConditions', psFiltered, campaignName);
    }
    const psTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const psEffectKey = isIndigo ? 'prismatic_spray_indigo' : 'prismatic_spray_violet';
    const psCleanedEffects = psTargetEffects.filter(te => !(te.target === psTargetName && te.effect === psEffectKey && te.source === characterName));
    setRuntimeValue('campaign', 'targetEffects', psCleanedEffects, campaignName);
}

// Clean up Prismatic Spray recurring save tracking on rest.
function cleanPrismaticSprayTracking(characterName, campaignName) {
    const psAllKeys = getAllStoreKeys();
    for (const psKey of psAllKeys) {
        if (typeof psKey !== 'string') continue;
        const psValue = getRuntimeValue('campaign', psKey, campaignName);
        if (!psValue) continue;
        const isIndigo = psKey.startsWith('_prismaticSprayIndigo_');
        const isViolet = psKey.startsWith('_prismaticSprayViolet_');
        if (!isIndigo && !isViolet) continue;
        if (psValue.casterName !== characterName) continue;
        const psTargetName = psKey.replace(/^_prismaticSpray(?:Indigo|Violet)_/, '').replace(/_/g, ' ');
        if (isIndigo) {
            cleanPrismaticSprayTarget(psTargetName, true, characterName, campaignName);
        }
        if (isViolet) {
            cleanPrismaticSprayTarget(psTargetName, false, characterName, campaignName);
        }
        setRuntimeValue('campaign', psKey, null, campaignName);
    }
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: characterName,
        abilityName: 'Prismatic Spray',
        description: 'Rest; Prismatic Spray Indigo/Violet effects end.',
    }).catch((e) => { console.error("[clearAllExpirationEffects:log-error]", e); });
}

// Remove object transforms on short/long rest or initiative roll
function revertObjectTransforms(characterName, campaignName) {
    const csForExpire = getCombatSummary(campaignName);
    if (!csForExpire?.creatures) return;

    const objectCreatures = csForExpire.creatures.filter(c => c.polymorphObject && c.polymorphSource === characterName);
    if (objectCreatures.length > 0) {
        for (const creature of objectCreatures) {
            const original = creature.polymorphOriginal || {};
            if (original.maxHp !== undefined) creature.maxHp = original.maxHp;
            if (original.ac !== undefined) creature.ac = original.ac;
            if (original.speed !== undefined) creature.speed = original.speed;
            delete creature.polymorphObject;
            delete creature.objectType;
            const activeConditions = getRuntimeValue(creature.name, 'activeConditions') || [];
            const filteredConds = activeConditions.filter(c => String(c).toLowerCase() !== 'incapacitated');
            if (filteredConds.length !== activeConditions.length) {
                setRuntimeValue(creature.name, 'activeConditions', filteredConds, campaignName);
            }
        }
        storage.set('combatSummary', csForExpire, campaignName);
        setCombatSummaryCache(csForExpire, campaignName);
    }
    // Clear object_transform targetEffects for this caster
    const allObjEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredObjEffects = allObjEffects.filter(te => !(te.effect === 'object_transform' && te.source === characterName));
    if (filteredObjEffects.length !== allObjEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filteredObjEffects, campaignName);
    }
}

/**
 * Clear all expiration effects for a creature (called on rest / initiative roll).
 */
export function clearAllExpirationEffects(characterName, campaignName) {
    if (!characterName || !campaignName) return;

    clearSelfBuffs(characterName, campaignName);

    const charLower = characterName.toLowerCase();

    clearMyOutgoingExpirations(characterName, campaignName);
    clearIncomingExpirations(charLower, campaignName);

    // Force cover badge refresh on all clients
    const refreshCount = getRuntimeValue('campaign', 'coverRefresh') || 0;
    setRuntimeValue('campaign', 'coverRefresh', refreshCount + 1, campaignName);

    cleanFleshToStoneTracking(characterName, campaignName);
    cleanPrismaticSprayTracking(characterName, campaignName);

    // Clean up Otto's Irresistible Dance spell badges on rest / initiative roll.
    // Conditions (Charmed, Speed 0) are already removed by the expiration scan above.
    removeTargetEffectsIfChanged(campaignName, te =>
        !(te.effect === 'ottos_irresistible_dance' && (te.source === characterName || te.target === characterName))
    );

    // Clean up Sanctuary on any creature on short/long rest or initiative roll
    removeTargetEffectsIfChanged(campaignName, te => te.effect !== 'sanctuary');

    // Remove spell-summoned creatures on short/long rest or initiative roll
    removeSummonedCreatures(characterName, campaignName);

    revertObjectTransforms(characterName, campaignName);
}
