import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../automation/index.js';
import { usesSpellSlot } from '../features/spellUtils.js';

let soulstitchResolve = null;

const ENCHANTMENT_SCHOOL = 'enchantment';
const ILLUSION_SCHOOL = 'illusion';

function isEnchantmentOrIllusion(spell) {
    const school = (spell.school || '').toLowerCase();
    return school === ENCHANTMENT_SCHOOL || school === ILLUSION_SCHOOL;
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
    const reactions = playerStats.automation?.reactions;
    if (reactions == null) {
        console.error('[postCastRiderService] Missing array:', reactions);
        throw new Error('Expected array, got ' + reactions);
    }
    return reactions.filter(r => r.type === 'spell_thief');
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

export async function triggerSoulstitchSpells(spell, metaCtx, playerStats, campaignName, mapName) {
    if (getSoulstitchFeatures(playerStats).length === 0) {
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
            // CLA-321: the modal applies the selection (single writer); cancel resolves [] (decline).
            const selectedNames = await confirmationPromise;
            return Array.isArray(selectedNames) ? selectedNames : [];
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

export function getEmpoweredEvocationIntModifier(playerStats) {
    const intAbility = playerStats.abilities.find(a => a.name === 'Intelligence');
    return intAbility?.bonus || 0;
}

export async function triggerSpellThief(_spell, _metaCtx, _playerStats, _campaignName, _mapName) {
    // CLA-325: self-misfire removed. Spell Thief reacts to ANOTHER creature's spell
    // cast targeting the thief, but this auto-trigger runs inside the CASTER's own
    // cast-execution context — firing here made the thief save against their own
    // spell save DC and steal/blocked their own spells. The feature is driven by the
    // manual Reactions row, which gates against the enemy-cast lastAttack stamp
    // (see spellThiefHandler.js).
    return null;
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
            school: spell.school,
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
