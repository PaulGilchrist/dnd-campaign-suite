import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization, hasHealingMaximizationForTarget } from '../../../combat/automation/automationService.js';
import { triggerPostCastSelfHeals } from '../../../rules/spells/postCastHealService.js';
import { isAffectedByPrayerOfHealing, refusePrayerOfHealingTarget, applyPrayerOfHealingShortRestBenefit, finalizePrayerPostCast } from './prayerOfHealingLatch.js';

export function getSpellCastingMod(playerStats, spell) {
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

export function resolveHealExpression(spell, slotLevel, spellCastingMod) {
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (!healAtSlotLevel) return null;

    let expression = healAtSlotLevel[slotLevel];
    if (!expression) {
        const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
        const highestBelow = levels.filter(l => l <= slotLevel).pop();
        if (highestBelow) {
            expression = healAtSlotLevel[highestBelow];
        }
    }
    if (!expression) return null;

    if (spellCastingMod !== null && spellCastingMod !== undefined) {
        expression = expression.replace(/\bMOD\b/g, String(spellCastingMod));
    }
    return expression;
}

export function createMassHealHandler(config) {
    const {
        spellName,
        defaultSlotLevel,
        defaultMaxTargets,
        modalName,
        logPrefix,
        emptyMessage = 'No allies within range.',
        oncePerLongRest = false,
        defaultMaxTargets5e = null,
    } = config;

    // SP-091: the once-per-Long-Rest latch + short-rest benefit clauses are
    // 2024 canonical ("gain the benefits of a Short Rest ... until that creature
    // finishes a Long Rest"). The 5e twin ("up to six creatures ... regain 2d8 +
    // MOD") has neither clause — latch/SR benefit stay byte-inert for 5e casts.
    function enforcementEnabled(playerStats) {
        return oncePerLongRest && playerStats.rules === '2024';
    }

    function resolveMaxTargets(auto, playerStats) {
        if (auto?.maxTargets) return auto.maxTargets;
        if (defaultMaxTargets5e != null && playerStats?.rules !== '2024') return defaultMaxTargets5e;
        return defaultMaxTargets;
    }

    function resolveSlotLevel(auto, action) {
        return auto?.slotLevel || action.spell?.level || defaultSlotLevel;
    }

    async function handle(action, playerStats, campaignName, _mapName) {
        const auto = action.automation;
        const slotLevel = resolveSlotLevel(auto, action);
        const maxTargets = resolveMaxTargets(auto, playerStats);

        const spellCastingMod = getSpellCastingMod(playerStats, action.spell);
        const healExpression = resolveHealExpression(action.spell, slotLevel, spellCastingMod);
        if (!healExpression) {
            return {
                type: 'popup',
                payload: { type: 'automation_info', name: spellName, description: `${spellName}: Could not resolve heal expression.` },
            };
        }

        const maximize = hasHealingMaximization(playerStats);
        const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, { prof: playerStats.proficiency || 0, level: playerStats.level || 1, slotLevel, campaignName });

        const combatSummary = await getCombatContext(campaignName);
        if (!combatSummary) return null;

        const enforcement = enforcementEnabled(playerStats);
        const currentRound = enforcement ? (combatSummary?.round || 1) : undefined;

        const allCreatures = combatSummary.creatures || [];
        const eligible = allCreatures.filter(c => c.name);

        if (eligible.length === 0) {
            return {
                type: 'popup',
                payload: { type: 'automation_info', name: spellName, description: `${spellName}: ${emptyMessage}` },
            };
        }

        if (eligible.length <= maxTargets) {
            return confirmFn({ action, playerStats, campaignName, selectedTargetNames: eligible.map(c => c.name), healExpression, maximize, bonusHeal, bonusDetails, slotLevel, currentRound });
        }

        const creatureTargets = eligible.map(c => c.name);

        return {
            type: 'modal',
            modalName,
            payload: {
                action,
                playerStats,
                campaignName,
                creatureTargets,
                maxTargets,
                healExpression,
                maximize,
                bonusHeal,
                bonusDetails,
                slotLevel,
                ...(enforcement && { currentRound }),
            },
        };
    }

    async function healMassTarget(targetName, ctx) {
        const { combatSummary, playerStats, healExpression, maximize, bonusHeal, bonusDetails, playerName, campaignName, enforcement, roundStamp } = ctx;
        const maxHp = resolveTargetMaxHp(combatSummary, playerStats, targetName, campaignName);
        const currentHp = resolveStoredCurrentHp(targetName, campaignName, maxHp);
        const rollResult = rollMassHealDice(healExpression, maximize, playerStats, targetName, campaignName);
        if (!rollResult) return null;

        const targetHealAmount = rollResult.total + bonusHeal;
        const actualHeal = Math.min(targetHealAmount, maxHp - currentHp);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
        }

        // SP-091 short-rest benefit: an affected creature gains the benefit
        // even when the roll is clamped to zero at max HP — the spell still
        // affects it. Latch + short-rest re-arm keys land in ONE merged
        // write per target (§5 single-write rule).
        if (enforcement) {
            await applyPrayerOfHealingShortRestBenefit(targetName, playerName, campaignName, roundStamp);
        }

        const newHp = Math.min(maxHp, currentHp + actualHeal);

        await addEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: actualHeal,
            currentHp: newHp,
            maxHp,
            isHealing: true,
            sourceName: playerName,
            note: spellName,
            formula: buildHealFormula(healExpression, bonusDetails),
            bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
            timestamp: Date.now(),
        }).catch((e) => { console.error(`[${logPrefix}] Error:`, e); });

        return { targetName, healAmount: actualHeal, rolls: rollResult.rolls, rawTotal: targetHealAmount };
    }

    async function confirmFn({ action, playerStats, campaignName, selectedTargetNames, healExpression, maximize, bonusHeal, bonusDetails, slotLevel, currentRound }) {
        const playerName = playerStats.name;
        const maxTargets = resolveMaxTargets(action.automation, playerStats);
        const finalTargets = selectedTargetNames.slice(0, maxTargets);
        const enforcement = enforcementEnabled(playerStats);
        const roundStamp = enforcement ? (currentRound || (await getCombatContext(campaignName))?.round || 1) : undefined;
        const combatSummary = await getCombatContext(campaignName);
        const ctx = { combatSummary, playerStats, healExpression, maximize, bonusHeal, bonusDetails, playerName, campaignName, enforcement, roundStamp };
        const results = [];
        const refused = [];
        const allRolls = [];
        let totalHealed = 0;

        for (const targetName of finalTargets) {
            // SP-091 once-per-Long-Rest latch: already-affected 2024 targets are
            // refused with a visible popup + prayer_of_healing_refused log, zero
            // heal / zero short-rest benefit / zero latch mutation.
            if (enforcement && isAffectedByPrayerOfHealing(targetName, campaignName)) {
                refused.push(targetName);
                await refusePrayerOfHealingTarget(targetName, playerName, campaignName);
                continue;
            }

            const result = await healMassTarget(targetName, ctx);
            if (!result) continue;
            results.push(result);
            allRolls.push(...result.rolls);
            totalHealed += result.healAmount;
        }

        await finalizePrayerPostCast({ playerStats, results, bonusDetails, campaignName, enforcement });

        if (results.length === 0 && refused.length > 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: spellName,
                    description: `${spellName}: no effect — ${refused.join(', ')} ${refused.length === 1 ? 'is' : 'are'} already affected by ${spellName} and can't be affected again until ${refused.length === 1 ? 'they finish' : 'they all finish'} a Long Rest.`,
                },
            };
        }

        // CLA-038: mass heals restore HP to creatures other than the caster,
        // so post-cast self-heal passives (e.g. Blessed Healer) must fire here.
        if (results.some(r => r.healAmount > 0 && r.targetName !== playerName)) {
            const metaCtx = { slotLevel, targetNames: results.map(r => r.targetName) };
            await triggerPostCastSelfHeals(action.spell, metaCtx, playerStats, campaignName, undefined).catch(e => {
                console.error('[massHealUtils] Post-cast self-heal failed:', e);
            });
        }

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        return {
            type: 'popup',
            payload: {
                type: 'heal_multi',
                name: spellName,
                formula: healExpression,
                rolls: allRolls,
                results: results.map(r => ({ targetName: r.targetName, healAmount: r.healAmount, rolls: r.rolls })),
                totalHealed: totalHealed,
                bonusHeal: bonusHeal || 0,
                bonusHealDetail: joinBonusDetails(bonusDetails, ', '),
            },
        };
    }

    return { handle, confirmFn };
}

// PC combatSummary entries are 1/1 placeholders (campaign-select re-seed); player max HP
// truth is the runtime 'hitPoints' key — mirror MassHealModal.jsx / hpModifier.js.
function resolveTargetMaxHp(combatSummary, playerStats, targetName, campaignName) {
    const creature = combatSummary?.creatures?.find(c => c.name === targetName);
    if (creature && creature.type !== 'player') return creature.maxHp || playerStats.hitPoints || 0;
    const storedMax = getRuntimeValue(targetName, 'hitPoints', campaignName);
    if (storedMax != null && storedMax !== '') return Number(storedMax);
    return (creature && creature.maxHp) || playerStats.hitPoints || 0;
}

function resolveStoredCurrentHp(targetName, campaignName, fallbackMaxHp) {
    const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    return storedHp != null && storedHp !== '' ? Number(storedHp) : fallbackMaxHp;
}

function rollMassHealDice(healExpression, maximize, playerStats, targetName, campaignName) {
    if (maximize || hasHealingMaximizationForTarget(playerStats, targetName, campaignName)) return rollExpressionMaximized(healExpression);
    return rollExpression(healExpression);
}

function joinBonusDetails(bonusDetails, separator) {
    return bonusDetails && bonusDetails.length > 0 ? bonusDetails.map(d => `${d.amount} ${d.name}`).join(separator) : '';
}

function buildHealFormula(healExpression, bonusDetails) {
    const joinedBonuses = joinBonusDetails(bonusDetails, ' + ');
    return joinedBonuses ? `${healExpression} + (${joinedBonuses})` : healExpression;
}
