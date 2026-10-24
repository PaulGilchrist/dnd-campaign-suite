import { computeRangeEffect, computeEffectiveSpellRange, getDistanceFeet, rangeToFeet } from '../../../combat/rangeValidation.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../postCastRiderService.js';
import { setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';

// Adds a feat range bonus to a spell's effective range when the feat is
// active, the spell is eligible, and the base range is at least 10 feet.
function applyRangeBonus(effectiveRange, spell, featEffects, bonusKey, eligible) {
    const bonus = featEffects?.[bonusKey] || 0;
    if (bonus <= 0 || !eligible) return effectiveRange;
    const baseRange = rangeToFeet(spell.range);
    if (baseRange != null && baseRange >= 10) return effectiveRange + bonus;
    return effectiveRange;
}

function computeRange(spell, metaCtx, attackerPos, targetPos, featEffects) {
    if (!attackerPos || !targetPos) return {};

    const initialRange = computeEffectiveSpellRange(spell.range, metaCtx);
    if (initialRange == null) return {};

    // fix#348(a): symmetric cantrip gate — a cantrip cast into a higher slot is still a
    // cantrip (RAW: cantrip effects scale by cantrip level, not slot level — disk proof
    // spells.json Fire Bolt row: level 0, damage.damage_at_character_level {"1":"1d10",
    // "5":"2d10","11":"3d10","17":"4d10"} — character-level keys, never slot-level).
    // Upcast producers stamp {level:slotLevel, baseLevel:0} (useSimpleSpellHandlers.js:168,
    // useSpellMetamagicGates.js:270, SpellDetailPopup.jsx:378), so the gate reuses this
    // file's OWN cantrip idiom verbatim from computeBlessedStrikes :91
    // (`spell.baseLevel === 0 || spell.level === 0`) — pre-fix this gate read spell.level
    // only and upcast cantrips silently lost featEffects.cantripRangeBonus (disk producer
    // Improved Elemental Fury +300 via featRangeService.js:52 cantrip_range_bonus).
    let effectiveRange = applyRangeBonus(initialRange, spell, featEffects, 'cantripRangeBonus', spell.baseLevel === 0 || spell.level === 0);
    effectiveRange = applyRangeBonus(effectiveRange, spell, featEffects, 'spellRangeBonus', !!spell.attack_type && !spell.dc);

    const distanceFt = getDistanceFeet(attackerPos, targetPos);
    const rangeResult = computeRangeEffect(effectiveRange, distanceFt, featEffects ?? {});
    if (rangeResult.mode === 'miss') {
        return { isAutoMiss: true, rangeReason: rangeResult.reason };
    }
    return {};
}

// CLA-120: single owner of the Empowered Evocation gate — INT mod on evocation
// damage spells only (school gate + cantrip/leveled both eligible), 0 otherwise.
// fix#1468(a): sign-preserving. RAW (2024/classes.json:13502 "Whenever you cast a
// Wizard spell from Evocation school, add your Intelligence modifier to one damage
// roll of that spell."; 5e/classes.json:13454 same law) ADDS the SIGNED modifier —
// a -2 INT cast subtracts 2 damage. The old `empEvocIntMod > 0` gate clamped
// negatives to 0, silently buffing weak-caster damage. getEmpoweredEvocationIntModifier
// (postCastRiderService.js:217-220) already returns intAbility?.bonus verbatim —
// modifiers are signed everywhere else in the house.
function resolveEmpoweredEvocationIntMod(playerStats, spell) {
    const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(playerStats).length > 0;
    const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(playerStats) : 0;
    const spellSchool = (spell.school || '').toLowerCase();
    const isEvocation = spellSchool === 'evocation';
    return hasEmpoweredEvoc && isEvocation && !!spell.damage ? empEvocIntMod : 0;
}

// fix#1469(b)/(c): the file's single omit-safe, sign-aware, fold-once tag append.
// Pre-fix, :79/:95 interpolated a null base into 'null + 5 [Blessed Strikes]' garbage
// and :123 re-appended [Overchannel Maximize] on re-entry with no dedupe. Interpolation
// mirrors the house formula-builder precedent savePrompt.js:148 describeSaveRoll
// (`${saveBonus !== 0 ? ' +' + saveBonus : ''}` — omit when inert, never raw null),
// extended to render negatives as ' - N' because diceRoller.js:46 parses modifier
// segments ([+-]\d+) only — '+-N' is unparseable. Dedupe keys on the MARKER string,
// never on the value (CLA-120 :48 idiom / CLA-279 fold-once shape). A null/empty base
// logs (no-fallback law) and passes through unchanged — never bake a tag onto nothing.
function appendBonusTerm(formula, bonus, tag) {
    const marker = `[${tag}]`;
    if (formula == null || formula === '') {
        console.error(`[spellCast] appendBonusTerm: base formula missing for ${marker} — bonus ${bonus} not applied`);
        return formula;
    }
    if (formula.includes(marker)) return formula;
    const term = bonus > 0 ? ` + ${bonus}` : bonus < 0 ? ` - ${-bonus}` : '';
    return `${formula}${term} ${marker}`;
}

// CLA-120: execution/index.js is the single owner of the single-target bake —
// formula may already carry " + N [Empowered Evocation]" from a pre-baked
// autoDamageFormula; never re-append (CLA-279 Radiant Soul idempotency shape).
function computeEmpoweredEvocation(playerStats, spell, formula) {
    const empEvocIntMod = resolveEmpoweredEvocationIntMod(playerStats, spell);
    let empEvocFormula = formula || null;
    // fix#1468(a): `!== 0` so a negative INT mod still folds ('2d10 - 2 [Empowered
    // Evocation]'); falsy formula still skips only the BAKE (cla120 :137-138 pin).
    if (empEvocIntMod !== 0 && formula) {
        empEvocFormula = appendBonusTerm(formula, empEvocIntMod, 'Empowered Evocation');
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
        // fix#1469(b): was `${empEvocFormula} + ${wisMod} [Blessed Strikes]` — a null
        // base concatenated literally ('null + 5 [Blessed Strikes]').
        return appendBonusTerm(empEvocFormula, wisMod, 'Blessed Strikes');
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
            // fix#1469(b): was `${empEvocFormula} + ${chaMod} [Radiant Soul]` — null-base
            // concat garbage ('null + 4 [Radiant Soul]').
            finalFormula = appendBonusTerm(empEvocFormula, chaMod, 'Radiant Soul');
        }
    }
    return finalFormula;
}

function computeOverchannel({ spell, metaCtx, playerStats, campaignName, getRuntimeValue, empEvocFormula, baseFormula }) {
    let overchannelFormula = baseFormula;
    let overchannelActive = false;
    let overchannelUseCount = 0;

    // fix#126-boundary (#1495 family): missing passives DEGRADE loud, never die.
    // Pre-fix :142 threw — the single production caller (index.js:875 DAMAGE path,
    // unguarded) let the rejection kill executeSpellCast WHOLE: paid slot plus every
    // post-cast rider (surge/rider-saves/heals, the fix#121(a)/CLA-389 merges) —
    // rider-zero bytes captured live 2026-10-22 in spellCastService.featureTriggers
    // and damageCalculation.test.js. An automation-absent caster already survived the
    // ambush self-catch (:157-:164) only to die at this sibling guard. Law (fix#119/
    // fix#126 mirror): a failing NON-CRITICAL resolution costs its own bonus, never
    // the spell — the overchannel maximize is forfeited via the deny-table off-shape
    // (:166 bytes: baseFormula pass-through untouched, overchannelActive:false,
    // useCount 0; consumers fall back via overchannelFormula || formula, savePath.js
    // :255), and BOTH runtime touches (read :151, charge-write :162) sit behind the
    // guard so a never-earned passive is never read and never charged. Guard bytes
    // `== null` mirror the ambush resolver :130 parity; non-array passives stays a
    // loud TypeError — #1360 family contract violation (computeRadiantSoul :117 twin).
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] overchannelPassives: playerStats.automation.passives is missing');
        return { overchannelFormula, overchannelActive, overchannelUseCount };
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
            // fix#1469(c): was a raw `${formulaForOverchannel} [Overchannel Maximize]`
            // append — re-entry double-tagged the same formula (and a null base baked
            // 'null [Overchannel Maximize]'). appendBonusTerm dedupes on the marker
            // (exactly one tag, #1348) and logs+passes through a null base; consumers
            // fall back via `overchannelFormula || formula` (savePath.js:255).
            overchannelFormula = appendBonusTerm(formulaForOverchannel, 0, 'Overchannel Maximize');
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
