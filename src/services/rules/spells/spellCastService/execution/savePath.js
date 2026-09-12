import { rollExpression, rollExpressionMaximized } from '../../../../dice/diceRoller.js';
import { triggerSoulstitchSpells } from '../../postCastRiderService.js';
import { rangeToFeet } from '../../../combat/rangeValidation.js';
import { getCombatContext } from '../../../combat/damageUtils.js';
import { computeEmpoweredEvocation } from './damageCalculation.js';

async function handleSavePath(opts) {
    const { fullSpell, metaCtx, playerStats, campaignName, mapName } = opts;

    // CLA-321: chooser applies the stamp before resolution; the selection list flags this
    // cast so single-target save consumers consume (clear) the stamp at cast resolution.
    let soulstitchSelection = [];
    try {
        const soulstitchResult = await triggerSoulstitchSpells(fullSpell, metaCtx, playerStats, campaignName, mapName);
        if (Array.isArray(soulstitchResult)) {
            soulstitchSelection = soulstitchResult;
        }
    } catch (e) {
        console.error('[spellCast] Soulstitch Spells trigger failed:', e);
    }

    // AoE spells without dedicated automation: show modal for creature selection
    const aoe = fullSpell.area_of_effect;
    const aoeShape = aoe?.shape || aoe?.type;
    const isAreaShape = aoeShape ? ['emanation','cone','line','sphere','cube','cylinder','square','circle','wall','cage','floor','area'].includes(String(aoeShape).toLowerCase()) : false;

    if (isAreaShape) {
        return await handleAoE({ ...opts, aoeShape });
    }

    return await handleSingleTargetSave({ ...opts, soulstitchSelection });
}

// Resolve the active spell overlay when the attacker is currently overlay-targeted.
async function resolveActiveOverlay(attackerTargetName, campaignName) {
    if (!attackerTargetName?.startsWith('overlay-')) return null;
    const overlayId = attackerTargetName.slice('overlay-'.length);
    try {
        const response = await fetch(`/api/campaigns/${campaignName}/spell-overlays`);
        const overlays = await response.json();
        return overlays.find(o => o.id === overlayId) || null;
    } catch (error) {
        console.error('[spellCast] Error fetching overlay:', error);
        return null;
    }
}

// Slot-level damage expression with fallback to the highest level at or below the
// slot, then to the first defined level.
function resolveAoeDamageExpression(damageAtSlotLevel, slotLevel) {
    const damageExpression = damageAtSlotLevel[slotLevel];
    if (damageExpression) return damageExpression;
    if (Object.keys(damageAtSlotLevel).length > 0) {
        const levels = Object.keys(damageAtSlotLevel).map(Number).sort((a, b) => a - b);
        const highestBelow = levels.filter(l => l <= slotLevel).pop();
        if (highestBelow) {
            return damageAtSlotLevel[highestBelow];
        }
    }
    const firstKey = Object.keys(damageAtSlotLevel)[0];
    return damageAtSlotLevel[firstKey];
}

// CLA-279: Radiant Soul (Celestial Patron) — one target of the spell's damage roll gains CHA mod.
// Gate checked here at cast resolution; the SaveAttackAoeModal stamps the first selected eligible
// target via pendingRadiantSoulTarget and consumes the once-per-turn flag at damage application.
function resolveRadiantSoulChaMod(playerStats, effectiveDamageType, getRuntimeValue, campaignName) {
    const radiantSoulPassive = playerStats.automation?.passives?.find(p => p.type === 'radiant_soul');
    const radiantSoulTypes = (radiantSoulPassive?.damageTypes || []).map(dt => String(dt).toLowerCase());
    const radiantSoulFlagKey = `_radiantSoul_${playerStats.name.replace(/\s+/g, '_')}_oncePerTurn`;
    if (radiantSoulPassive?.hasAutomation
        && radiantSoulTypes.includes(String(effectiveDamageType || '').toLowerCase())
        && !getRuntimeValue(playerStats.name, radiantSoulFlagKey, campaignName)) {
        return Math.max(0, playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0);
    }
    return 0;
}

function resolveAoeSaveType(fullSpell, spell, fallback) {
    return fullSpell.dc?.dc_type || spell.dc.dc_type || fallback;
}

function normalizeDcSuccess(fullSpell, spell) {
    const success = fullSpell.dc?.dc_success ?? spell.dc.dc_success;
    return success === 0 ? 'none' : (success === 0.5 ? 'half' : success);
}

function buildConditionOnlyAoePopup({ fullSpell, spell, metaCtx, playerStats, campaignName, aoeShape, rangeFeet,
    spellSaveDc, innateSorceryActive, automationEffects, activeOverlay, hasInvisible }) {
    const conditionNames = automationEffects.fail.map(e => e.condition || e.type).filter(Boolean);
    const includeCaster = fullSpell.name && fullSpell.name.toLowerCase() === 'grease';
    return {
        automationPopup: {
            type: 'modal',
            modalName: 'aoeCondition',
            payload: {
                action: { name: fullSpell.name, automation: fullSpell.automation },
                playerStats,
                campaignName,
                shape: aoeShape,
                range: rangeFeet,
                saveType: resolveAoeSaveType(fullSpell, spell, 'CON'),
                saveDc: spellSaveDc + (innateSorceryActive ? 1 : 0),
                effects: automationEffects.fail,
                conditionLabel: conditionNames.join(', '),
                activeOverlay,
                metamagicCareful: metaCtx?.metamagicCareful || false,
                metamagicHeighten: hasInvisible || metaCtx?.metamagicHeighten,
                includeCaster,
            },
        },
    };
}

function buildSaveAttackAoePopup({ fullSpell, spell, metaCtx, playerStats, campaignName, aoeShape, rangeFeet,
    payloadDamage, effectiveDamageType, radiantSoulChaMod, spellSaveDc, innateSorceryActive, activeOverlay,
    hasInvisible, overchannelActive, overchannelUseCount, slotLevel }) {
    return {
        automationPopup: {
            type: 'modal',
            modalName: 'saveAttackAoe',
            payload: {
                action: { name: fullSpell.name, automation: {}, spell: fullSpell },
                playerStats,
                campaignName,
                shape: aoeShape,
                range: rangeFeet,
                damage: payloadDamage,
                damageType: effectiveDamageType,
                radiantSoulChaMod,
                saveType: resolveAoeSaveType(fullSpell, spell, 'DEX'),
                saveDc: spellSaveDc + (innateSorceryActive ? 1 : 0),
                dcSuccess: normalizeDcSuccess(fullSpell, spell),
                activeOverlay,
                metamagicCareful: metaCtx?.metamagicCareful || false,
                metamagicHeighten: hasInvisible || metaCtx?.metamagicHeighten,
                overchannelActive: !!overchannelActive,
                overchannelUseCount: overchannelUseCount || 0,
                overchannelSpellLevel: slotLevel,
            },
        },
    };
}

// Mirror the single-target save formula builder: Empowered Evocation bonus + Overchannel maximize suffix
function resolveAoeDamageInfo(playerStats, fullSpell, spell, slotLevel, overchannelActive) {
    const damageAtSlotLevel = fullSpell.damage?.damage_at_slot_level || fullSpell.damage?.damage_at_character_level || spell.damage?.damage_at_slot_level || {};
    const damageExpression = resolveAoeDamageExpression(damageAtSlotLevel, slotLevel);
    const hasDamage = !!damageExpression && damageExpression !== '0' && damageExpression !== '';
    const { empEvocFormula } = computeEmpoweredEvocation(playerStats, fullSpell, damageExpression || null);
    const damageFormula = empEvocFormula || damageExpression || '0';
    const payloadDamage = overchannelActive ? `${damageFormula} [Overchannel Maximize]` : damageFormula;
    return { damageExpression, hasDamage, payloadDamage };
}

async function handleAoE({ spell, fullSpell, metaCtx, playerStats, campaignName, getRuntimeValue,
    innateSorceryActive, effectiveDamageType, spellSaveDc, aoeShape, hasInvisible,
    overchannelActive, overchannelUseCount }) {

    const cs = getCombatContext(campaignName);
    const attackerTargetName = cs ? cs.creatures?.find(c => c.name === playerStats.name)?.targetName : null;
    const activeOverlay = await resolveActiveOverlay(attackerTargetName, campaignName);

    const rangeFeet = rangeToFeet(fullSpell.range || spell.range);
    const slotLevel = metaCtx?.slotLevel || spell.level;
    const { hasDamage, payloadDamage } = resolveAoeDamageInfo(playerStats, fullSpell, spell, slotLevel, overchannelActive);

    const automationEffects = fullSpell.automation?.effects;
    const isConditionOnlyAoe = !hasDamage && automationEffects?.fail?.length > 0;

    const radiantSoulChaMod = hasDamage ? resolveRadiantSoulChaMod(playerStats, effectiveDamageType, getRuntimeValue, campaignName) : 0;

    if (isConditionOnlyAoe) {
        return buildConditionOnlyAoePopup({ fullSpell, spell, metaCtx, playerStats, campaignName, aoeShape, rangeFeet,
            spellSaveDc, innateSorceryActive, automationEffects, activeOverlay, hasInvisible });
    }

    return buildSaveAttackAoePopup({ fullSpell, spell, metaCtx, playerStats, campaignName, aoeShape, rangeFeet,
        payloadDamage, effectiveDamageType, radiantSoulChaMod, spellSaveDc, innateSorceryActive, activeOverlay,
        hasInvisible, overchannelActive, overchannelUseCount, slotLevel });
}

async function handleSingleTargetSave({ spell, fullSpell, metaCtx, playerStats, mapName,
    getTargetInfo, innateSorceryActive, effectiveDamageType, spellSaveDc,
    overchannelFormula, overchannelActive, overchannelUseCount, rollDamage, formula, hasInvisible,
    soulstitchSelection = [] }) {

    const target = await getTargetInfo();
    const context = {
        targetName: target?.name,
        attackerName: playerStats.name,
        soulstitchCast: soulstitchSelection.length > 0,
        ...metaCtx,
        damageType: effectiveDamageType,
        saveDc: spellSaveDc + (innateSorceryActive ? 1 : 0),
        saveType: fullSpell.dc?.dc_type || spell.dc.dc_type,
        dcSuccess: fullSpell.dc?.dc_success ?? spell.dc.dc_success,
        metamagicHeighten: hasInvisible || metaCtx?.metamagicHeighten,
        isCantrip: spell.baseLevel === 0 || spell.level === 0,
        overchannelActive,
        overchannelUseCount,
        overchannelSpellLevel: metaCtx?.slotLevel || spell.level,
        playerStats,
    };
    if (spell.status_effects && spell.status_effects.length > 0) {
        context.statusEffects = spell.status_effects;
    }
    // CLA-377: Vicious Mockery disadvantage must be gated on the RESOLVED save outcome.
    // Stamp the cast in context; the save consumer (handleNpcSaveDamage / save-result
    // event handler) triggers the effect on a failed save only, mirroring the
    // statusEffects-on-fail pattern.
    if (spell.name && spell.name.toLowerCase() === 'vicious mockery') {
        context.viciousMockerySpell = spell;
        context.viciousMockeryMapName = mapName;
    }

    let overchannelResult;
    const damageFormula = overchannelFormula || formula;
    if (overchannelActive) {
        overchannelResult = rollExpressionMaximized(damageFormula);
    } else {
        overchannelResult = rollExpression(damageFormula);
    }
    if (overchannelResult) {
        rollDamage(spell.name, overchannelFormula || formula, overchannelResult.total, overchannelResult.rolls, overchannelResult.modifier, context);
    }
}

export { handleSavePath };
