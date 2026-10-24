import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { resolveHealingBonusesWithDetails } from '../../combat/automation/automationService.js';

const HEAL_NAME = 'Heal';
// fix#349 #1372: the remove-list is DISK-driven per ruleset, never hardcoded
// for both. 2024 'Heal' (public/data/2024/spells.json BY-name) carries
// status_effects ["Blinded","Deafened","Poisoned"] and flows through
// getConditionsToRemove's disk read below (:15-17 of this file). The 5e disk
// row (public/data/spells.json 'Heal') carries NO status_effects key, so it
// reaches this fallback; its prose BYTES read: "This spell also ends
// blindness, deafness, and any diseases affecting the target." — encoded
// exactly: blinded/deafened/diseased. Poisoned is 2024-only wording: 5e Heal
// NEVER clears Poisoned (the old trio here was the #1372 defect), and it
// always should have cleared Diseased (it never did).
const CONDITIONS_TO_REMOVE_5E = ['blinded', 'deafened', 'diseased'];

function isHealSpell(spell) {
    return (spell.name || '') === HEAL_NAME;
}

function getConditionsToRemove(spell) {
    if (spell.status_effects && spell.status_effects.length > 0) {
        return spell.status_effects.map(e => e.toLowerCase());
    }
    // No status_effects key ⇒ this is the 5e disk-row shape; the disk prose
    // set above is the only lawful list (fix#349).
    return CONDITIONS_TO_REMOVE_5E;
}

function removeConditionsOnTarget(targetName, campaignName, spell, reason) {
    const conditionsToRemove = getConditionsToRemove(spell);
    if (conditionsToRemove.length === 0) return [];

    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const removedConditions = conditions.filter(c => conditionsToRemove.includes(String(c).toLowerCase()));
    const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));

    if (newConditions.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
        // fix#337S #1372: log ONLY conditions the target actually had —
        // the old loop over conditionsToRemove phantom-logged names that
        // were never stored (popup lane at triggerHeal already told the truth).
        const actuallyRemoved = conditionsToRemove.filter(r => conditions.some(c => String(c).toLowerCase() === r));
        for (const removed of actuallyRemoved) {
            addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                reason,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[heal] Error removing condition:", e); });
        }
    }

    return removedConditions;
}

function resolveHealBaseAmount(spell, slotLevel) {
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (!healAtSlotLevel) return 70;
    const expression = healAtSlotLevel[slotLevel] || healAtSlotLevel[Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b).pop()];
    if (!expression) return 70;
    const parsed = parseInt(expression, 10);
    if (Number.isNaN(parsed)) {
        console.error('[heal] triggerHeal: heal_at_slot_level expression is not a valid number:', expression);
        throw new Error('heal_at_slot_level expression must be a valid number for heal spell');
    }
    return parsed;
}

function resolveTargetHpBounds(targetName, creature, campaignName) {
    const isPlayer = creature.type === 'player';
    const maxHp = isPlayer
        ? (getRuntimeValue(targetName, 'hitPoints', campaignName) ?? creature.maxHp)
        : creature.maxHp;
    const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    const currentHp = isPlayer
        ? (storedHp != null && storedHp !== '' ? Number(storedHp) : (creature.currentHp ?? maxHp))
        : (creature.currentHp ?? maxHp);
    return { maxHp, currentHp };
}

function logHealEntry({ campaignName, spell, targetName, casterName, actualHeal, maxHp, currentHp, healAmount, bonusHeal, bonusDetails }) {
    const formulaParts = [spell.heal_at_slot_level ? `${spell.heal_at_slot_level[spell.level || 6] || '70'}` : `${healAmount - bonusHeal}`];
    if (bonusDetails.length > 0) {
        const bonusParts = bonusDetails.map(d => `${d.amount} ${d.name}`).join(' + ');
        formulaParts.push(`(${bonusParts})`);
    }
    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: actualHeal,
        currentHp: Math.min(maxHp, currentHp + actualHeal),
        maxHp,
        isHealing: true,
        sourceName: casterName,
        note: spell.name,
        formula: formulaParts.join(' + '),
        bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[heal] Error logging heal:", e); });
}

export async function triggerHeal(spell, { targetName }, playerStats, campaignName, _mapName) {
    if (!isHealSpell(spell)) {
        return null;
    }

    if (!targetName) {
        return null;
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) {
        return null;
    }

    const casterName = playerStats.name;
    const slotLevel = spell.level || 6;
    const healAtSlotLevel = spell.heal_at_slot_level;
    const baseHeal = resolveHealBaseAmount(spell, slotLevel);

    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, { prof: playerStats.proficiency || 0, level: playerStats.level || 1, slotLevel, campaignName });
    const healAmount = baseHeal + bonusHeal;

    const { maxHp, currentHp } = resolveTargetHpBounds(targetName, creature, campaignName);
    const actualHeal = Math.max(0, Math.min(healAmount, maxHp - currentHp));

    if (actualHeal > 0) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
        logHealEntry({ campaignName, spell, targetName, casterName, actualHeal, maxHp, currentHp, healAmount, bonusHeal, bonusDetails });
    }

    const conditionsRemoved = removeConditionsOnTarget(targetName, campaignName, spell, 'Heal');
    const conditionText = conditionsRemoved.length > 0
        ? ` Also removed: ${conditionsRemoved.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}.`
        : '';

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    window.dispatchEvent(new CustomEvent('healing-popup', {
        detail: {
            targetName,
            sourceName: casterName,
            healingName: spell.name,
            rollInfo: '',
            maximizeHealingDice: false,
            popupText: `Heal on ${targetName}: ${actualHeal > 0 ? `Regained ${actualHeal} HP` : 'Already at full HP'}${conditionText}`,
        },
    }));

    return { targetName, healAmount: actualHeal, formula: healAtSlotLevel ? `${healAtSlotLevel[slotLevel] || '70'}` : '70', rolls: [], rawTotal: actualHeal, bonusHeal, bonusDetails };
}
