import storage from '../../ui/storage.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

export function storeConditionEvent(campaignName, targetName, conditionKey) {
    return getCombatContext(campaignName).then(combatSummary => {
        if (!combatSummary) {
            console.error('[conditionEventStore] No combat summary found for campaign:', campaignName);
            return;
        }
        combatSummary.lastAttack = {
            attackerName: null,
            targetName,
            rollType: 'condition',
            conditionKey,
            timestamp: Date.now(),
        };
        storage.set('combatSummary', combatSummary, campaignName);
    }).catch(err => {
        console.error('[conditionEventStore] Error storing condition event:', err.message);
    });
}
