import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';
import { addEntry } from '../../ui/logService.js';

/**
 * End Invisibility early for the invisible creature if they take a hostile action
 * (make an attack roll, deal damage, or cast a spell).
 * Called from the relevant hooks/services when such actions occur.
 */
export function endInvisibilityOnHostileAction(invisibleName, campaignName) {
    const key = `_activeInvisibility_${invisibleName}`;
    const casterName = getRuntimeValue(campaignName, key, campaignName);
    if (!casterName) return;
    console.log('[invisibilityService] endInvisibilityOnHostileAction: CLEARED _activeInvisibility_%s (caster=%s)', invisibleName, casterName);

    // Remove the Invisibility buff from the target
    const activeBuffs = getActiveBuffs(invisibleName, campaignName);
    const filtered = activeBuffs.filter(b => b.name !== 'Invisibility');
    if (filtered.length !== activeBuffs.length) {
        console.log('[invisibilityService] endInvisibilityOnHostileAction: removed Invisibility buff from %s', invisibleName);
        setRuntimeValue(invisibleName, 'activeBuffs', filtered, campaignName);
    }

    // Remove the invisible condition from the target
    const conditions = (() => {
        const x = getRuntimeValue(invisibleName, 'activeConditions', campaignName);
        if (x == null) { console.error('[invisibilityService] Missing array:', x); throw new Error('Expected array, got ' + x); }
        return x;
    })();
    const condFiltered = conditions.filter(c => String(c).toLowerCase() !== 'invisible');
    if (condFiltered.length !== conditions.length) {
        console.log('[invisibilityService] endInvisibilityOnHostileAction: removed invisible condition from %s, conditions now: %s', invisibleName, JSON.stringify(condFiltered));
        setRuntimeValue(invisibleName, 'activeConditions', condFiltered, campaignName);
    }

    setRuntimeValue(campaignName, key, null, campaignName);
    console.log('[invisibilityService] endInvisibilityOnHostileAction: set %s = null', key);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: invisibleName,
        abilityName: 'Invisibility',
        description: `Invisibility ends for ${invisibleName} after a hostile action.`,
    }).catch(() => {});
}
