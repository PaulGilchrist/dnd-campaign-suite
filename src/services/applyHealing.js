
import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';
import storage from './storage.js';

export function applyHealingToTarget(combatSummary, targetName, healAmount, campaignName) {
    if (!combatSummary) return null;
    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) return null;

    const isPlayer = creature.type === 'player';
     const maxHp = isPlayer
         ? (getRuntimeValue(creature.name, 'hitPoints') ?? creature.maxHp)
         : creature.maxHp;
     let oldHp, newHp, actualHeal;

    if (isPlayer) {
        oldHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? 0;
        newHp = Math.min(maxHp, oldHp + healAmount);
        actualHeal = newHp - oldHp;
        setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
        if (oldHp <= 0 && newHp > 0) {
            setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
            setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
        }
    } else {
        oldHp = creature.currentHp;
        newHp = Math.min(maxHp, oldHp + healAmount);
        actualHeal = newHp - oldHp;
        creature.currentHp = newHp;
        storage.set('combatSummary', combatSummary, campaignName);
    }

    const entry = {
        type: 'hp_change',
        targetName: creature.name,
        delta: actualHeal,
        currentHp: newHp,
        maxHp: maxHp,
        isHealing: true,
        isUnconscious: false,
    };

    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
    }).catch(() => {});

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { actualHeal, oldHp, newHp };
}
