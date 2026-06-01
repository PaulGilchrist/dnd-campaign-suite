
import storage from './storage.js';

export function applyHealingToTarget(combatSummary, targetName, healAmount, campaignName) {
    if (!combatSummary) return null;
    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) return null;

    const oldHp = creature.currentHp;
    const newHp = Math.min(creature.maxHp, oldHp + healAmount);
    const actualHeal = newHp - oldHp;
    creature.currentHp = newHp;

    storage.set('combatSummary', combatSummary, campaignName);

    const entry = {
        type: 'hp_change',
        targetName: creature.name,
        delta: actualHeal,
        currentHp: newHp,
        maxHp: creature.maxHp,
        isHealing: true,
        isUnconscious: false,
    };

    if (creature.type === 'player') {
        storage.setProperty(creature.name, 'currentHitPoints', newHp, campaignName);
        if (oldHp <= 0 && newHp > 0) {
            storage.setProperty(creature.name, 'deathSaves', [false, false, false], campaignName);
            storage.setProperty(creature.name, 'deathFailures', [false, false, false], campaignName);
        }
    }

    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
    }).catch(() => {});

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { actualHeal, oldHp, newHp };
}
