import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { hasHealingMaximization } from '../../combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';
import { addEntry } from '../../ui/logService.js';


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

         const result = applyHealingToTarget(cs, targetName, healAmount, campaignName);
         if (result) {
              addEntry(campaignName, {
                  type: 'hp_change',
                  targetName,
                  delta: result.delta,
                  currentHp: result.newHp,
                  maxHp: result.maxHp,
                  isHealing: true,
                  isUnconscious: false,
              }).catch((e) => { console.error("[healingRoll] Error:", e); });
         }
      });

    return { healAmount, formula, rolls: result.rolls };
}

export function applyHealingDirectly(playerStats, targetName, amount, campaignName, targetMaxHp) {
    const maxHp = targetMaxHp ?? playerStats.hitPoints;

    const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;

    const newHp = Math.min(maxHp, currentHp + amount);
    const actualHeal = newHp - currentHp;

    setRuntimeValue(targetName, 'currentHitPoints', newHp, campaignName);

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { maxHp, newHp, actualHeal };
}

export function logHealingToSSE(campaignName, info) {
    const { targetName, sourceName, actualHeal, newHp, maxHp, rollInfo, maximize, healingName, remainingUses, skipPopup } = info;
    addEntry(campaignName, {
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
      }).catch((e) => { console.error("[healingRoll] Error:", e); });

    if (healingName && !skipPopup) {
        const healDesc = actualHeal > 0
            ? `Regained ${actualHeal} HP`
            : 'Already at full HP';
        const maximizeNote = maximize ? ' (dice maximized by Supreme Healing)' : '';
        const popupText = `${healingName} on ${targetName}: ${rollInfo}${maximizeNote} — ${healDesc}${remainingUses !== undefined ? (remainingUses > 0 ? ` (${remainingUses} use${remainingUses > 1 ? 's' : ''} remaining)` : ' (no uses remaining)') : ''}`;

        window.dispatchEvent(new CustomEvent('healing-popup', {
            detail: {
                targetName,
                sourceName,
                healingName,
                rollInfo: rollInfo || null,
                maximizeHealingDice: maximize || false,
                popupText,
            },
        }));
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}
