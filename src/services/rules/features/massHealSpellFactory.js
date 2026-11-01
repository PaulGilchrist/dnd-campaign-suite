// Shared trigger factory for the mass-heal spell-upcast family
// (#1384 Mass Cure Wounds / #1385 Mass Healing Word). Both services drive
// this module from thin config wrappers (massCureWoundsService.js,
// massHealingWordService.js) — behavior-neutral extraction of the twin
// logic; per-spell console/log prefixes and the CLA-038 post-cast self-heal
// leg are config, not forks. Mirrors the createMassHealHandler(config)
// idiom of automation/handlers/healing/massHealUtils.js, but stays in the
// spellCast-trigger lane: it must NOT import massHealUtils transitively,
// or the Mass Healing Word module graph would pull in postCastHealService
// (a boundary its strict-mock test suite deliberately keeps unimported).
import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { isWithinRange } from '../combat/rangeCheck.js';
import { rangeToFeet } from '../combat/rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization, hasHealingMaximizationForTarget, markFortifiedHealthUsed } from '../../combat/automation/automationService.js';

// Config shape:
//   spellName         — disk-canonical PascalCase name (name gate + log note)
//   defaultSlotLevel  — slot fallback when metaCtx/spell.level are falsy (5e disk level)
//   defaultMaxTargets — fallback for rows without automation.maxTargets; disk value wins
//   serviceTag        — '[…Service]' console prefix (requireCreatures, post-cast rider)
//   logTag            — '[…]' prefix for the floating addEntry rejection catch
//   postCastSelfHeal  — optional async ({ spell, results, casterName, playerStats,
//                       slotLevel, campaignName, mapName }) => void; CLA-038 rider.
//                       Omitted for lanes (Mass Healing Word) that must not own it.
export function createMassHealSpellTrigger(config) {
    const { spellName, defaultSlotLevel, defaultMaxTargets, serviceTag, logTag, postCastSelfHeal } = config;

    function isMassHealSpell(spell) {
        // fix#349 (#1384/#1385): the lowercase dispatch in triggerSpells.js
        // reaches this gate with any casing; strict equality silently nulled
        // case-drift casts. Fold BOTH sides (fix#109 precedent): the constant
        // stays disk-canonical PascalCase, the comparison is case-insensitive.
        return (spell.name || '').toLowerCase() === spellName.toLowerCase();
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

    // QUIRK pinned by both twin suites: ability found but bonus undefined →
    // MOD never substituted, dice receives the literal '…+ MOD' bytes.
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
            console.error(`${serviceTag} Missing array:`, x);
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

    // Shared quirks pinned by both suites: stored-HP `!= null && !== ''` guard
    // ('' / null mean full HP, numeric strings coerce via Number), heal-apply
    // strictly before log, delta-0 over-log for full-HP creatures, and
    // negative actualHeal (storedHp > maxHp) reaching log + totals unclamped.
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
            note: spellName,
            formula: buildHealFormula(healExpression, bonusDetails),
            bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
            timestamp: Date.now(),
        }).catch((e) => { console.error(`${logTag} Error:`, e); });

        return { targetName, healAmount: actualHeal, rolls: rollResult.rolls, rawTotal: rollResult.total + bonusHeal };
    }

    // #1384/#1385 selection law: candidates pass canonical isWithinRange(caster,
    // name, rangeToFeet(spell.range)) — disk '60 feet' enforced, no hardcoded
    // feet. Per-spell choice-clause verdicts (spells.json disk citations in the
    // wrappers) keep hostile creatures in the AoE RAW-legal, so affiliation is
    // deliberately unfiltered here; each spell's point-of-origin/visibility
    // selection lives upstream. maxTargets reads automation.maxTargets else the
    // config default. Lawful pool keeps combatSummary array order.
    async function selectLawfulTargets(spell, combatSummary, casterName) {
        const maxTargets = spell.automation?.maxTargets || defaultMaxTargets;
        const rangeFt = rangeToFeet(spell.range);
        const lawful = [];
        for (const creature of requireCreatures(combatSummary)) {
            if (await isWithinRange(casterName, creature.name, rangeFt)) {
                lawful.push(creature);
            }
        }
        return lawful.slice(0, maxTargets);
    }

    // Optional CLA-038 rider: Mass Cure Wounds passes Blessed Healer; the Mass
    // Healing Word lane omits the config key, so this resolves to nothing.
    // Isolated in a helper to keep the trigger's complexity unchanged.
    async function runPostCastSelfHeal(args) {
        await postCastSelfHeal?.(args);
    }

    return async function trigger(spell, metaCtx, playerStats, campaignName, _mapName) {
        if (!isMassHealSpell(spell)) {
            return null;
        }

        const slotLevel = metaCtx?.slotLevel || spell.level || defaultSlotLevel;
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

        await runPostCastSelfHeal({ spell, results, casterName, playerStats, slotLevel, campaignName, mapName: _mapName });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        return { targets: results, formula: healExpression, totalHealed, rolls: allRolls, rawTotal: results.reduce((sum, r) => sum + r.rawTotal, 0) };
    };
}
