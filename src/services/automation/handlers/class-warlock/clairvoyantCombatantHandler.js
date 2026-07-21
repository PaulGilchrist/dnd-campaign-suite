import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Clairvoyant Combatant';

    // Check uses remaining
    let currentUses = Number(getRuntimeValue(playerName, 'clairvoyantCombatantUses', campaignName) ?? 0);
    const maxUses = auto.uses || 1;

    // Find Pact Magic slot level (highest spell slot level the warlock has)
    let pactSlotLevel = 0;
    for (let lv = 9; lv >= 1; lv--) {
        if (playerStats.spellAbilities?.[`spell_slots_level_${lv}`] > 0) {
            pactSlotLevel = lv;
            break;
        }
    }

    // Check Pact Magic slot availability if needed
    let pactSlotsAvailable = false;
    if (currentUses >= maxUses && auto.pactMagicRecharge && pactSlotLevel > 0) {
        const slotKey = `spell_slots_level_${pactSlotLevel}`;
        const currentSlots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? playerStats.spellAbilities?.[slotKey] ?? 0);
        pactSlotsAvailable = currentSlots > 0;
    }

    // Check if we can use at all
    const canUse = currentUses < maxUses || (auto.pactMagicRecharge && pactSlotsAvailable);

    if (!canUse) {
        let reason = `${featureName}: No uses remaining. Recharges on a Short or Long Rest.`;
        if (auto.pactMagicRecharge) {
            reason = `${featureName}: No uses remaining. Recharges on a Short or Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.`;
        }
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: reason,
                automation: auto,
            },
        };
    }

    // Get the target from Awakened Mind bond
    const awakenedMindTarget = getRuntimeValue(playerName, 'awakenedMindTarget', campaignName);

    if (!awakenedMindTarget) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires an active Awakened Mind bond. Activate Awakened Mind first to form a telepathic bond with a creature.`,
                automation: auto,
            },
        };
    }

    // Build save DC
    const saveDc = auto.saveDc || 8 + playerStats.proficiency + (playerStats.abilities?.find(a => a.name === auto.saveType)?.bonus || 3);
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
