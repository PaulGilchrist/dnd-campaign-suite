import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { resolveHealingBonusesWithDetails, markFortifiedHealthUsed } from '../../../combat/automation/automationService.js';
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

function resolveTotalHealPool(action, slotLevel) {
    const healAtSlotLevel = action.spell?.heal_at_slot_level;
    if (!healAtSlotLevel) return 700;
    const expression = healAtSlotLevel[slotLevel] || healAtSlotLevel[Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b).pop()];
    if (!expression || expression === 'max') return 700;
    const parsed = parseInt(expression, 10);
    return Number.isNaN(parsed) ? 700 : parsed;
}

async function collectAlliesInRange(combatSummary, playerName, rangeFt) {
    const allyNames = getAllyList(playerName);
    const allyList = Array.isArray(allyNames) && allyNames.length > 0 ? allyNames : [];
    const effectiveAllies = allyList.length > 1 || (allyList.length === 1 && allyList[0] !== playerName)
        ? allyList
        : combatSummary.creatures?.map(c => c.name) || [];

    const eligible = [];
    for (const allyName of effectiveAllies) {
        const creature = combatSummary.creatures?.find(c => c.name === allyName);
        if (!creature) continue;
        if (await isWithinRange(playerName, allyName, rangeFt)) {
            eligible.push(creature);
        }
    }
    return eligible;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxTargets = auto?.maxTargets || 10;
    const rangeFt = auto?.range ? rangeToFeet(auto.range) : rangeToFeet(action.spell?.range || '60 feet');

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return null;

    const slotLevel = auto?.slotLevel || action.spell?.level || 9;
    const totalPool = resolveTotalHealPool(action, slotLevel);

    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);
    void (totalPool + (bonusHeal > 0 ? bonusHeal * maxTargets : 0));

    const eligible = await collectAlliesInRange(combatSummary, playerName, rangeFt);

    if (eligible.length === 0) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: MASS_HEAL_NAME, description: `${MASS_HEAL_NAME}: No allies within range.` },
        };
    }

    const creatureTargets = eligible.map(c => c.name);

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
            bonusDetails,
            combatSummary,
        },
    };
}

export async function confirmMassHeal({ action, playerStats, campaignName, distribution, totalPool, bonusHeal: _bonusHeal, bonusDetails }) {
    const playerName = playerStats.name;
    const combatSummary = await getCombatContext(campaignName);
    const results = [];

    for (const [targetName, userAmount] of Object.entries(distribution)) {
        const maxHp = combatSummary?.creatures?.find(c => c.name === targetName)?.maxHp || playerStats.hitPoints || 0;
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
        const missingHp = maxHp - currentHp;
        const actualHeal = Math.min(userAmount, missingHp, totalPool);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
            totalPool -= actualHeal;
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
            formula: `${Object.keys(distribution).length} targets`,
            bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[massHeal] Error:', e); });

        await removeConditionsOnTarget(targetName, campaignName, action.spell, MASS_HEAL_NAME);

        results.push({ targetName, healAmount: actualHeal });
    }

    if (results.some(r => r.healAmount > 0) && bonusDetails?.some(d => d.name === 'Fortified Health')) {
        await markFortifiedHealthUsed(playerStats, campaignName);
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const totalHealed = results.reduce((sum, r) => sum + r.healAmount, 0);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: MASS_HEAL_NAME,
            automationType: action.automation.type,
            description: `${MASS_HEAL_NAME} healed ${totalHealed} HP across ${results.length} target(s): ${Object.keys(distribution).join(', ') || 'none'}.`,
        },
    };
}
