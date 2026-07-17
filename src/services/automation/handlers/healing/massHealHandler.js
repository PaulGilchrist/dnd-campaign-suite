import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { resolveHealingBonusesWithDetails } from '../../../combat/automation/automationService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

const MASS_HEAL_NAME = 'Mass Heal';
const CONDITIONS_TO_REMOVE = ['blinded', 'deafened', 'poisoned'];

async function removeConditionsOnTarget(targetName, campaignName, spell, reason) {
    const conditionsToRemove = (spell.status_effects && spell.status_effects.length > 0)
        ? spell.status_effects.map(e => e.toLowerCase())
        : CONDITIONS_TO_REMOVE;
    if (conditionsToRemove.length === 0) return;

    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));

    if (newConditions.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
        for (const removed of conditionsToRemove) {
            if (!newConditions.some(c => String(c).toLowerCase() === removed)) {
                await addEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                    reason,
                    timestamp: Date.now(),
                }).catch((e) => { console.error('[massHeal] Error:', e); });
            }
        }
    }
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxTargets = auto?.maxTargets || 10;
    const rangeFt = auto?.range ? rangeToFeet(auto.range) : 60;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return null;

    const slotLevel = auto?.slotLevel || action.spell?.level || 9;
    const healAtSlotLevel = action.spell?.heal_at_slot_level;
    let totalPool = 700;
    if (healAtSlotLevel) {
        const expression = healAtSlotLevel[slotLevel] || healAtSlotLevel[Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b).pop()];
        if (expression && expression !== 'max') {
            const parsed = parseInt(expression, 10);
            if (!Number.isNaN(parsed)) totalPool = parsed;
        }
    }

    const { totalBonus: bonusHeal } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel);
    void (totalPool + (bonusHeal > 0 ? bonusHeal * maxTargets : 0));

    const allyNames = getAllyList(playerName);
    const eligible = [];

    for (const allyName of allyNames) {
        if (allyName === playerName) continue;
        const creature = combatSummary.creatures?.find(c => c.name === allyName);
        if (!creature) continue;
        if (await isWithinRange(playerName, allyName, rangeFt)) {
            eligible.push(creature);
        }
    }

    if (eligible.length === 0) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: MASS_HEAL_NAME, description: `${MASS_HEAL_NAME}: No allies within range.` },
        };
    }

    if (eligible.length <= maxTargets) {
        return confirmMassHeal(action, playerStats, campaignName, eligible.map(c => c.name), totalPool, bonusHeal);
    }

    const creatureTargets = eligible.map(c => ({ name: c.name, type: c.type, currentHp: c.currentHp, maxHp: c.maxHp }));

    return {
        type: 'modal',
        modalName: 'massHealTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            maxTargets,
            totalPool,
            bonusHeal,
        },
    };
}

export async function confirmMassHeal(action, playerStats, campaignName, selectedTargetNames, totalPool, bonusHeal) {
    const playerName = playerStats.name;
    const maxTargets = action.automation?.maxTargets || 10;
    const finalTargets = selectedTargetNames.slice(0, maxTargets);
    const combatSummary = await getCombatContext(campaignName);
    let remainingPool = totalPool + (bonusHeal > 0 ? bonusHeal * finalTargets.length : 0);
    const results = [];

    for (const targetName of finalTargets) {
        const maxHp = combatSummary?.creatures?.find(c => c.name === targetName)?.maxHp || playerStats.hitPoints || 0;
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
        const healAmount = Math.min(totalPool - (totalPool - remainingPool) + bonusHeal, maxHp - currentHp);
        const actualHeal = Math.min(healAmount, remainingPool);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
            remainingPool -= actualHeal;
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
            note: MASS_HEAL_NAME,
            formula: `${totalPool}${bonusHeal > 0 ? ' + bonus' : ''}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[massHeal] Error:', e); });

        await removeConditionsOnTarget(targetName, campaignName, action.spell, MASS_HEAL_NAME);

        results.push({ targetName, healAmount: actualHeal });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const totalHealed = results.reduce((sum, r) => sum + r.healAmount, 0);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: MASS_HEAL_NAME,
            automationType: action.automation.type,
            description: `${MASS_HEAL_NAME} healed ${totalHealed} HP across ${results.length} target(s): ${finalTargets.join(', ') || 'none'}.`,
        },
    };
}
