import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import utils from '../../ui/utils.js';
import { clearExpirationEffects } from './clearExpirationEffects.js';
import { KEY } from './turnStartEffects.js';

/**
 * Add an expiration entry to the runtime store.
 * `until: 'combat'` (no-timers plan T3) marks a COMBAT-SCOPED entry —
 * authored ≥1 minute durations never count rounds; they are swept by
 * sweepCombatScopedExpirations at a new initiative roll, short rest, or
 * long rest (rounds carries Infinity so no round seam matures them).
 */
export function addExpiration({ attackerName, targetName, effects, campaignName, rounds, expireOnCreatureName, until = null }) {
    // BA-001 / §39: the former two un-awaited writes on the same
    // /changes/<Name> replace-route could reorder network-side — the seed
    // [] POST landing last wiped the entry, so pendingExpirations stayed []
    // and expireStaleEffects had nothing to consume (Dodge never cleared).
    // One merged write carrying the appended entry fixes it app-wide.
    const stored = getRuntimeValue(attackerName, KEY);
    const list = Array.isArray(stored) ? stored : [];
    const currentRound = getCurrentCombatRound(campaignName);
    const entry = { target: targetName, effects, appliedRound: currentRound, expiryRounds: rounds ?? Infinity, expireOnCreatureName: expireOnCreatureName ?? null };
    // until rides ONLY when combat-scoped — legacy entries keep their exact
    // L1–4 shape (byte-parity when enforcement is off).
    if (until) entry.until = until;
    setRuntimeValue(attackerName, KEY, [
        ...list,
        entry
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

/**
 * no-timers plan T3/T4 — sweep COMBAT-SCOPED entries (until: 'combat').
 *
 * Effects authored ≥1 minute never count rounds; they last the whole combat
 * and end at one of the three boundaries the turn-based principle defines:
 * a NEW INITIATIVE ROLL (new combat), a SHORT REST, or a LONG REST. Those
 * seams call this — for every store (new combat) or just the resting
 * creature's store (rests) — running each swept entry's clearExpirationEffects
 * so the zone badge / targetEffects / tracking key go with it.
 *
 * Entries without the marker (legacy round clocks, concentration) are NEVER
 * touched, and no pendingExpirations list is rewritten when nothing matches
 * ⇒ zero writes when nothing was armed (byte-parity).
 * Returns the number of swept entries.
 */
export function sweepCombatScopedExpirations({ campaignName, ownerName = null }) {
    if (!campaignName) return 0;
    const keys = ownerName ? [ownerName] : (getAllStoreKeys() || []);
    let swept = 0;
    for (const key of keys) {
        if (typeof key !== 'string') continue;
        const list = getRuntimeValue(key, KEY);
        if (!Array.isArray(list) || !list.length) continue;
        const doomed = list.filter((e) => e?.until === 'combat');
        if (!doomed.length) continue;
        doomed.forEach((e) => clearExpirationEffects(e.effects, e.target, key, campaignName));
        setRuntimeValue(key, KEY, list.filter((e) => e?.until !== 'combat'), campaignName);
        swept += doomed.length;
    }
    return swept;
}
