import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../automation/index.js';
import { isBlockedBySpellThief } from '../../automation/handlers/class-fighter-rogue/spellThiefHandler.js';
import { applySoulstitchSelection } from '../../automation/handlers/class-wizard/soulstitchSpellsHandler.js';

let soulstitchResolve = null;

const ENCHANTMENT_SCHOOL = 'enchantment';
const ILLUSION_SCHOOL = 'illusion';

function isEnchantmentOrIllusion(spell) {
    const school = (spell.school || '').toLowerCase();
    return school === ENCHANTMENT_SCHOOL || school === ILLUSION_SCHOOL;
}

function usesSpellSlot(spell, metaCtx) {
    return metaCtx?.slotLevel > 0 || spell.level > 0;
}

export function getPostCastRiderSaves(playerStats) {
    const rawPassives = playerStats.automation?.passives;
    if (rawPassives == null) {
        console.error('[postCastRiderService] Missing array:', rawPassives);
        throw new Error('Expected array, got ' + rawPassives);
    }
    const passives = rawPassives;
    return passives.filter(p => p.type === 'post_cast_rider' || (p.type === 'passive_rule' && p.riderSave));
}

export function getSpellThiefFeatures(playerStats) {
    const rawPassives = playerStats.automation?.passives;
    if (rawPassives == null) {
        console.error('[postCastRiderService] Missing array:', rawPassives);
        throw new Error('Expected array, got ' + rawPassives);
    }
    const passives = rawPassives;
    return passives.filter(p => p.type === 'spell_thief');
}

export function hasSpellThief(playerStats) {
    return getSpellThiefFeatures(playerStats).length > 0;
}

export function getMultiTargetSpreads(playerStats) {
    const rawPassives = playerStats.automation?.passives;
    if (rawPassives == null) {
        console.error('[postCastRiderService] Missing array:', rawPassives);
        throw new Error('Expected array, got ' + rawPassives);
    }
    const passives = rawPassives;
    return passives.filter(p => p.type === 'multi_target_spread');
}

export function getMultiTargetSpreadForSpell(playerStats, spellName) {
    const spreads = getMultiTargetSpreads(playerStats);
    for (const spread of spreads) {
        const rawFilter = spread.spellFilter;
        if (rawFilter == null) {
            console.error('[postCastRiderService] Missing array:', rawFilter);
            throw new Error('Expected array, got ' + rawFilter);
        }
        const filter = rawFilter;
        if (filter.includes(spellName)) {
            return spread;
        }
    }
    return null;
}

export function hasPostCastRiderSave(playerStats) {
    return getPostCastRiderSaves(playerStats).length > 0;
}

export async function triggerPostCastRiderSaves(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!isEnchantmentOrIllusion(spell)) {
        return null;
    }

    if (!usesSpellSlot(spell, metaCtx)) {
        return null;
    }

    const riderSaves = getPostCastRiderSaves(playerStats);
    if (riderSaves.length === 0) {
        return null;
    }

    const results = [];
    for (const rider of riderSaves) {
        const riderName = rider.riderSave ? rider.name : rider.name;
        const usesKey = `postCastRider_${riderName.replace(/\s+/g, '_')}`;
        const uses = getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 1;

        if (uses <= 0) {
            continue;
        }

        let riderConfig;
        if (rider.riderSave) {
            riderConfig = {
                saveType: rider.riderSave.type,
                saveDc: 'ability',
                saveAbility: 'CHA',
                condition: rider.riderSave.condition,
                duration: rider.riderSave.duration,
                range: rider.riderSave.range,
                recharge: rider.riderSave.recharge,
            };
        } else {
            riderConfig = {
                saveType: rider.saveType,
                saveDc: rider.saveDc,
                saveAbility: rider.saveAbility,
                condition: rider.condition,
                duration: rider.duration,
                range: rider.range,
                spellSchools: rider.spellSchools,
                recharge: rider.recharge,
            };
        }

        const action = {
            name: riderName,
            automation: {
                type: 'post_cast_rider',
                ...riderConfig,
            },
        };

        try {
            const result = await executeHandler(action, playerStats, campaignName, mapName);
            if (result) {
                results.push(result);
            }
        } catch (e) {
            console.error(`[postCastRider] Failed to execute rider save for ${riderName}:`, e);
            throw e;
        }
    }

    return results.length > 0 ? results : null;
}

const EVOCATION_SCHOOL = 'evocation';

export function getSoulstitchFeatures(playerStats) {
    const rawPassives = playerStats.automation?.passives;
    if (rawPassives == null) {
        console.error('[postCastRiderService] Missing array:', rawPassives);
        throw new Error('Expected array, got ' + rawPassives);
    }
    const passives = rawPassives;
    return passives.filter(p => p.type === 'soulstitch_spells');
}

export function hasSoulstitchSpells(playerStats) {
    return getSoulstitchFeatures(playerStats).length > 0;
}

export async function triggerSoulstitchSpells(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!hasSoulstitchSpells(playerStats)) {
        return null;
    }

    const school = (spell.school || '').toLowerCase();
    if (school !== EVOCATION_SCHOOL) {
        return null;
    }

    // Only applies to spells with saves
    if (!spell.dc) {
        return null;
    }

    const soulstitchFeatures = getSoulstitchFeatures(playerStats);
    if (soulstitchFeatures.length === 0) {
        return null;
    }

    const feature = soulstitchFeatures[0];
    const spellSlotLevel = metaCtx?.slotLevel || spell.level || 0;

    const action = {
        name: feature.name,
        automation: {
            type: 'soulstitch_spells',
            casting_time: 'passive',
        },
        spell,
        spellSlotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        if (result && result.type === 'modal') {
            const confirmationPromise = new Promise(resolve => {
                soulstitchResolve = resolve;
            });
            window.dispatchEvent(new CustomEvent('soulstitch-modal-show', { detail: result.payload }));
            const selectedNames = await confirmationPromise;
            await applySoulstitchSelection(action, playerStats, campaignName, selectedNames);
            return null;
        }
        if (result) {
            return result;
        }
    } catch (e) {
        console.error(`[soulstitch] Failed to execute ${feature.name}:`, e);
        throw e;
    }

    return null;
}

export function getEmpoweredEvocationFeatures(playerStats) {
    const rawPassives = playerStats.automation?.passives;
    if (rawPassives == null) {
        console.error('[postCastRiderService] Missing array:', rawPassives);
        throw new Error('Expected array, got ' + rawPassives);
    }
    const passives = rawPassives;
    return passives.filter(p => p.type === 'empowered_evocation');
}

export function hasEmpoweredEvocation(playerStats) {
    return getEmpoweredEvocationFeatures(playerStats).length > 0;
}

export function getEmpoweredEvocationIntModifier(playerStats) {
    const intAbility = playerStats.abilities.find(a => a.name === 'Intelligence');
    return intAbility?.bonus || 0;
}

export async function triggerSpellThief(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!usesSpellSlot(spell, metaCtx)) {
        return null;
    }

    if (isBlockedBySpellThief(playerStats.name, playerStats.name, spell.name, campaignName)) {
        return null;
    }

    const spellThiefFeatures = getSpellThiefFeatures(playerStats);
    if (spellThiefFeatures.length === 0) {
        return null;
    }

    const results = [];
    for (const thief of spellThiefFeatures) {
        const featureName = thief.name;
        const usesKey = featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey) ?? 0);

        if (currentUses <= 0) {
            continue;
        }

        const action = {
            name: featureName,
            automation: {
                type: 'spell_thief',
                saveType: thief.saveType || 'INT',
                saveDc: thief.saveDc || 'ability',
                saveAbility: thief.saveAbility || 'INT',
                trigger: thief.trigger || 'spell_cast',
                oncePerLongRest: !!thief.oncePerLongRest,
                casting_time: thief.casting_time || '1 reaction',
            },
            casterName: playerStats.name,
            spellName: spell.name,
        };

        try {
            const result = await executeHandler(action, playerStats, campaignName, mapName);
            if (result) {
                results.push(result);
            }
        } catch (e) {
            console.error(`[spellThief] Failed to execute Spell Thief for ${featureName}:`, e);
            throw e;
        }
    }

    return results.length > 0 ? results : null;
}

export function confirmSoulstitchSelection(selectedNames) {
    if (soulstitchResolve) {
        soulstitchResolve(selectedNames);
        soulstitchResolve = null;
    }
}

export function getBewitchingMagicFeatures(playerStats) {
    const rawPassives = playerStats.automation?.passives;
    if (rawPassives == null) {
        console.error('[postCastRiderService] Missing array:', rawPassives);
        throw new Error('Expected array, got ' + rawPassives);
    }
    const passives = rawPassives;
    return passives.filter(p => p.type === 'bewitching_magic');
}

export async function triggerBewitchingMagic(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!isEnchantmentOrIllusion(spell)) {
        return null;
    }

    if (!usesSpellSlot(spell, metaCtx)) {
        return null;
    }

    if (spell.casting_time !== '1 action') {
        return null;
    }

    const bewitchingFeatures = getBewitchingMagicFeatures(playerStats);
    if (bewitchingFeatures.length === 0) {
        return null;
    }

    const results = [];
    for (const feature of bewitchingFeatures) {
        const action = {
            name: feature.name,
            automation: {
                type: 'bewitching_magic',
                casting_time: 'passive',
            },
        };

        try {
            const result = await executeHandler(action, playerStats, campaignName, mapName);
            if (result) {
                results.push(result);
            }
        } catch (e) {
            console.error(`[bewitchingMagic] Failed to execute ${feature.name}:`, e);
            throw e;
        }
    }

    return results.length > 0 ? results : null;
}
