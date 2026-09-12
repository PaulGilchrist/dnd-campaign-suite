import { computeRangeEffect, computeEffectiveSpellRange, getDistanceFeet, rangeToFeet } from '../../../combat/rangeValidation.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../postCastRiderService.js';
import { setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';

function computeRange(spell, metaCtx, attackerPos, targetPos, featEffects) {
    if (!attackerPos || !targetPos) return {};

    let effectiveRange = computeEffectiveSpellRange(spell.range, metaCtx);
    if (effectiveRange != null) {
        const cantripRangeBonus = (featEffects?.cantripRangeBonus) || 0;
        if (cantripRangeBonus > 0 && spell.level === 0) {
            const baseRange = rangeToFeet(spell.range);
            if (baseRange != null && baseRange >= 10) {
                effectiveRange += cantripRangeBonus;
            }
        }
        const spellRangeBonus = (featEffects?.spellRangeBonus) || 0;
        if (spellRangeBonus > 0 && spell.attack_type && !spell.dc) {
            const baseRange = rangeToFeet(spell.range);
            if (baseRange != null && baseRange >= 10) {
                effectiveRange += spellRangeBonus;
            }
        }
        const distanceFt = getDistanceFeet(attackerPos, targetPos);
        const rangeResult = computeRangeEffect(effectiveRange, distanceFt, featEffects ?? {});
        if (rangeResult.mode === 'miss') {
            return { isAutoMiss: true, rangeReason: rangeResult.reason };
        }
    }
    return {};
}

function computeEmpoweredEvocation(playerStats, spell, formula) {
    const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(playerStats).length > 0;
    const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(playerStats) : 0;
    const spellSchool = (spell.school || '').toLowerCase();
    const isEvocation = spellSchool === 'evocation';
    const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && spell.damage && empEvocIntMod > 0;

    let empEvocFormula = formula || null;
    if (shouldApplyEmpoweredEvoc && formula) {
        empEvocFormula = `${formula} + ${empEvocIntMod} [Empowered Evocation]`;
    }

    return { empEvocFormula, empEvocIntMod };
}

function blessedStrikesApplies(potentFeature, chosen) {
    if (potentFeature.options.length > 1 && !chosen) return false; // multi-option feature with no choice yet — skip
    if (chosen && chosen.toLowerCase().includes('spellcasting')) return true;
    return potentFeature.options.length === 1;
}

function computeBlessedStrikes(spell, empEvocFormula, playerStats, campaignName, getRuntimeValue) {
    const isCantrip = spell.baseLevel === 0 || spell.level === 0;
    if (!isCantrip || !spell.damage || !playerStats.automation?.actions) {
        return empEvocFormula;
    }

    const potentFeature = playerStats.automation.actions.find(
        a => a.type === 'damage_bonus' && !a.upgrades && a.options?.some(o => o.toLowerCase().includes('spellcasting'))
    );
    if (!potentFeature) return empEvocFormula;

    const optKey = `_${(potentFeature.name || 'PotentSpellcasting').replace(/\s+/g, '_')}_option`;
    const chosen = getRuntimeValue(playerStats.name, optKey, campaignName);
    if (!blessedStrikesApplies(potentFeature, chosen)) return empEvocFormula;

    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    const wisMod = Math.max(0, wis?.bonus || 0);
    if (wisMod > 0) {
        return `${empEvocFormula} + ${wisMod} [Blessed Strikes]`;
    }
    return empEvocFormula;
}

function computeRadiantSoul(spell, playerStats, campaignName, getRuntimeValue, empEvocFormula) {
    let finalFormula = empEvocFormula;
    const radiantSoulPassive = playerStats.automation?.passives?.find(p => p.type === 'radiant_soul');
    const spellDamageType = (spell.damage?.damage_type || '').toLowerCase();
    const damageTypes = (radiantSoulPassive?.damageTypes || []).map(dt => dt.toLowerCase());
    const oncePerTurnKey = `_radiantSoul_${playerStats.name.replace(/\s+/g, '_')}_oncePerTurn`;
    const radiantSoulOnceUsed = getRuntimeValue(playerStats.name, oncePerTurnKey, campaignName);
    if (radiantSoulPassive && radiantSoulPassive.hasAutomation && !radiantSoulOnceUsed && damageTypes.includes(spellDamageType)) {
        const charismaAbility = playerStats.abilities?.find(a => a.name === 'Charisma');
        const chaMod = Math.max(0, charismaAbility?.bonus || 0);
        if (chaMod > 0) {
            finalFormula = `${empEvocFormula} + ${chaMod} [Radiant Soul]`;
        }
    }
    return finalFormula;
}

function computeOverchannel(spell, metaCtx, playerStats, campaignName, getRuntimeValue, empEvocFormula, baseFormula) {
    let overchannelFormula = baseFormula;
    let overchannelActive = false;
    let overchannelUseCount = 0;

    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] overchannelPassives: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for overchannel check');
    }
    const overchannelPassives = passives.filter(p => p.type === 'overchannel');

    if (overchannelPassives.length > 0) {
        const spellLevel = metaCtx?.slotLevel || spell.level;
        const hasDamage = !!spell.damage;
        const isSlotLevelValid = spellLevel >= 1 && spellLevel <= 5;
        const usesKey = 'Overchannel_useCount';
        const currentUseCount = Number(getRuntimeValue(playerStats.name, usesKey) ?? 0);
        if (hasDamage && isSlotLevelValid && metaCtx?.overchannel) {
            overchannelActive = true;
            overchannelUseCount = currentUseCount + 1;
            const formulaForOverchannel = empEvocFormula || baseFormula;
            overchannelFormula = `${formulaForOverchannel} [Overchannel Maximize]`;
            setRuntimeValue(playerStats.name, usesKey, overchannelUseCount, campaignName);
        }
    }

    return { overchannelFormula, overchannelActive, overchannelUseCount };
}

export {
    computeRange,
    computeEmpoweredEvocation,
    computeBlessedStrikes,
    computeRadiantSoul,
    computeOverchannel,
};
