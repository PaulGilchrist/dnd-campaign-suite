import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { isWithinRange } from '../combat/rangeCheck.js';
import { rangeToFeet } from '../combat/rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization, hasHealingMaximizationForTarget, markFortifiedHealthUsed } from '../../combat/automation/automationService.js';
import { triggerPostCastSelfHeals } from '../spells/postCastHealService.js';

const MASS_CURE_WOUNDS_NAME = 'Mass Cure Wounds';
// Disk 5e spells.json:6691 'Choose up to six creatures in a 30-foot-radius
// sphere centered on that point.' — no friendly/allies wording, so hostile
// creatures inside the AoE stay RAW-eligible (#1384 choice-clause verdict).
// Fallback for rows without automation.maxTargets only; disk value wins.
const DEFAULT_MAX_TARGETS = 6;

function isMassCureWounds(spell) {
    // fix#349 #1384: dispatcher twin of massHealingWordService.js — the
    // lowercase dispatch at triggerSpells.js:422 `spell.name.toLowerCase() ===
    // 'mass cure wounds'` reaches this gate with any casing; strict equality
    // silently nulled case-drift casts. Fold BOTH sides (fix#109 precedent).
    return (spell.name || '').toLowerCase() === MASS_CURE_WOUNDS_NAME.toLowerCase();
}

function getSpellCastingMod(playerStats, spell) {
    const cantripSpellAbility = spell.spellCastingAbility || playerStats.spellAbilities?.spellCastingAbility;
    if (cantripSpellAbility && playerStats.abilities) {
        const ability = playerStats.abilities.find(a => a.name === cantripSpellAbility);
        if (ability) {
            return ability.bonus;
        }
    }
    if (playerStats.spellAbilities) {
        return playerStats.spellAbilities.modifier || 0;
    }
    return 0;
}

function resolveHealExpression(spell, slotLevel, spellCastingMod) {
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (!healAtSlotLevel) {
        return null;
    }

    let expression = healAtSlotLevel[slotLevel];
    if (!expression) {
        const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
        const highestBelow = levels.filter(l => l <= slotLevel).pop();
        if (highestBelow) {
            expression = healAtSlotLevel[highestBelow];
        }
    }

    if (!expression) {
        return null;
    }

    if (spellCastingMod !== null && spellCastingMod !== undefined) {
        expression = expression.replace(/\bMOD\b/g, String(spellCastingMod));
    }

    return expression;
}

function requireCreatures(combatSummary) {
    const x = combatSummary.creatures;
    if (x == null) {
        console.error('[massCureWoundsService] Missing array:', x);
        throw new Error('Expected array, got ' + x);
    }
    return x;
}

function buildHealFormula(healExpression, bonusDetails) {
    const formulaParts = [healExpression];
    if (bonusDetails.length > 0) {
        const bonusParts = bonusDetails.map(d => `${d.amount} ${d.name}`).join(' + ');
        formulaParts.push(`(${bonusParts})`);
    }
    return formulaParts.join(' + ');
}

function healMassTarget(combatSummary, target, ctx) {
    const { playerStats, campaignName, casterName, healExpression, bonusHeal, bonusDetails, maximize } = ctx;
    const targetName = target.name;
    const maxHp = target.maxHp || playerStats.hitPoints || 0;
    const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
    const targetMaximize = hasHealingMaximizationForTarget(playerStats, targetName, campaignName);
    const rollResult = targetMaximize || maximize ? rollExpressionMaximized(healExpression) : rollExpression(healExpression);
    if (!rollResult) return null;

    const targetHealAmount = rollResult.total + bonusHeal;
    const actualHeal = Math.min(targetHealAmount, maxHp - currentHp);

    if (actualHeal > 0) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
    }

    const newHp = Math.min(maxHp, currentHp + actualHeal);

    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: actualHeal,
        currentHp: newHp,
        maxHp,
        isHealing: true,
        sourceName: casterName,
        note: 'Mass Cure Wounds',
        formula: buildHealFormula(healExpression, bonusDetails),
        bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[massCureWounds] Error:", e); });

    return { targetName, healAmount: actualHeal, rolls: rollResult.rolls, rawTotal: rollResult.total + bonusHeal };
}

// CLA-038: post-cast self-heal passives (e.g. Blessed Healer) fire when
// this mass heal restored HP to at least one creature other than the caster.
async function maybeTriggerBlessedHealer({ spell, results, casterName, playerStats, slotLevel, campaignName, mapName }) {
    if (!results.some(r => r.healAmount > 0 && r.targetName !== casterName)) {
        return;
    }
    await triggerPostCastSelfHeals(spell, { slotLevel, targetNames: results.map(r => r.targetName) }, playerStats, campaignName, mapName).catch(e => {
        console.error('[massCureWoundsService] Post-cast self-heal failed:', e);
    });
}

// #1384 selection law: candidates pass canonical isWithinRange(caster, name,
// rangeToFeet(spell.range)) — disk '60 feet' enforced, no hardcoded feet.
// Choice clause (:6691) says 'Choose up to six creatures in a 30-foot-radius
// sphere' — no friendly/allies wording, so hostiles in range stay RAW-legal
// and affiliation is deliberately unfiltered (the sphere's point-of-origin
// selection lives upstream). maxTargets reads automation.maxTargets else the
// disk-text default. Lawful pool keeps combatSummary array order.
async function selectLawfulTargets(spell, combatSummary, casterName) {
    const maxTargets = spell.automation?.maxTargets || DEFAULT_MAX_TARGETS;
    const rangeFt = rangeToFeet(spell.range);
    const lawful = [];
    for (const creature of requireCreatures(combatSummary)) {
        if (await isWithinRange(casterName, creature.name, rangeFt)) {
            lawful.push(creature);
        }
    }
    return lawful.slice(0, maxTargets);
}

export async function triggerMassCureWounds(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!isMassCureWounds(spell)) {
        return null;
    }

    const slotLevel = metaCtx?.slotLevel || spell.level || 5;
    const spellCastingMod = getSpellCastingMod(playerStats, spell);
    const healExpression = resolveHealExpression(spell, slotLevel, spellCastingMod);

    if (!healExpression) {
        return null;
    }

    const maximize = hasHealingMaximization(playerStats);
    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, { prof: playerStats.proficiency || 0, level: playerStats.level || 1, slotLevel, campaignName });
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const casterName = playerStats.name;
    const targets = await selectLawfulTargets(spell, combatSummary, casterName);

    if (targets.length === 0) {
        return { noTargets: true };
    }

    const results = [];
    const allRolls = [];
    let totalHealed = 0;
    const healCtx = { playerStats, campaignName, casterName, healExpression, bonusHeal, bonusDetails, maximize };

    for (const target of targets) {
        const result = healMassTarget(combatSummary, target, healCtx);
        if (!result) continue;
        results.push(result);
        allRolls.push(...result.rolls);
        totalHealed += result.healAmount;
    }

    if (results.some(r => r.healAmount > 0) && bonusDetails?.some(d => d.name === 'Fortified Health')) {
        await markFortifiedHealthUsed(playerStats, campaignName);
    }

    await maybeTriggerBlessedHealer({ spell, results, casterName, playerStats, slotLevel, campaignName, mapName: _mapName });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targets: results, formula: healExpression, totalHealed, rolls: allRolls, rawTotal: results.reduce((sum, r) => sum + r.rawTotal, 0) };
}
