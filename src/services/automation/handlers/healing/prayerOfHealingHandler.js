import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization } from '../../../combat/automation/automationService.js';

const PRAYER_OF_HEALING_NAME = 'Prayer of Healing';

function getHealExpression(spell) {
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (healAtSlotLevel) {
        const slotLevel = Object.keys(healAtSlotLevel)
            .map(Number)
            .sort((a, b) => a - b)
            .filter(l => l >= spell.level)
            .shift();
        if (slotLevel && healAtSlotLevel[slotLevel]) {
            return healAtSlotLevel[slotLevel];
        }
        const keys = Object.keys(healAtSlotLevel);
        if (keys.length > 0) {
            return healAtSlotLevel[keys[0]];
        }
    }
    return '2d8';
}

function getAffectedKey(targetName) {
    return `prayerOfHealing_lastUsedRound_${targetName}`;
}

function isAffectedByPrayerOfHealing(targetName, campaignName, currentRound) {
    const usedRound = getRuntimeValue(targetName, getAffectedKey(targetName), campaignName);
    if (!usedRound) return false;
    return usedRound === currentRound;
}

function markPrayerOfHealingUsed(targetName, campaignName, currentRound) {
    setRuntimeValue(targetName, getAffectedKey(targetName), currentRound, campaignName);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxTargets = auto?.maxTargets || 5;
    const rangeFt = auto?.range ? await import('../../../rules/combat/rangeValidation.js').then(m => m.rangeToFeet(auto.range)) : 30;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return null;

    const currentRound = combatSummary?.round || 1;
    const healExpression = getHealExpression(action.spell);
    const maximize = hasHealingMaximization(playerStats);
    const result = maximize ? rollExpression(healExpression) : rollExpression(healExpression);
    if (!result) return null;

    const { totalBonus: bonusHeal } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, 1);
    const healAmount = result.total + bonusHeal;

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
            payload: { type: 'automation_info', name: PRAYER_OF_HEALING_NAME, description: `${PRAYER_OF_HEALING_NAME}: No allies within range.` },
        };
    }

    if (eligible.length <= maxTargets) {
        return confirmPrayerOfHealing(action, playerStats, campaignName, eligible.map(c => c.name), healAmount, healExpression, result.rolls, bonusHeal, currentRound);
    }

    const creatureTargets = eligible.map(c => ({ name: c.name, type: c.type, currentHp: c.currentHp, maxHp: c.maxHp }));

    return {
        type: 'modal',
        modalName: 'prayerOfHealingTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            maxTargets,
            healAmount,
            healExpression,
            rolls: result.rolls,
            bonusHeal,
            currentRound,
        },
    };
}

export async function confirmPrayerOfHealing(action, playerStats, campaignName, selectedTargetNames, healAmount, healExpression, rolls, bonusHeal, currentRound) {
    const playerName = playerStats.name;
    const maxTargets = action.automation?.maxTargets || 5;
    const finalTargets = selectedTargetNames.slice(0, maxTargets);
    const combatSummary = await getCombatContext(campaignName);
    const results = [];

    for (const targetName of finalTargets) {
        if (isAffectedByPrayerOfHealing(targetName, campaignName, currentRound)) {
            continue;
        }

        const maxHp = combatSummary?.creatures?.find(c => c.name === targetName)?.maxHp || playerStats.hitPoints || 0;
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
        const actualHeal = Math.min(healAmount, maxHp - currentHp);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
            markPrayerOfHealingUsed(targetName, campaignName, currentRound);
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
            note: PRAYER_OF_HEALING_NAME,
            formula: healExpression,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[prayerOfHealing] Error:', e); });

        await addEntry(campaignName, {
            type: 'prayer_of_healing',
            targetName,
            casterName: playerName,
            isAffected: true,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[prayerOfHealing] Error:', e); });

        results.push({ targetName, healAmount: actualHeal });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const totalHealed = results.reduce((sum, r) => sum + r.healAmount, 0);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: PRAYER_OF_HEALING_NAME,
            automationType: action.automation.type,
            description: `${PRAYER_OF_HEALING_NAME} healed ${totalHealed} HP across ${results.length} target(s): ${finalTargets.join(', ') || 'none'}.`,
        },
    };
}
