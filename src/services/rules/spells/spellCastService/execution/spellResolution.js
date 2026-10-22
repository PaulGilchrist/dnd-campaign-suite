import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { isInnateSorceryActive, getActiveBuffs } from '../../../../combat/buffs/buffService.js';
import { getSilenceSource, isCreatureInSilenceZone } from '../../../features/silenceService.js';
import { getPsychicSpellsConfig } from '../../../../automation/handlers/class-warlock/psychicSpellsHandler.js';
import { endFriendsOnHostileAction } from '../../../features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';
import { resolveSpellDamageWithTypes } from '../../../core/spellDamageUtils.js';
import { normalizeCastingTime } from '../../../../shared/castingTimeUtils.js';

// Buff block: a blocksSpellcasting buff denies the cast (logs and short-circuits).
// NOTE: the live cast seam applies its blocksSpellcasting + CLA-404 Beast Spells
// bypass in execution/blockChecks.js checkBlockedBySpellcastingBuff (the only
// wired path); this mirror stays byte-shape for CLA-391 refusals.
//
// DEAD-MODULE MARKER (fix#74 precedent, #1501 census re-verified 2026-10-22):
// resolveSpellResolution + logGenericSpellCast below have ZERO production
// importers (grep 'resolveSpellResolution|logGenericSpellCast' src excl tests
// -> local twin in execution/index.js:258). The module itself is LOAD-live only
// via blockChecks.js:28 dynamic import of the getActiveBuffs re-export — it
// never executes the level/damage lanes below. Deletion is PENDING OWNER
// DECISION #1460; these lanes are maintained as canonical-semantics guard-bits
// so a future rewiring resurrects LIVE-consistent behavior, never the retired
// divergent falsy defaults (#1501).
function checkBlockedByBuff(spell, playerStats, campaignName) {
    const buffs = getActiveBuffs(playerStats.name, campaignName);
    const blockingBuff = buffs.find(b => b.blocksSpellcasting);
    if (!blockingBuff) return false;
    const blockName = blockingBuff.name || 'Shape-Shift';
    const refusalType = String(blockingBuff.effect || blockName).toLowerCase().replace(/\s+/g, '_') + '_refused';
    addEntry(campaignName, {
        type: 'automation',
        automationType: refusalType,
        creatureName: playerStats.name,
        characterName: playerStats.name,
        name: blockName,
        description: `${spell.name} blocked — ${playerStats.name} cannot cast spells while under ${blockName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellResolution:blocked-by-buff-log-error]", e); });
    return true;
}

// Magical ambush + invisibility setup.
function resolveAmbushFlags(playerStats, campaignName) {
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] magicalAmbush check: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for magical ambush check');
    }
    const magicalAmbush = passives.some(p => p.type === 'passive_rule' && p.effect === 'magical_ambush');
    // SP-002 twin: missing/null caster activeConditions is an empty condition list, not an abort.
    const casterConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) ?? [];
    if (!Array.isArray(casterConditions)) {
        console.error('[spellCast] casterConditions: activeConditions is not an array');
        throw new Error('activeConditions must be an array for caster');
    }
    const hasInvisible = magicalAmbush && casterConditions.some(c => String(c).toLowerCase() === 'invisible');
    return { magicalAmbush, casterConditions, hasInvisible };
}

// Silence — block Verbal components if caster is in a silence zone.
function checkSilenceBlocked(spell, playerStats, campaignName) {
    if (!(spell.components && spell.components.includes('V'))) return false;
    const silenceCaster = getSilenceSource(playerStats.name, campaignName);
    if (!(silenceCaster && isCreatureInSilenceZone(playerStats.name, silenceCaster, campaignName))) return false;
    addEntry(campaignName, {
        type: 'automation',
        creatureName: playerStats.name,
        name: 'Silence',
        description: `${spell.name} blocked — ${playerStats.name} is inside ${silenceCaster}'s Silence zone; Verbal components are impossible there.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellResolution:silence-log-error]", e); });
    return true;
}

// Psychic Spells — remove Verbal/Somatic components for Enchantment/Illusion Warlock spells
function applyPsychicComponents(spell, psychicSpellsConfig) {
    if (!(psychicSpellsConfig && spell.components)) return;
    const spellSchool = (spell.school || '').toLowerCase();
    const reducedSchools = (psychicSpellsConfig.spellSchools || []).map(s => s.toLowerCase());
    if (reducedSchools.includes(spellSchool)) {
        const reducedComponents = (psychicSpellsConfig.componentReduction || []).map(c => c.toUpperCase());
        spell.components = spell.components.filter(c => !reducedComponents.includes(c.toUpperCase()));
    }
}

function resolveEffectiveDamageType(result, spell) {
    const damageType = result.damageInfo?.primaryType || spell.damage?.damage_type || '';
    result.damageType = damageType;
    result.effectiveDamageType = damageType;
    if (result.psychicSpellsConfig && spell.damage && damageType) {
        result.effectiveDamageType = result.psychicSpellsConfig.damageType || 'Psychic';
    }
}

function resolveSaveDc(result, playerStats) {
    if (playerStats.spellAbilities?.saveDc == null) {
        if (playerStats.proficiency == null) {
            console.error('[spellCast] executeSpellCast: playerStats.proficiency is missing')
            throw new Error('playerStats.proficiency is required for spell save DC calculation')
        }
        result.spellSaveDc = 8 + playerStats.proficiency;
    } else {
        result.spellSaveDc = playerStats.spellAbilities.saveDc;
    }
}

function resolveCastingMod(result, cantripAbility, playerStats) {
    if (result.cantripSpellAbility && playerStats.abilities) {
        result.spellCastingMod = cantripAbility ? cantripAbility.bonus : 0;
    } else if (playerStats.spellAbilities) {
        result.spellCastingMod = playerStats.spellAbilities.modifier || 0;
    }
}

// #1501: ONE canonical level resolver for both legs — the retired pair of
// independent falsy defaults (`spell.level || 1` here vs `spell.level || 0`
// in logGenericSpellCast below) let the same undefined-level spell resolve
// damage as a 1st-level slot while logging as a level-0 cantrip.
// Damage-tier semantics mirror the fix#121 damageLevel idiom at live
// execution/index.js:59 resolveCastDamage BYTE-FOR-BYTE: cantrips
// (spell.level === 0 — a rules-defined value, disk Fire Bolt 5e spells.json
// damage.damage_at_character_level {1:'1d10',5:'2d10',11:'3d10',17:'4d10'};
// 2024 stores the same ladder under damage_at_slot_level keyed from '0')
// scale at CASTER level; leveled spells take the slot level with the
// minimum-1st-slot fallback (|| 1) for undefined level.
// Log/table-key display mirrors the live log lane execution/index.js:272
// (`spell.level || 0`): RAW cantrips are level 0, so 0 and undefined both
// record as 0 in the cast log. Per-consumed-key canonical, single source.
function resolveCantripLevel(spell, playerStats) {
    const damageLevel = spell.level === 0 ? (playerStats.level || 1) : (spell.level || 1);
    const displayLevel = spell.level || 0;
    return { damageLevel, displayLevel };
}

// Damage type + to-hit/DC/modifier resolution onto the result object.
function resolveSpellStats(result, spell, playerStats) {
    const { damageLevel, displayLevel } = resolveCantripLevel(spell, playerStats);
    result.spellLevel = displayLevel;
    result.damageInfo = resolveSpellDamageWithTypes(spell, damageLevel);
    result.formula = result.damageInfo?.formula || null;
    resolveEffectiveDamageType(result, spell);

    result.cantripSpellAbility = spell.spellCastingAbility || playerStats.spellAbilities?.spellCastingAbility;
    result.spellToHit = playerStats.spellAbilities?.toHit || 0;

    resolveSaveDc(result, playerStats);

    const cantripAbility = result.cantripSpellAbility && playerStats.abilities
        ? playerStats.abilities.find(a => a.name === result.cantripSpellAbility)
        : null;
    if (cantripAbility) {
        result.spellToHit = cantripAbility.bonus + playerStats.proficiency;
        result.spellSaveDc = 8 + cantripAbility.bonus + playerStats.proficiency;
    }

    resolveCastingMod(result, cantripAbility, playerStats);
}

function resolveSpellResolution(spell, metaCtx, playerStats, campaignName, getTargetInfo) {
    const result = {
        globeTargetName: null,
        magicalAmbush: false,
        casterConditions: [],
        hasInvisible: false,
        psychicSpellsConfig: null,
        spellLevel: 0, // display default; always overwritten by resolveSpellStats (:139/:217)
        innateSorceryActive: false,
        damageInfo: null,
        formula: null,
        damageType: '',
        effectiveDamageType: '',
        cantripSpellAbility: null,
        spellToHit: 0,
        spellSaveDc: 0,
        spellCastingMod: 0,
        fullSpell: spell,
        needsLookup: false,
    };

    if (checkBlockedByBuff(spell, playerStats, campaignName)) {
        return { blockedByBuffs: true };
    }

    result.globeTargetName = getTargetInfo ? (async () => {
        const target = await getTargetInfo();
        return target?.name || null;
    })() : null;

    Object.assign(result, resolveAmbushFlags(playerStats, campaignName));

    if (checkSilenceBlocked(spell, playerStats, campaignName)) {
        return { blockedBySilence: true };
    }

    result.psychicSpellsConfig = getPsychicSpellsConfig(playerStats);
    applyPsychicComponents(spell, result.psychicSpellsConfig);

    // End Friends/Invisibility on spell cast
    if (spell.name && spell.name.toLowerCase() !== 'friends') {
        endFriendsOnHostileAction(playerStats.name, campaignName);
    }
    endInvisibilityOnHostileAction(playerStats.name, campaignName);

    if (normalizeCastingTime(spell.casting_time) === '1 action') {
        getRuntimeValue('__placeholder__', '__placeholder__'); // side-effect only: tracked via setRuntimeValue called in executeSpellCast
    }

    // Full spell data lookup
    result.needsLookup = !spell.area_of_effect || (spell.automation?.type && !spell.automation?.effects);
    if (result.needsLookup) {
        // This will be handled async in executeSpellCast
        result.fullSpell = spell;
    }

    result.innateSorceryActive = isInnateSorceryActive(playerStats.name, campaignName);
    resolveSpellStats(result, spell, playerStats);

    return result;
}

function logGenericSpellCast({ spell, playerStats, campaignName, getTargetInfo, fullSpell, damageType, formula, spellSaveDc }) {
    if (spell.name !== 'Hex') {
        return (async () => {
            const resolvedTarget = await getTargetInfo();
            const resolvedTargetName = resolvedTarget?.name || null;
            const spellDescription = fullSpell.description ? fullSpell.description.join(' ') : '';
            addEntry(campaignName, {
                type: 'spell',
                characterName: playerStats.name,
                targetName: resolvedTargetName,
                spellName: spell.name,
                // #1501: display level via the ONE canonical resolver —
                // cantrip/undefined record 0, matching live index.js:272.
                spellLevel: resolveCantripLevel(spell, playerStats).displayLevel,
                castingTime: spell.casting_time,
                damageType: damageType || null,
                damageFormula: formula || null,
                saveDC: spell.dc ? spellSaveDc : null,
                concentration: !!spell.concentration,
                description: spellDescription || null,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[spellResolution:log-error]", e); });
        })();
    }
    return Promise.resolve();
}

export { resolveSpellResolution, logGenericSpellCast, getActiveBuffs, isInnateSorceryActive };
