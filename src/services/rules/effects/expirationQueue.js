import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import utils from '../../ui/utils.js';
import { clearExpirationEffects } from './clearExpirationEffects.js';
import { KEY } from './turnStartEffects.js';

/**
 * Add an expiration entry to the runtime store.
 */
export function addExpiration({ attackerName, targetName, effects, campaignName, rounds, expireOnCreatureName }) {
    let list = getRuntimeValue(attackerName, KEY);
    if (!Array.isArray(list)) {
        list = [];
        setRuntimeValue(attackerName, KEY, list, campaignName);
    }
    const currentRound = getCurrentCombatRound(campaignName);
    setRuntimeValue(attackerName, KEY, [
        ...list,
        { target: targetName, effects, appliedRound: currentRound, expiryRounds: rounds ?? Infinity, expireOnCreatureName: expireOnCreatureName ?? null }
    ], campaignName);
}

/**
 * Process a single expiration list: remove expired entries, keep the rest.
 * Expired = currentRound >= appliedRound + expiryRounds.
 * Also expires when expireOnCreatureName is set and the active creature matches.
 * Returns { processed, expiredCount, changed }.
 */
export function processExpirationList(list, currentRound, targetOwner, campaignName, activeName) {
    if (!Array.isArray(list) || !list.length) return { processed: [], expiredCount: 0, changed: false };

    let newEntries = [];
    let expiredCount = 0;
    let changed = false;

    for (const item of list) {
        const rounds = item.expiryRounds ?? Infinity;
        const expirationRound = item.appliedRound + rounds;
        const isRoundExpired = currentRound >= expirationRound;
        const isCreatureExpired = item.expireOnCreatureName && activeName &&
            utils.getName(item.expireOnCreatureName) === utils.getName(activeName) &&
            currentRound > item.appliedRound;
        const isExpired = isRoundExpired || isCreatureExpired;
        if (isExpired) {
            clearExpirationEffects(item.effects, item.target, targetOwner, campaignName);
            expiredCount++;
            changed = true;
        } else {
            newEntries.push(item);
        }
    }

    return { processed: newEntries, expiredCount, changed };
}

/**
 * Expire stale pendingExpirations for a single creature's store.
 * Returns true if any entries were expired.
 */
export function expireForCreature(attackerName, currentRound, campaignName) {
    let list = getRuntimeValue(attackerName, KEY);
    if (!Array.isArray(list)) {
        list = [];
        setRuntimeValue(attackerName, KEY, list, campaignName);
    }
    const { processed, changed } = processExpirationList(list, currentRound, attackerName, campaignName, attackerName);
    if (changed) {
        setRuntimeValue(attackerName, KEY, processed, campaignName);
    }
    return changed;
}

/**
 * Scan all runtime stores for entries targeting a specific name and expire them.
 * Returns true if any entries were expired.
 */
export function expireForTarget(targetName, currentRound, campaignName) {
    const allKeys = getAllStoreKeys();
    let totalChanged = false;

    for (const key of allKeys) {
        if (typeof key !== 'string') continue;
        if (key.toLowerCase() === targetName.toLowerCase()) continue;

        const list = getRuntimeValue(key, KEY);
        if (!Array.isArray(list) || !list.length) continue;

        const { processed, changed } = processExpirationList(list, currentRound, key, campaignName, targetName);
        if (changed) {
            setRuntimeValue(key, KEY, processed, campaignName);
            totalChanged = true;
        }
    }

    return totalChanged;
}
