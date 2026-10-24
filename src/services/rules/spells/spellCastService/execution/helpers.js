import { setRuntimeValue, getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { executeHandler } from '../../../../automation/index.js';
import { addExpiration } from '../../../effects/expirations.js';
import { usesSpellSlot } from '../../../features/spellUtils.js';
import { onAbjurationSpellCast } from '../../../../automation/handlers/class-wizard/arcaneWardHandler.js';
import { getCombatContext } from '../../../combat/damageUtils.js';
import { applyHealingToTarget } from '../../../combat/applyHealing.js';
import { applyDamageToTarget } from '../../../../../services/rules/combat/applyDamage.js';
import { getCombatSummary } from '../../../../../services/encounters/combatData.js';
import { rollExpression, rollExpressionMaximized, applyHealingRerollOnes } from '../../../../dice/diceRoller.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximizationForTarget, hasRerollHealingOnes } from '../../../../combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';

const DIVINATION_SCHOOL = 'divination';

function applyHexEffects(spell, playerStats, campaignName, targetName, ability) {
    if (spell.name !== 'Hex') return;

    if (!targetName || !ability) return;

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = [...storedEffects];

    // Base Hex: apply ability check disadvantage for chosen ability
    const existingAbilityCheckIndex = effects.findIndex(
        te => te.target === targetName && te.effect === 'hex_ability_check_disadvantage' && te.source === playerStats.name
    );
    const hexAbilityCheckEffect = {
        target: targetName,
        effect: 'hex_ability_check_disadvantage',
        source: playerStats.name,
        ability: ability,
        duration: 'hex_duration',
    };
    if (existingAbilityCheckIndex >= 0) {
        effects[existingAbilityCheckIndex] = hexAbilityCheckEffect;
    } else {
        effects.push(hexAbilityCheckEffect);
    }

    // Eldritch Hex (Warlock 10): also apply saving throw disadvantage
    const passives = playerStats.automation?.passives;
    const hasEldritchHex = Array.isArray(passives) && passives.some(p => p.name === 'Eldritch Hex' && p.type === 'conditional_disadvantage');
    if (hasEldritchHex) {
        const existingSaveIndex = effects.findIndex(
            te => te.target === targetName && te.effect === 'hex_save_disadvantage' && te.source === playerStats.name
        );
        const hexSaveEffect = {
            target: targetName,
            effect: 'hex_save_disadvantage',
            source: playerStats.name,
            ability: ability,
            duration: 'hex_duration',
        };
        if (existingSaveIndex >= 0) {
            effects[existingSaveIndex] = hexSaveEffect;
        } else {
            effects.push(hexSaveEffect);
        }
    }

    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    // CLA-107 / #1497 (fix#108 mirror): arm ONE merged remove_target_effect
    // expiry so both hex tes clear at the combat boundaries. Hex is
    // 'Concentration, up to 1 hour' (2024 spells.json:7143, concentration:true)
    // — authored ≥1 minute is COMBAT-SCOPED per the NO-CLOCK duration policy;
    // the old §37 hours×600 (rounds:600) fabricated round countdown is retired.
    // Canonical combat-scoped stamp: rounds Infinity + until: 'combat'
    // (zoneDurationClock.js:102; fix#108 twin at spiritualWeaponService.js:107)
    // — no round seam matures it (processExpirationList: appliedRound+Infinity
    // never expires), sweepCombatScopedExpirations drains it at the rest seams
    // (restRules-shortRest/longRest → sweepRestClocks, zoneDurationClock.js:139),
    // clearAllExpirationEffects (initiativeProcessing.js:36) unconditionally
    // drains the caster store at every new initiative roll, and
    // cleanupConcentrationEffects purges the tes on a concentration break —
    // concentration stays concentration, never a clock.
    const expiryEffects = [{ type: 'remove_target_effect', effectKey: 'hex_ability_check_disadvantage', source: playerStats.name, target: targetName }];
    if (hasEldritchHex) {
        expiryEffects.push({ type: 'remove_target_effect', effectKey: 'hex_save_disadvantage', source: playerStats.name, target: targetName });
    }
    addExpiration({ attackerName: playerStats.name, targetName, effects: expiryEffects, campaignName, rounds: Infinity, until: 'combat' });
}

async function triggerArcaneWard(spell, metaCtx, playerStats, campaignName) {
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] triggerArcaneWard: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for Arcane Ward');
    }
    const hasArcaneWard = passives.some(p => p.type === 'arcane_ward' || (p.type === 'passive_rule' && p.effect === 'arcane_ward'));
    if (!hasArcaneWard) return;

    const school = (spell.school || '').toLowerCase();
    if (school !== 'abjuration') return;

    if (!usesSpellSlot(spell, metaCtx)) return;

    const spellSlotLevel = metaCtx?.slotLevel || spell.level;
    const action = {
        name: 'Arcane Ward',
        automation: { type: 'arcane_ward' },
    };

    try {
        await onAbjurationSpellCast(action, playerStats, spell.name, spellSlotLevel, campaignName);
    } catch (e) {
        console.error('[spellCast] Arcane Ward trigger failed:', e);
    }
}

// fix#300 (#1462 barrel-refund + refund-chain census): LIVENESS-QED — KEEP+DOCUMENT.
// Production trigger chain (all links bytes-verified 2026-10-23):
//   PRODUCER  public/data/2024/classes.json:13366-13383 'Spell Breaker' lv10 —
//             automation.effect 'spell_breaker', slotRetentionSpells:
//             ["Counterspell","Dispel Magic"]; collected verbatim by
//             automationCollector.js:60 onto playerStats.automation.passives.
//   GATE 1    hub execution/index.js:307 awaits triggerDispelMagic on every
//             'Dispel Magic' cast (executeSpellCast is that chain's live route).
//   GATE 2    helpers.js:214 checkFailed (d20+bonus < 10+slotLevel — dice vary,
//             so the false branch is reachable, not constant).
//   GATE 3    refundDispelSpellBreakerSlot :187 — includes('Dispel Magic') holds
//             on the disk bytes above; usesSpellSlot holds for slot casts.
//   WRITE     HERE :188→:135-:141 (+1 to spell_slots_level_<n>, negative/null
//             boundary :138 refuses). Sign/order: refund lands AFTER the failed
//             check log (:216) and never after a success — checkFailed gates :218.
// NOT dead-by-construction. The barrel re-export surface (execution/index.js:951 →
// spellCastService.js:4) has zero PRODUCTION importers of this symbol (sole named
// consumers: master lane spellCastService.test.js:233-247 'barrel surface + zero
// boundary' pin + module-direct execution/helpers-spellBreaker.test.js); per
// run2#1462 precedent ('barrel refund no-prod-consumer liveness-proof-kept') the
// surface stays documented-public and test-pinned, not deleted. counterSpellHandler
// .js:89's same-named function is its OWN local — no edge to this symbol.
export function refundSpellBreakerSlot(playerName, spellLevel, campaignName) {
    const slotKey = `spell_slots_level_${spellLevel}`;
    const currentSlots = getRuntimeValue(playerName, slotKey);
    if (currentSlots == null || currentSlots < 0) return;
    setRuntimeValue(playerName, slotKey, currentSlots + 1, campaignName);
}

function resolveDispelCheckBonus(spell, playerStats, metaCtx, profBonus) {
    const spellCastAbility = spell.spellCastingAbility || playerStats.spellAbilities?.spellCastingAbility;
    let abilityMod = playerStats.spellAbilities?.modifier || 0;
    if (spellCastAbility && playerStats.abilities) {
        const ability = playerStats.abilities.find(a => a.name === spellCastAbility);
        if (ability) {
            abilityMod = ability.bonus;
        }
    }

    const spellBreaker = playerStats.automation?.passives?.find(p => p.type === 'spell_breaker');
    // SpellDetailPopup forwards PB in metaCtx when Spell Breaker is held —
    // it is the same bonus the passive grants, so take the larger of the two
    // instead of stacking (CLA-322 PB double-count).
    const ctxBonus = typeof metaCtx?.dispelAbilityCheckBonus === 'number' ? metaCtx.dispelAbilityCheckBonus : 0;
    const breakerBonus = Math.max(spellBreaker ? profBonus : 0, ctxBonus);
    return { spellBreaker, totalCheckBonus: abilityMod + breakerBonus };
}

function logDispelCheck({ campaignName, playerStats, targetName, d20, totalCheckBonus, total, targetDC, checkFailed }) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Dispel Magic',
        description: `Dispel Magic ability check on ${targetName}: d20 (${d20}) + ${totalCheckBonus} = ${total} vs DC ${targetDC} — ${checkFailed ? 'failed, spell not stopped' : 'succeeded'}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[spellCast] Dispel Magic check log failed:', e); });

    window.dispatchEvent(new CustomEvent('spell-result', {
        detail: {
            spellName: 'Dispel Magic',
            casterName: playerStats.name,
            targetName,
            checkBonus: totalCheckBonus,
            targetDC,
            d20,
            total,
            checkFailed,
            isDispelMagic: true,
        },
        bubbles: true,
    }));
}

function refundDispelSpellBreakerSlot({ spellBreaker, spell, metaCtx, playerStats, spellLevel, campaignName }) {
    if (!spellBreaker?.slotRetentionSpells?.includes('Dispel Magic') || !usesSpellSlot(spell, metaCtx)) return;
    refundSpellBreakerSlot(playerStats.name, spellLevel, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Spell Breaker',
        description: `Spell Breaker: Dispel Magic failed to stop a spell — spell slot level ${spellLevel} refunded.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[spellCast] Spell Breaker refund log failed:', e); });
}

// Dispel Magic: resolves the caster ability check (d20 + spellcasting modifier,
// + Proficiency Bonus with Spell Breaker) vs DC 10 + spell level. CLA-322:
// logs the check, dispatches `spell-result` with `checkFailed` for popup
// consumers, and on failure refunds the spent slot via Spell Breaker slot
// retention keyed by the ACTUAL cast slot level.
async function triggerDispelMagic(metaCtx, spell, playerStats, campaignName, _mapName) {
    const profBonus = Math.floor((playerStats.level - 1) / 4 + 2);
    const { spellBreaker, totalCheckBonus } = resolveDispelCheckBonus(spell, playerStats, metaCtx, profBonus);

    const targetName = metaCtx?.targetName || 'unknown target';
    const spellLevel = metaCtx?.slotLevel || spell.level || 0;
    const targetDC = 10 + spellLevel;

    const rollResult = rollExpression('1d20');
    const d20 = rollResult?.rolls?.[0] ?? rollResult?.total ?? 0;
    const total = d20 + totalCheckBonus;
    const checkFailed = total < targetDC;

    logDispelCheck({ campaignName, playerStats, targetName, d20, totalCheckBonus, total, targetDC, checkFailed });

    if (checkFailed) {
        refundDispelSpellBreakerSlot({ spellBreaker, spell, metaCtx, playerStats, spellLevel, campaignName });
    }
}

function powerWordHealDamage({ combatSummary, targetName, playerStats, campaignName, maxHp, currentHp }) {
    const healAmount = Math.max(0, maxHp - currentHp);
    if (healAmount <= 0) return;

    const result = applyHealingToTarget(combatSummary, targetName, healAmount, campaignName);
    const actualHeal = result?.actualHeal ?? healAmount;
    const newHp = Math.min(maxHp, currentHp + actualHeal);
    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: actualHeal,
        currentHp: newHp,
        maxHp,
        isHealing: true,
        sourceName: playerStats.name,
        note: 'Power Word Heal',
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellCast] Error:", e); });
    window.dispatchEvent(new CustomEvent('healing-popup', {
        detail: {
            targetName,
            sourceName: playerStats.name,
            healingName: 'Power Word Heal',
            rollInfo: '',
            maximizeHealingDice: false,
            popupText: `Power Word Heal on ${targetName}: Regained ${actualHeal} HP`,
        },
    }));
}

// #1481 validate-before-mutate (fix#22 lineage, useAttackDamageResolution.js
// :511-:514 hoist class): hoisted out of powerWordHealConditions so the cast
// REFUSES an invalid activeConditions payload BEFORE powerWordHealDamage's
// heal + log + popup dispatch — never again "HP restored, then throw".
function validateActiveConditions(targetName, campaignName) {
    // SP-002 sibling: a target with no activeConditions key has nothing to strip — [] is empty, not fatal.
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName);
    if (storedConditions != null && !Array.isArray(storedConditions)) {
        console.error('[spellCast] applyPowerWordHealToTarget: activeConditions is not an array');
        throw new Error('activeConditions must be an array');
    }
    return storedConditions == null ? [] : storedConditions;
}

function powerWordHealConditions(targetName, campaignName, conditions) {
    const conditionsToRemove = ['charmed', 'frightened', 'paralyzed', 'poisoned', 'stunned'];
    const hasProne = conditions.some(c => String(c).toLowerCase() === 'prone');
    const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));
    if (newConditions.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
        for (const removed of conditionsToRemove) {
            if (!newConditions.some(c => String(c).toLowerCase() === removed)) {
                addEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                    reason: 'Power Word Heal',
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[spellCast] Error:", e); });
            }
        }
    }

    if (hasProne) {
        const existingStance = getRuntimeValue(targetName, 'powerWordHealStandPermission', campaignName);
        if (!existingStance) {
            setRuntimeValue(targetName, 'powerWordHealStandPermission', true, campaignName);
        }
    }
}

async function applyPowerWordHealToTarget(targetName, playerStats, campaignName, sharedCombatSummary) {
    // CLA-392: optional shared combatSummary — when the Words of Creation spread
    // heals two targets, both legs mutate ONE fetched snapshot so the second
    // leg's full-store write can never resurrect the first target (§6-#18 race).
    const combatSummary = sharedCombatSummary || await getCombatContext(campaignName);
    if (!combatSummary) return;

    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) return;

    const isPlayer = creature.type === 'player';
    const maxHp = isPlayer
        ? (getRuntimeValue(targetName, 'hitPoints') ?? creature.maxHp ?? 0)
        : (creature.maxHp ?? 0);
    const currentHp = isPlayer
        ? (getRuntimeValue(targetName, 'currentHitPoints') ?? creature.currentHp ?? maxHp)
        : (creature.currentHp ?? maxHp);

    // #1481 validate-first: activeConditions is read + validated BEFORE any
    // mutation (heal at powerWordHealDamage, condition writes after). An
    // invalid payload throws here — HP never touched, popup never dispatched.
    const conditions = validateActiveConditions(targetName, campaignName);

    powerWordHealDamage({ combatSummary, targetName, playerStats, campaignName, maxHp, currentHp });
    powerWordHealConditions(targetName, campaignName, conditions);
}

async function applyPowerWordKillToTarget(targetName, playerStats, campaignName, sharedCombatSummary) {
    // CLA-392: optional shared combatSummary — both spread legs mutate ONE
    // fetched snapshot so the second leg's full-store write can never
    // resurrect the first target (§6-#18 race).
    const combatSummary = sharedCombatSummary || await getCombatContext(campaignName);
    if (!combatSummary) return;

    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) return;

    const isPlayer = creature.type === 'player';
    const currentHp = isPlayer
        ? (getRuntimeValue(targetName, 'currentHitPoints') ?? creature.currentHp ?? creature.maxHp)
        : (creature.currentHp ?? creature.maxHp);

    if (currentHp <= 100) {
        addEntry(campaignName, {
            type: 'hp_change',
            targetName: targetName,
            delta: -(currentHp || creature.maxHp),
            currentHp: 0,
            maxHp: creature.maxHp,
            isHealing: false,
            isUnconscious: false,
            threshold: 'dead',
            note: 'Power Word Kill',
        }).catch((e) => { console.error("[spellCast] Error:", e); });

        await applyDamageToTarget(combatSummary, targetName, currentHp, ['Psychic'], { campaignName, characters: [], ignoreResistance: false, attackerName: playerStats.name });

        window.dispatchEvent(new CustomEvent('damage-popup', {
            detail: {
                targetName,
                sourceName: playerStats.name,
                spellName: 'Power Word Kill',
                popupText: `${targetName} was slain by Power Word Kill`,
                damageType: 'Psychic',
            },
        }));
    } else if (playerStats.rules === '2024') {
        // #1482 2024-only disk law (public/data/2024/spells.json:10210):
        // "Otherwise, it takes 12d12 Psychic damage." + damage_at_slot_level
        // {"9":"12d12"} Psychic. The fallback lives ONLY on the 2024 row.
        const damageFormula = '12d12';
        const damageResult = rollExpression(damageFormula);
        const totalDamage = damageResult?.total ?? 0;
        await applyDamageToTarget(combatSummary, targetName, totalDamage, ['Psychic'], { campaignName, characters: [], ignoreResistance: false, attackerName: playerStats.name });

        window.dispatchEvent(new CustomEvent('damage-popup', {
            detail: {
                targetName,
                sourceName: playerStats.name,
                spellName: 'Power Word Kill',
                popupText: `${targetName} took ${totalDamage} Psychic damage (too healthy to kill)`,
                damageType: 'Psychic',
                rolls: damageResult?.rolls || [],
                formula: damageFormula,
            },
        }));
    } else {
        // #1482 5e disk law (public/data/spells.json:7588): "If the creature
        // you choose has 100 hit points or fewer, it dies. Otherwise, the
        // spell has no effect." — NO roll, NO damage, NO popup for 5e casts
        // (house selector fix#98: only playerStats.rules === '2024' grants
        // the fallback; unset rules default to 5e per rulesFactory). Loud
        // campaign log per AGENTS.md: every automation logs when triggered.
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Power Word Kill',
            description: `Power Word Kill on ${targetName}: target has ${currentHp} hit points (more than 100) — the spell has no effect.`,
        }).catch((e) => { console.error("[spellCast] Error:", e); });
    }
}

async function triggerExpertDivination(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!usesSpellSlot(spell, metaCtx)) {
        return null;
    }

    const school = (spell.school || '').toLowerCase();
    if (school !== DIVINATION_SCHOOL) {
        return null;
    }

    const spellSlotLevel = metaCtx?.slotLevel || spell.level;
    if (!spellSlotLevel || spellSlotLevel < 2) {
        return null;
    }

    // Check if player has Expert Divination feature
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] triggerExpertDivination: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for expert divination');
    }
    const hasExpertDivination = passives.some(p => p.name === 'Expert Divination' && p.type === 'expert_divination');
    if (!hasExpertDivination) {
        return null;
    }

    const action = {
        name: 'Expert Divination',
        automation: {
            type: 'expert_divination',
            casting_time: 'passive',
        },
        spell,
        spellSlotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[spellCast] Expert Divination trigger failed:', e);
        return null;
    }
}

function resolveRegenerateExpression(healAtSlotLevel, slotLevel) {
    const expression = healAtSlotLevel[slotLevel];
    if (expression) return expression;
    const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
    const highestBelow = levels.filter(l => l <= slotLevel).pop();
    return highestBelow ? healAtSlotLevel[highestBelow] : expression;
}

// Roll the Regenerate expression, honouring maximization and ones-reroll.
function rollRegenerateHeal(expression, caster, targetName, campaignName) {
    const maximize = hasHealingMaximizationForTarget(caster, targetName, campaignName);
    const rerollOnes = hasRerollHealingOnes(caster);
    let result = maximize ? rollExpressionMaximized(expression) : rollExpression(expression);
    if (result && rerollOnes && !maximize) {
        const { displayRolls } = applyHealingRerollOnes(result.rolls, expression);
        result = { ...result, rolls: displayRolls };
    }
    return result;
}

function logRegenerateHealEntry({ spell, targetName, caster, campaignName, expression, initialHeal, maxHp, currentHp, bonusDetails }) {
    const formulaParts = [expression];
    if (bonusDetails.length > 0) {
        const bonusParts = bonusDetails.map(d => `${d.amount} ${d.name}`).join(' + ');
        formulaParts.push(`(${bonusParts})`);
    }
    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: initialHeal,
        currentHp: Math.min(maxHp, currentHp + initialHeal),
        maxHp,
        isHealing: true,
        sourceName: caster.name,
        note: spell.name,
        formula: formulaParts.join(' + '),
        bonusDetails: bonusDetails.length > 0 ? bonusDetails : undefined,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellCast] Error:", e); });
}

// Rolls the initial Regenerate healing, applies it, and logs the hp_change entry.
async function applyRegenerateInitialHeal({ spell, targetName, caster, campaignName, expression, bonusHeal, bonusDetails }) {
    const result = rollRegenerateHeal(expression, caster, targetName, campaignName);
    if (!result) return { initialHeal: 0, result };

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return { initialHeal: 0, result };

    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (creature?.maxHp == null && caster.hitPoints == null) {
        console.error('[spellCast] applyRegenerateSpell: max HP is missing for both creature and caster')
        throw new Error('max HP is required for regenerate spell')
    }
    const maxHp = creature?.maxHp || caster.hitPoints;
    const currentHp = creature?.currentHp ?? getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? maxHp;
    const healAmount = result.total + bonusHeal;
    const initialHeal = Math.min(healAmount, maxHp - currentHp);
    if (initialHeal > 0) {
        applyHealingToTarget(combatSummary, targetName, initialHeal, campaignName);
    }
    logRegenerateHealEntry({ spell, targetName, caster, campaignName, expression, initialHeal, maxHp, currentHp, bonusDetails });

    return { initialHeal, result };
}

async function applyRegenerateSpell(spell, target, caster, campaignName) {
    const targetName = target.name;
    const casterName = caster.name;
    if (spell.level == null) {
        console.error('[spellCast] applyRegenerateSpell: spell.level is missing')
        throw new Error('spell.level is required for regenerate spell')
    }
    const slotLevel = spell.level;
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (healAtSlotLevel == null || typeof healAtSlotLevel !== 'object') {
        console.error('[spellCast] applyRegenerateSpell: heal_at_slot_level is not an object');
        throw new Error('heal_at_slot_level must be an object');
    }
    const expression = resolveRegenerateExpression(healAtSlotLevel, slotLevel);

    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(caster, { prof: caster.proficiency || 0, level: caster.level || 1, slotLevel, campaignName });

    // Apply initial healing
    let initialHeal = 0;
    let result = null;
    if (expression) {
        const healed = await applyRegenerateInitialHeal({ spell, targetName, caster, campaignName, expression, bonusHeal, bonusDetails });
        initialHeal = healed.initialHeal;
        result = healed.result;
    }

    // Set up turn-start healing: store regenerateActive on the target
    await setRuntimeValue(targetName, 'regenerateActive', true, campaignName);
    await setRuntimeValue(targetName, 'regenerateSource', casterName, campaignName);

    // Register the combat-scoped removal seam: the remove_regenerate_buff
    // expiration clears on a new initiative roll / short-long rest (no
    // fabricated hour→round countdown — §no-timers; the '1 hour' upper bound
    // lives in the spell's prose, not in a stored clock — fix#336S/#1483).
    addExpiration({ attackerName: casterName, targetName, effects: [
        { type: 'remove_regenerate_buff' }
    ], campaignName });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: spell.name,
        description: `${casterName} cast ${spell.name} on ${targetName}. Target regains HP and regains 1 HP at start of each turn for 1 hour.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellCast] Error:", e); });

    return { targetName, healAmount: initialHeal, formula: expression, rolls: result?.rolls || [], rawTotal: result?.total + bonusHeal || initialHeal, bonusHeal, bonusDetails };
}

function isMagicMissile(spell) {
    return spell.name && spell.name.toLowerCase() === 'magic missile';
}

function getMagicMissileCount(slotLevel) {
    return 3 + (slotLevel - 1);
}

function rollTargetMissiles(missileDamage, missileCount) {
    let totalTargetDamage = 0;
    const missileRolls = [];
    for (let i = 0; i < missileCount; i++) {
        const missileResult = rollExpression(missileDamage);
        if (!missileResult) continue;
        missileRolls.push(missileResult.total);
        totalTargetDamage += missileResult.total;
    }
    return { missileRolls, totalTargetDamage };
}

function resolveIgnoreResistance(playerStats) {
    const passives = playerStats.automation?.passives;
    // fix#300 (#1456 ':515-era dead-via-hub-ambush-chokepoint' census): KEEP-WITH-CITE
    // — the #1456 verdict is STALE. Era bytes: hub resolveMagicalAmbushInvisible was
    // called UNGUARDED on every executeSpellCast cast and threw first on passives==null
    // (identical-lookup shadow, chokepoint-inline-dup #1357/58), so this guard was
    // hub-unreachable. fix#126 (#1495) converted the hub call to
    // resolveMagicalAmbushOrDegrade (execution/index.js:160-166/:811 — self-catch →
    // hasInvisible:false → cast proceeds), un-shadowing this guard: on a hub missile
    // cast with passives==null it is now the FIRST loud throw (:937 handleNoSavePath →
    // noSavePath.js:74 → executeMagicMissile :672 → :613). Zero partial writes: the
    // throw precedes applyDamageToTarget (:614). In-practice guard only — the disk
    // collector stamps passives:[] unconditionally (automationCollector.js:111).
    // Throw-vs-degrade tension (fix#126 law mirror damageCalculation.js:139) QUEUED,
    // not silently re-litigated here — see fix#300 ledger row.
    if (passives == null) {
        console.error('[spellCast] executeMagicMissile: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for ignore resistance check');
    }
    return passives.some(p => p.type === 'auto_effect' && p.effect === 'ignore_resistance');
}

function applyMissileDamage({ combatSummary, targetName, totalTargetDamage, damageType, campaignName, characters, casterName, playerStats }) {
    // #1456 RAW gate: Magic Missile immunity belongs ONLY to the Shield SPELL buff.
    // Disk law (public/data/spells.json:8779): "Until the start of your next turn, you
    // have a +5 bonus to AC, including against the triggering attack, and you take no
    // damage from magic missile." — full immunity to THIS spell only, never to missiles
    // generally, and never to a bare AC-stamp. The PC Shield-spell buff is persisted by
    // shieldHandler.js:36-41 via toggleBuff (name 'Shield', effect 'shield', NO oneShot);
    // monster Shield reactions stamp effect 'shield' WITH oneShot:true and an acBonus vs
    // ONE named triggering attack (MonsterCardHelpers.js:1888-1899 buildShieldBuff, MA-1170:
    // "oneShot:true marks the MONSTER reaction stamp"). A oneShot stamp therefore grants
    // "+5 AC against the triggering attack" in the attack lane — NOT immunity to a whole
    // auto-hit volley: darts flow through to applyDamageToTarget below.
    const shieldBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName)?.filter(b => b?.effect === 'shield');
    const isShieldActive = shieldBuffs?.some(b => b.oneShot !== true);
    if (isShieldActive) {
        return { finalDamage: 0, damageReduced: true, isShieldActive };
    }
    const ignoreResistance = resolveIgnoreResistance(playerStats);
    const applyResult = applyDamageToTarget(combatSummary, targetName, totalTargetDamage, [damageType], { campaignName, characters: characters, ignoreResistance: ignoreResistance, attackerName: casterName });
    if (applyResult && applyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(casterName, campaignName);
    }
    return {
        finalDamage: applyResult?.finalDamage ?? totalTargetDamage,
        damageReduced: applyResult?.damageReduced,
        isShieldActive,
    };
}

function logMagicMissileSpell({ campaignName, casterName, spell, slotLevel, numMissiles, missileDamage, damageType, logEntries }) {
    const allMissileDamage = logEntries.reduce((sum, e) => sum + e.total, 0);
    const allFinalDamage = logEntries.reduce((sum, e) => sum + e.finalDamage, 0);
    rollExpression(`${numMissiles}× ${missileDamage}`);

    addEntry(campaignName, {
        type: 'spell',
        characterName: casterName,
        spellName: spell.name,
        spellLevel: slotLevel,
        castingTime: spell.casting_time,
        missileCount: numMissiles,
        missileDamage,
        damageType,
        targets: logEntries.map(e => ({
            name: e.targetName,
            missiles: e.rolls.length,
            rawDamage: e.total,
            finalDamage: e.finalDamage,
            shieldImmune: e.shieldImmune,
        })),
        totalRawDamage: allMissileDamage,
        totalFinalDamage: allFinalDamage,
        timestamp: Date.now(),
    });
}

async function executeMagicMissile(spell, metaCtx, { rollDamage, playerStats, getTargetInfo: _getTargetInfo, campaignName, mapName: _mapName, characters }) {
    const slotLevel = metaCtx?.slotLevel || spell.level;
    const numMissiles = getMagicMissileCount(slotLevel);
    const missileDamage = '1d4 + 1';
    const damageType = spell.damage?.damage_type || 'Force';
    const distribution = metaCtx?.magicMissileDistribution;
    if (!distribution || Object.keys(distribution).length === 0) {
        return;
    }

    const combatSummary = getCombatSummary(campaignName) || { creatures: [] };
    const casterName = playerStats.name;
    const logEntries = [];

    for (const [targetName, missileCount] of Object.entries(distribution)) {
        if (missileCount <= 0) continue;

        const { missileRolls, totalTargetDamage } = rollTargetMissiles(missileDamage, missileCount);
        if (totalTargetDamage <= 0) continue;

        const { finalDamage, damageReduced, isShieldActive } = applyMissileDamage({ combatSummary, targetName, totalTargetDamage, damageType, campaignName, characters, casterName, playerStats });

        const missileFormula = missileCount === 1 ? missileDamage : `${missileCount}× ${missileDamage}`;

        rollDamage({ name: `Magic Missile (${targetName})`, formula: missileFormula, total: totalTargetDamage, rolls: missileRolls, modifier: 0, context: {
            targetName,
            isAutoDamage: true,
            damageType,
            isAutoHit: true,
        } });

        logEntries.push({
            type: 'roll',
            characterName: casterName,
            rollType: 'damage',
            name: `Magic Missile (${targetName})`,
            formula: missileFormula,
            rolls: missileRolls,
            total: totalTargetDamage,
            modifier: 0,
            damageType,
            targetName,
            finalDamage,
            damageReduced,
            shieldImmune: isShieldActive,
            timestamp: Date.now(),
        });
    }

    if (logEntries.length > 0) {
        logMagicMissileSpell({ campaignName, casterName, spell, slotLevel, numMissiles, missileDamage, damageType, logEntries });
    }
}

// fix#304 (#1504 dead-export census): DIVINATION_SCHOOL and getMagicMissileCount
// export-deleted. ZERO production importers of EITHER export — production importers are
// execution/index.js:26 (8 names) and noSavePath.js:3 (isMagicMissile, executeMagicMissile)
// only, and the barrel re-export surface (execution/index.js:951) never carried them.
// Both stay LIVE MODULE-LOCAL: DIVINATION_SCHOOL at :15/:403 (triggerExpertDivination) and
// getMagicMissileCount at :558/:654 (executeMagicMissile). Import-at-consumer was NOT
// cheap (fix#294 shape): the inline-literal consumers expertDivinationHandler.js:4 and
// warMagicSpellHandler.js:121 (getMagicMissileDartCount mirror, 'mirrors executeMagicMissile'
// per its :120 cite) both live UNDER automation/index.js, which helpers.js:3 imports —
// importing helpers.js back up would cycle the module graph. Two independent one-word
// literals in sibling handler trees stay; a shared constants module is QUEUED, not this lane.
export {
    applyHexEffects,
    triggerArcaneWard,
    triggerDispelMagic,
    applyPowerWordHealToTarget,
    applyPowerWordKillToTarget,
    triggerExpertDivination,
    applyRegenerateSpell,
    isMagicMissile,
    executeMagicMissile,
};
