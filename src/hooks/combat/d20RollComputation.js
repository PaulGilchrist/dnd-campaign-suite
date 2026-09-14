import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasStarryDragonActive, starryDragonAppliesToRoll } from './starryDragon.js';

function computeStarryDragonFloor(characterName, campaignName, name, rollType) {
    if (rollType !== 'save' && rollType !== 'check' && rollType !== 'skill') return false;
    return hasStarryDragonActive(characterName, campaignName) && starryDragonAppliesToRoll(name, rollType);
}

// Cosmic Omen: apply global pending bonus to next d20 roll by anyone (not save rolls)
function applyCosmicOmen(rollType, campaignName) {
    if (rollType === 'save') return { bonus: 0, detail: null };
    const cosmicOmenPendingRaw = getRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus');
    if (!cosmicOmenPendingRaw) return { bonus: 0, detail: null };
    try {
        const pending = JSON.parse(cosmicOmenPendingRaw);
        if (pending && typeof pending.value === 'number' && pending.value > 0) {
            const isWeal = pending.type === 'Weal';
            const bonus = isWeal ? pending.value : -pending.value;
            setRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', null, campaignName, true);
            return { bonus, detail: `(${bonus} from ${pending.type})` };
        }
    } catch (_e) { /* ignore */ }
    return { bonus: 0, detail: null };
}

// Pending Skill Check Bonus (Ambush maneuver): apply stored bonus to check/skill/initiative rolls
function applyPendingSkillCheckBonus(rollType, characterName, campaignName) {
    if (!((rollType === 'check' || rollType === 'skill' || rollType === 'initiative') && characterName)) {
        return { bonus: 0, detail: null };
    }
    const pendingRaw = getRuntimeValue(characterName, 'pendingSkillCheckBonus');
    if (!(pendingRaw && typeof pendingRaw === 'number' && pendingRaw > 0)) {
        return { bonus: 0, detail: null };
    }
    setRuntimeValue(characterName, 'pendingSkillCheckBonus', null, campaignName, true);
    return { bonus: pendingRaw, detail: `(+${pendingRaw} [Pending Skill Check])` };
}

// STR-based d20 tests have disadvantage (MA-0102 generalization of the Ray
// of Enfeeblement hook): any te on the roller carrying the generic
// strCheckDisadvantage flag (ray_of_enfeeble_debuff, MA-0102
// weakening_breath) forces Disadvantage on STR ability/skill checks. Ray te
// already carries the flag, so ray behavior is byte-identical.
function hasStrTestDisadvantage(rollType, name, characterName) {
    if (rollType !== 'check' && rollType !== 'skill') return false;
    const abilityAbbr = (name || '').substring(0, 3).toUpperCase();
    if (abilityAbbr !== 'STR' && name !== 'Strength' && name !== 'Athletics') return false;
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    return allTargetEffects.some(te => te.target === characterName && te.strCheckDisadvantage);
}

// Roll-time subtract-die riders (generalized bane_penalty hook): Bane/Blade
// Ward -1d4 on attack rolls only; any te carrying a subtractDie (MA-0093
// giggling_magic_debuff 1d6) subtracts its die on attack rolls AND ability
// checks, per its authored clause, until its expiration clock drains it.
function computeSubtractDiePenalty(characterName, context, rollType) {
    let subtractDie = null;
    const empty = { banePenalty: 0, baneRoll: null, displayLabel: 'Bane', subtractPenalty: 0, subtractRoll: null, subtractLabel: null, subtractDie: null };
    const isAttack = rollType === 'attack';
    const isCheck = rollType === 'check' || rollType === 'skill';
    if (!isAttack && !isCheck) return empty;
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const attackerEffects = allTargetEffects.filter(te => te.target === characterName && (te.effect === 'bane_penalty' || te.subtractDie));
    const targetEffects = isAttack ? allTargetEffects.filter(te => te.target === context?.targetName && te.effect === 'bane_penalty' && te.source === context?.targetName) : [];
    let banePenalty = 0;
    let baneRoll = null;
    let displayLabel = 'Bane';
    let subtractPenalty = 0;
    let subtractRoll = null;
    let subtractLabel = null;
    for (const te of [...attackerEffects, ...targetEffects]) {
        if (te.effect === 'bane_penalty' && !isAttack) continue;
        const r = rollExpression(te.subtractDie || '1d4');
        if (!r) continue;
        if (te.effect === 'bane_penalty') {
            banePenalty -= r.total;
            baneRoll = r.total;
            displayLabel = te.displayLabel || 'Bane';
        } else {
            subtractPenalty -= r.total;
            subtractRoll = (subtractRoll || 0) + r.total;
            subtractLabel = te.displayLabel || 'Giggling Magic';
            subtractDie = te.subtractDie;
        }
    }
    return { banePenalty, baneRoll, displayLabel, subtractPenalty, subtractRoll, subtractLabel, subtractDie };
}

// Bless: add 1d4 to attack rolls for blessed attackers
function computeBlessAttackBonus(characterName, rollType) {
    if (rollType !== 'attack') return { bonus: 0, roll: null };
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const blessEffects = allTargetEffects.filter(te => te.target === characterName && te.effect === 'bless_bonus');
    if (blessEffects.length === 0) return { bonus: 0, roll: null };
    const r = rollExpression('1d4');
    if (!r) return { bonus: 0, roll: null };
    return { bonus: r.total, roll: r.total };
}

// Sundering Blow: add +5 to hit bonus for next attack against the target
function computeSunderingBlowBonus(context, rollType) {
    if (rollType !== 'attack' || !context?.targetName) return 0;
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    let bonus = 0;
    for (const te of allTargetEffects.filter(te => te.target === context.targetName)) {
        if (te.effect === 'next_attack_bonus') {
            bonus += parseInt(te.value, 10) || 5;
        }
    }
    return bonus;
}

// Lucky feat disadvantage/advantage on attack targets
function applyTargetLuckyFeat({ rollType, forcedMode, context, campaignName, r1, r2 }) {
    const unchanged = { forcedMode, effectiveD20Roll: null };
    if (rollType !== 'attack' || (forcedMode && forcedMode !== 'normal')) return unchanged;
    const targetNameForLucky = context?.targetName;
    if (!targetNameForLucky) return unchanged;
    const targetLuckyDis = getRuntimeValue(targetNameForLucky, 'luckyDisadvantageActive', campaignName);
    if (targetLuckyDis) {
        context.forcedMode = 'disadvantage';
        setRuntimeValue(targetNameForLucky, 'luckyDisadvantageActive', null, campaignName);
        return { forcedMode: 'disadvantage', effectiveD20Roll: Math.min(r1, r2) };
    }
    const targetLuckyAdv = getRuntimeValue(targetNameForLucky, 'luckyAdvantageActive', campaignName);
    if (targetLuckyAdv) {
        context.forcedMode = 'advantage';
        setRuntimeValue(targetNameForLucky, 'luckyAdvantageActive', null, campaignName);
        return { forcedMode: 'advantage', effectiveD20Roll: Math.max(r1, r2) };
    }
    return unchanged;
}

function buildBonusDetailParts({ bonus, sacredWeaponBonus, sunderingBlowBonus, cosmicOmenAppliedBonus, cosmicOmenDetail, pendingSkillCheckAppliedBonus, pendingSkillCheckDetail, baneAttackPenalty, baneDisplayLabel, subtractDiePenalty, subtractDieDisplayLabel, blessAttackBonus }) {
    const parts = [];
    if (sacredWeaponBonus > 0) {
        const baseBonus = bonus - sacredWeaponBonus;
        if (baseBonus !== 0) {
            parts.push((baseBonus > 0 ? '+' : '') + baseBonus + ' to hit');
        }
        parts.push('+' + sacredWeaponBonus + ' Sacred Weapon');
    } else if (bonus > 0) {
        parts.push('+' + bonus + ' to hit');
    }
    if (sunderingBlowBonus > 0) parts.push('+' + sunderingBlowBonus + ' [Sundering Blow]');
    if (cosmicOmenAppliedBonus !== 0 && cosmicOmenDetail) parts.push(cosmicOmenDetail);
    if (pendingSkillCheckAppliedBonus > 0 && pendingSkillCheckDetail) parts.push(pendingSkillCheckDetail);
    if (baneAttackPenalty < 0) parts.push(`${baneAttackPenalty} [${baneDisplayLabel}]`);
    if (subtractDiePenalty < 0) parts.push(`${subtractDiePenalty} [${subtractDieDisplayLabel}]`);
    if (blessAttackBonus > 0) parts.push('+' + blessAttackBonus + ' [Bless]');
    return parts;
}

// Resilient Sphere — block all attacks when attacker or target is enclosed
function resolveResilientSphereAutoMiss(context, campaignName, isResilientSphereActive) {
    if (context?.isAutoMiss === true) return true;
    if (!context?.targetName || !context?.attackerName) return false;
    const rsAttackerSphere = isResilientSphereActive(context.attackerName, campaignName);
    const rsTargetSphere = isResilientSphereActive(context.targetName, campaignName);
    if (!rsAttackerSphere && !rsTargetSphere) return false;
    if (!context.notice) {
        context.notice = 'Attack blocked by Resilient Sphere — nothing can pass through the barrier.';
    }
    return true;
}

function applyD20Floor(r1, context, starryDragonFloor) {
    return ((context?.d20Floor10 || starryDragonFloor) && r1 <= 9) ? 10 : r1;
}

// Advantage/disadvantage resolution → target Lucky overrides → Halfling Lucky
// auto-reroll, in the exact original order so the reroll value is never clobbered.
function resolveAttackRoll({ rollType, forcedMode, context, campaignName, r1, r2, effectiveD20 }) {
    let effectiveD20Roll;
    let luckyRerolled = false;
    let luckyRerollValue = null;

    if (forcedMode === 'advantage') {
        effectiveD20Roll = Math.max(r1, r2);
    } else if (forcedMode === 'disadvantage') {
        effectiveD20Roll = Math.min(r1, r2);
    } else {
        effectiveD20Roll = effectiveD20;
    }

    const luckyFeat = applyTargetLuckyFeat({ rollType, forcedMode, context, campaignName, r1, r2 });
    const resolvedForcedMode = luckyFeat.forcedMode;
    if (luckyFeat.effectiveD20Roll !== null) {
        effectiveD20Roll = luckyFeat.effectiveD20Roll;
    }

    // Halfling Lucky (auto_reroll / roll_equals_1): reroll the natural 1 and use the new roll.
    if (context?.autoReroll && context?.autoRerollCondition === 'roll_equals_1' && effectiveD20Roll === 1) {
        luckyRerollValue = rollD20();
        effectiveD20Roll = luckyRerollValue;
        luckyRerolled = true;
    }

    return { forcedMode: resolvedForcedMode, effectiveD20Roll, luckyRerolled, luckyRerollValue };
}

export function computeD20Roll({ characterName, campaignName, name, rollType, context, bonus, isResilientSphereActive }) {
    const r1 = rollD20();
    const r2 = rollD20();

    const starryDragonFloor = computeStarryDragonFloor(characterName, campaignName, name, rollType);

    const effectiveD20 = applyD20Floor(r1, context, starryDragonFloor);

    let forcedMode = context?.forcedMode || 'normal';

    const cosmicOmen = applyCosmicOmen(rollType, campaignName);
    const cosmicOmenAppliedBonus = cosmicOmen.bonus;
    const cosmicOmenDetail = cosmicOmen.detail;

    const pendingSkillCheck = applyPendingSkillCheckBonus(rollType, characterName, campaignName);
    const pendingSkillCheckAppliedBonus = pendingSkillCheck.bonus;
    const pendingSkillCheckDetail = pendingSkillCheck.detail;

    const rayStrDisadvantage = hasStrTestDisadvantage(rollType, name, characterName);

    if (rayStrDisadvantage) {
        forcedMode = 'disadvantage';
    }

    const sacredWeaponBonus = context?.sacredWeaponBonus || 0;

    const subtract = computeSubtractDiePenalty(characterName, context, rollType);
    const baneAttackPenalty = subtract.banePenalty;
    const baneAttackRoll = subtract.baneRoll;
    const baneDisplayLabel = subtract.displayLabel;
    const subtractDiePenalty = subtract.subtractPenalty;
    const subtractDieRoll = subtract.subtractRoll;
    const subtractDieDisplayLabel = subtract.subtractLabel;
    const subtractDie = subtract.subtractDie;

    const bless = computeBlessAttackBonus(characterName, rollType);
    const blessAttackBonus = bless.bonus;
    const blessAttackRoll = bless.roll;

    const sunderingBlowBonus = computeSunderingBlowBonus(context, rollType);

    const rollResolution = resolveAttackRoll({ rollType, forcedMode, context, campaignName, r1, r2, effectiveD20 });
    const forcedModeResolved = rollResolution.forcedMode;
    const effectiveD20Roll = rollResolution.effectiveD20Roll;
    const luckyRerolled = rollResolution.luckyRerolled;
    const luckyRerollValue = rollResolution.luckyRerollValue;

    const effectiveBonus = bonus + cosmicOmenAppliedBonus + pendingSkillCheckAppliedBonus + sunderingBlowBonus + baneAttackPenalty + subtractDiePenalty + blessAttackBonus;

    const bonusDetailParts = buildBonusDetailParts({
        bonus,
        sacredWeaponBonus,
        sunderingBlowBonus,
        cosmicOmenAppliedBonus,
        cosmicOmenDetail,
        pendingSkillCheckAppliedBonus,
        pendingSkillCheckDetail,
        baneAttackPenalty,
        baneDisplayLabel,
        subtractDiePenalty,
        subtractDieDisplayLabel,
        blessAttackBonus,
    });
    const finalBonusDetail = bonusDetailParts.length > 0 ? '(' + bonusDetailParts.join(', ') + ')' : undefined;

    const isAutoMiss = resolveResilientSphereAutoMiss(context, campaignName, isResilientSphereActive);

    const coverAcBonus = context?.coverAcBonus || 0;

    return {
        r1, r2,
        effectiveD20Roll,
        effectiveBonus,
        forcedMode: forcedModeResolved,
        luckyRerolled,
        luckyRerollValue,
        cosmicOmenAppliedBonus,
        cosmicOmenDetail,
        pendingSkillCheckAppliedBonus,
        pendingSkillCheckDetail,
        rayStrDisadvantage,
        sacredWeaponBonus,
        baneAttackPenalty,
        baneAttackRoll,
        baneDisplayLabel,
        subtractDiePenalty,
        subtractDieRoll,
        subtractDieDisplayLabel,
        subtractDie,
        blessAttackBonus,
        blessAttackRoll,
        sunderingBlowBonus,
        finalBonusDetail,
        isAutoMiss,
        coverAcBonus,
        starryDragonFloor,
        effectiveD20,
    };
}
