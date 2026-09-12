import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { infoPopup } from '../../common/infoPopup.js';
import { findPactSlotLevel, hasPactSlotAvailable } from './pactMagicUtils.js';

// Build save DC
function resolveClairvoyantSaveDc(auto, playerStats) {
    return auto.saveDc || 8 + playerStats.proficiency + (playerStats.abilities?.find(a => a.name === auto.saveType)?.bonus || 3);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Clairvoyant Combatant';

    // Check uses remaining
    let currentUses = Number(getRuntimeValue(playerName, 'clairvoyantCombatantUses', campaignName) ?? 0);
    const maxUses = auto.uses || 1;

    // Find Pact Magic slot level (highest spell slot level the warlock has)
    const pactSlotLevel = findPactSlotLevel(playerStats);

    // Check Pact Magic slot availability if needed
    const pactSlotsAvailable = hasPactSlotAvailable(playerStats, playerName, campaignName, auto, currentUses, maxUses, pactSlotLevel);

    // Check if we can use at all
    const canUse = currentUses < maxUses || (auto.pactMagicRecharge && pactSlotsAvailable);

    if (!canUse) {
        let reason = `${featureName}: No uses remaining. Recharges on a Short or Long Rest.`;
        if (auto.pactMagicRecharge) {
            reason = `${featureName}: No uses remaining. Recharges on a Short or Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.`;
        }
        return infoPopup(featureName, reason, auto);
    }

    // Get the target from Awakened Mind bond
    const awakenedMindTarget = getRuntimeValue(playerName, 'awakenedMindTarget', campaignName);

    if (!awakenedMindTarget) {
        return infoPopup(featureName, `${featureName} requires an active Awakened Mind bond. Activate Awakened Mind first to form a telepathic bond with a creature.`, auto);
    }

    const saveDc = resolveClairvoyantSaveDc(auto, playerStats);
    const saveType = auto.saveType || 'WIS';

    // Return modal for confirmation
    return {
        type: 'modal',
        modalName: 'clairvoyantCombatant',
        payload: {
            action,
            playerStats,
            campaignName,
            targetName: awakenedMindTarget,
            saveType,
            saveDc,
            currentUses,
            maxUses,
            pactSlotLevel,
            pactSlotsAvailable,
            pactMagicRecharge: !!auto.pactMagicRecharge,
        },
    };
}
