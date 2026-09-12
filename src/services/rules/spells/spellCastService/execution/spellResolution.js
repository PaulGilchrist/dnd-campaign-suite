import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { isInnateSorceryActive, getActiveBuffs } from '../../../../combat/buffs/buffService.js';
import { getSilenceSource, isCreatureInSilenceZone } from '../../../features/silenceService.js';
import { getPsychicSpellsConfig } from '../../../../automation/handlers/class-warlock/psychicSpellsHandler.js';
import { endFriendsOnHostileAction } from '../../../features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';
import { resolveSpellDamageWithTypes } from '../../../core/spellDamageUtils.js';

// Buff block: a blocksSpellcasting buff denies the cast (logs and short-circuits).
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
    const casterConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName);
    if (casterConditions == null || !Array.isArray(casterConditions)) {
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

// Damage type + to-hit/DC/modifier resolution onto the result object.
function resolveSpellStats(result, spell, playerStats) {
    result.spellLevel = spell.level || 1;
    result.damageInfo = resolveSpellDamageWithTypes(spell, result.spellLevel);
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
        spellLevel: 1,
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

    if (spell.casting_time === '1 action') {
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
                spellLevel: spell.level || 0,
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
