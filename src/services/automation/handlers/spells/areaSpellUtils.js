import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

// Shared helpers for save-based area spells (Stinking Cloud, Web).

export function spellNoticePopup(name, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description,
        },
    };
}

// Selected targets from metaCtx; if none, all creatures in the area.
export function resolveSelectedSpellTargets(cs, action) {
    const selectedTargetNames = action.metaCtx?.targets || cs.creatures.map(c => c.name);
    return cs.creatures.filter(c => selectedTargetNames.includes(c.name));
}

// Register concentration for this spell on the combat summary.
export function registerSpellConcentration(campaignName, casterName, spellName, playerStats) {
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) return;
    const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    addConcentration(combatSummary, casterName, spellName, concentrationDc);
    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}
