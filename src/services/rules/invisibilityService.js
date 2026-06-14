import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { getActiveBuffs } from '../automation/common/buffToggle.js';
import { addEntry } from '../ui/logService.js';

/**
 * End Invisibility early for the invisible creature if they take a hostile action
 * (make an attack roll, deal damage, or cast a spell).
 * Called from the relevant hooks/services when such actions occur.
 */
export function endInvisibilityOnHostileAction(invisibleName, campaignName) {
    const key = `_activeInvisibility_${invisibleName}`;
    const casterName = getRuntimeValue(campaignName, key, campaignName);
    if (!casterName) return;

    // Remove the Invisibility buff from the target
    const activeBuffs = getActiveBuffs(invisibleName, campaignName);
    const filtered = activeBuffs.filter(b => b.name !== 'Invisibility');
    if (filtered.length !== activeBuffs.length) {
        setRuntimeValue(invisibleName, 'activeBuffs', filtered, campaignName);
    }

    // Remove the invisible condition from the target
    const conditions = getRuntimeValue(invisibleName, 'activeConditions', campaignName) || [];
    const condFiltered = conditions.filter(c => String(c).toLowerCase() !== 'invisible');
    if (condFiltered.length !== conditions.length) {
        setRuntimeValue(invisibleName, 'activeConditions', condFiltered, campaignName);
    }

    setRuntimeValue(campaignName, key, null, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: invisibleName,
        abilityName: 'Invisibility',
        description: `Invisibility ends for ${invisibleName} after a hostile action.`,
    }).catch(() => {});
}
