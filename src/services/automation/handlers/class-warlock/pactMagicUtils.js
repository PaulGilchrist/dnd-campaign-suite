import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// Shared Pact Magic slot helpers (Hurl Through Hell / Clairvoyant Combatant).

// Find Pact Magic slot level (highest spell slot level the warlock has).
export function findPactSlotLevel(playerStats) {
    for (let lv = 9; lv >= 1; lv--) {
        if (playerStats.spellAbilities?.[`spell_slots_level_${lv}`] > 0) {
            return lv;
        }
    }
    return 0;
}

// True when the feature is out of uses, declares Pact Magic recharge, and a
// Pact Magic slot is available to spend.
export function hasPactSlotAvailable(playerStats, playerName, campaignName, auto, currentUses, maxUses, pactSlotLevel) {
    if (!(currentUses >= maxUses && auto.pactMagicRecharge && pactSlotLevel > 0)) return false;
    const slotKey = `spell_slots_level_${pactSlotLevel}`;
    const currentSlots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? playerStats.spellAbilities?.[slotKey] ?? 0);
    return currentSlots > 0;
}
