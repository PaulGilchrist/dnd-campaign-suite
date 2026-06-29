import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { hasHealingMaximization } from '../../combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';
import { postLogEntry } from '../../shared/logPoster.js';

export function rollHealingForAction(auto, playerStats, campaignName, isSelf = false) {
    const formula = auto.healExpression || '';
    if (!formula) return Promise.resolve(null);

    const maximize = hasHealingMaximization(playerStats);
    const result = maximize ? rollExpressionMaximized(formula) : rollExpression(formula);
    if (!result) return Promise.resolve(null);

    const healAmount = result.total;

    getCombatContext(campaignName).then(cs => {
        let targetName;
        if (isSelf) {
            targetName = playerStats.name;
          } else {
            const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
            targetName = target ? target.name : playerStats.name;
         }

        applyHealingToTarget(cs, targetName, healAmount, playerStats, campaignName);
     });

    return { healAmount, formula, rolls: result.rolls };
}

export function applyHealingDirectly(playerStats, targetName, amount, campaignName) {
    const maxHp = playerStats.hitPoints;

    const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;

    const newHp = Math.min(maxHp, currentHp + amount);
    const actualHeal = newHp - currentHp;

    setRuntimeValue(targetName, 'currentHitPoints', newHp, campaignName);

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { maxHp, newHp, actualHeal };
}

export function logHealingToSSE(campaignName, info) {
    const { targetName, sourceName, actualHeal, newHp, maxHp, rollInfo, maximize, healingName, remainingUses } = info;
    postLogEntry(campaignName, {
        type: 'hp_change',
        targetName,
        sourceName,
        delta: actualHeal,
        currentHp: newHp,
        maxHp,
        isHealing: true,
        isUnconscious: false,
        rollInfo: rollInfo || null,
        maximizeHealingDice: maximize || false,
      }).catch(() => {});

    if (healingName) {
        const healDesc = actualHeal > 0
            ? `Regained ${actualHeal} HP`
            : 'Already at full HP';
        const maximizeNote = maximize ? ' (dice maximized by Supreme Healing)' : '';
        const popupText = `${healingName} on ${targetName}: ${rollInfo}${maximizeNote} — ${healDesc}${remainingUses !== undefined ? (remainingUses > 0 ? ` (${remainingUses} use${remainingUses > 1 ? 's' : ''} remaining)` : ' (no uses remaining)') : ''}`;

        postLogEntry(campaignName, {
            type: 'healing',
            targetName,
            sourceName,
            healingName,
            rollInfo: rollInfo || null,
            maximizeHealingDice: maximize || false,
            popupText,
          }).catch(() => {});
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}
