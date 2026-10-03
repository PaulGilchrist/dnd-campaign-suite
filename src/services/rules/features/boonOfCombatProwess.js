import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// FT-007 Boon of Combat Prowess (Epic Boon): once you use it, you can't use
// it again until the start of your next turn — a once-per-turn round latch
// (checkOncePerTurn / _Charge_Attack_usedRound shape). The round the holder
// spent it is stamped on the holder's own store; the offer stays locked for
// the rest of that round and re-arms when the round advances (initiative
// walk / round-wrap clears in initiative.jsx + navigationHandlers.js thread
// the same key; the initiative-rolled handler is the new-combat backstop).
// Stamping and consulting both read getCurrentCombatRound so they agree on
// the round source.
export const BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY = '_Boon_of_Combat_Prowess_usedRound';

export function boonOfCombatProwessLocked(characterName, campaignName) {
    const stored = getRuntimeValue(characterName, BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY, campaignName);
    if (!stored) return false;
    return Number(stored) === Number(getCurrentCombatRound(campaignName) ?? 1);
}

export async function markBoonOfCombatProwessUsed(characterName, campaignName) {
    const round = Number(getCurrentCombatRound(campaignName) ?? 0);
    await setRuntimeValue(characterName, BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY, round, campaignName);
    return round;
}
