import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization, hasHealingMaximizationForTarget, markFortifiedHealthUsed } from '../../../combat/automation/automationService.js';

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
        useCurrentRound = false,
    } = config;

    async function handle(action, playerStats, campaignName, _mapName) {
        const auto = action.automation;
        const slotLevel = auto?.slotLevel || action.spell?.level || defaultSlotLevel;
        const maxTargets = auto?.maxTargets || defaultMaxTargets;

        const spellCastingMod = getSpellCastingMod(playerStats, action.spell);
        const healExpression = resolveHealExpression(action.spell, slotLevel, spellCastingMod);
        if (!healExpression) {
            return {
                type: 'popup',
                payload: { type: 'automation_info', name: spellName, description: `${spellName}: Could not resolve heal expression.` },
            };
        }

        const maximize = hasHealingMaximization(playerStats);
        const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);

        const combatSummary = await getCombatContext(campaignName);
        if (!combatSummary) return null;

        const currentRound = useCurrentRound ? (combatSummary?.round || 1) : undefined;

        const allCreatures = combatSummary.creatures || [];
        const eligible = allCreatures.filter(c => c.name);

        if (eligible.length === 0) {
            return {
                type: 'popup',
                payload: { type: 'automation_info', name: spellName, description: `${spellName}: ${emptyMessage}` },
            };
        }

        if (eligible.length <= maxTargets) {
            return confirmFn(action, playerStats, campaignName, eligible.map(c => c.name), healExpression, maximize, bonusHeal, bonusDetails, slotLevel, currentRound);
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
                ...(useCurrentRound && { currentRound }),
            },
        };
    }

    async function confirmFn(action, playerStats, campaignName, selectedTargetNames, healExpression, maximize, bonusHeal, bonusDetails, _slotLevel, currentRound) {
        const playerName = playerStats.name;
        const maxTargets = action.automation?.maxTargets || defaultMaxTargets;
        const finalTargets = selectedTargetNames.slice(0, maxTargets);
        const combatSummary = await getCombatContext(campaignName);
        const results = [];
        const allRolls = [];
        let totalHealed = 0;

        for (const targetName of finalTargets) {
            if (alreadyHealedThisRound(targetName, campaignName, currentRound, useCurrentRound)) continue;

            const maxHp = resolveTargetMaxHp(combatSummary, playerStats, targetName);
            const currentHp = resolveStoredCurrentHp(targetName, campaignName, maxHp);
            const rollResult = rollMassHealDice(healExpression, maximize, playerStats, targetName, campaignName);
            if (!rollResult) continue;

            const targetHealAmount = rollResult.total + bonusHeal;
            const actualHeal = Math.min(targetHealAmount, maxHp - currentHp);

            if (actualHeal > 0) {
                applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
                stampHealedThisRound(targetName, campaignName, currentRound, useCurrentRound);
            }

            const newHp = Math.min(maxHp, currentHp + actualHeal);

            const joinedBonuses = joinBonusDetails(bonusDetails, ' + ');
            const formulaParts = [healExpression];
            if (joinedBonuses) {
                formulaParts.push(`(${joinedBonuses})`);
            }

            await addEntry(campaignName, {
                type: 'hp_change',
                targetName,
                delta: actualHeal,
                currentHp: newHp,
                maxHp,
                isHealing: true,
                sourceName: playerName,
                note: spellName,
                formula: formulaParts.join(' + '),
                bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
                timestamp: Date.now(),
            }).catch((e) => { console.error(`[${logPrefix}] Error:`, e); });

            results.push({ targetName, healAmount: actualHeal, rolls: rollResult.rolls, rawTotal: rollResult.total + bonusHeal });
            allRolls.push(...rollResult.rolls);
            totalHealed += actualHeal;
        }

        if (results.some(r => r.healAmount > 0) && bonusDetails?.some(d => d.name === 'Fortified Health')) {
            await markFortifiedHealthUsed(playerStats, campaignName);
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

function alreadyHealedThisRound(targetName, campaignName, currentRound, useCurrentRound) {
    if (!useCurrentRound) return false;
    const usedRound = getRuntimeValue(targetName, `prayerOfHealing_lastUsedRound_${targetName}`, campaignName);
    return Boolean(usedRound && usedRound === currentRound);
}

function stampHealedThisRound(targetName, campaignName, currentRound, useCurrentRound) {
    if (!useCurrentRound) return;
    setRuntimeValue(targetName, `prayerOfHealing_lastUsedRound_${targetName}`, currentRound, campaignName);
}

function resolveTargetMaxHp(combatSummary, playerStats, targetName) {
    return combatSummary?.creatures?.find(c => c.name === targetName)?.maxHp || playerStats.hitPoints || 0;
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
