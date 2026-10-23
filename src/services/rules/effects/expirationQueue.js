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
 * fix#1298 per-entry clock resolution (no-clock law: corrupt entries get a
 * LOUD warning + retention, never a fabricated default clock). Returns
 * { ok: true, expirationRound } for evaluable entries, or { ok: false }
 * AFTER the required console.error for data holes. Designed-immortal
 * Infinity (the addExpiration :23 `rounds ?? Infinity` producer contract and
 * the until:'combat' combat-scoped sentinel) resolves to Infinity and stays
 * SILENT — sweepCombatScopedExpirations owns those boundaries (fix#127/#174).
 */
function resolveExpirationRound(item, { targetOwner, campaignName }) {
    const rounds = item.expiryRounds ?? Infinity;
    if (rounds === Infinity) {
        // Round seam immortal BY DESIGN (silent). The creature seam still
        // needs a finite appliedRound anchor; a missing one is a data hole.
        if (item.expireOnCreatureName && !Number.isFinite(item.appliedRound)) {
            console.error('[expirationQueue] expireOnCreatureName anchor unresolvable — missing/non-finite appliedRound; retained', {
                target: item.target, expireOnCreatureName: item.expireOnCreatureName, targetOwner, campaignName,
            });
            return { ok: false };
        }
        return { ok: true, expirationRound: Infinity };
    }
    if (!Number.isFinite(rounds) || !Number.isFinite(item.appliedRound)) {
        // fix#1298 :48 seam: expirationRound would be NaN (or a string
        // concat), so `currentRound >= expirationRound` could never mature
        // this entry — the silent-immortal hole. Loud-retained.
        console.error('[expirationQueue] entry cannot age — missing/non-finite appliedRound or expiryRounds; retained', {
            target: item.target, appliedRound: item.appliedRound, expiryRounds: item.expiryRounds, targetOwner, campaignName,
        });
        return { ok: false };
    }
    return { ok: true, expirationRound: item.appliedRound + rounds };
}

/**
 * Process a single expiration list: remove expired entries, keep the rest.
 * Expired = currentRound >= appliedRound + expiryRounds.
 * Also expires when expireOnCreatureName is set and the active creature matches.
 * Returns { processed, expiredCount, changed }.
 *
 * fix#1298 (#1298) corrupt-entry isolation — fix#86/#111 family: one poison
 * entry must never strand its siblings (#105/#111 starvation lesson applied
 * to the queue). Pre-fix seams, both repaired here:
 * - :47 a null entry TypeErrors on `item.expiryRounds`, aborting the whole
 *   loop; the caller's outer catch (expireStaleEffects.js:113) then logged
 *   once and swallowed the pass, so every LATER entry in that store — and
 *   every later phase — went unprocessed.
 * - :48 a missing appliedRound computed `NaN + rounds` = NaN expirationRound;
 *   `currentRound >= NaN` is never true, so the corrupt entry was retained
 *   FOREVER with no clock AND no warning — a silent state leak.
 * Posture (no-clock law: never fabricate a clock to paper over a hole):
 * - corrupt entries (null, non-finite expiryRounds, non-finite appliedRound
 *   on a finite round clock, or an expireOnCreatureName anchor with no
 *   finite appliedRound) → console.error LOUD + RETAIN in the store — never
 *   silently immortal, never silently dropped; nothing leaves the list
 *   except on a real expiry seam.
 * - designed-immortal entries (expiryRounds Infinity — the addExpiration
 *   `rounds ?? Infinity` producer contract and the until:'combat'
 *   combat-scoped sentinel) → MUST stay SILENT here (fix#127/#174 pins);
 *   sweepCombatScopedExpirations owns their boundaries (:123-138).
 * With the per-entry try/catch below, the caller's outer catch is now a
 * last resort for catastrophic-only failures (store read/write blowups):
 * entry-field errors can no longer reach it.
 */
export function processExpirationList(list, currentRound, targetOwner, campaignName, activeName) {
    if (!Array.isArray(list) || !list.length) return { processed: [], expiredCount: 0, changed: false };

    let newEntries = [];
    let expiredCount = 0;
    let changed = false;

    for (const item of list) {
        try {
            if (!item) {
                // fix#1298: loud-skip + retain — unprocessable, but never
                // silently erased (the warning is the audit record).
                console.error('[expirationQueue] null entry skipped', { targetOwner, campaignName });
                newEntries.push(item);
                continue;
            }
            const clock = resolveExpirationRound(item, { targetOwner, campaignName });
            if (!clock.ok) {
                newEntries.push(item);
                continue;
            }
            const isRoundExpired = currentRound >= clock.expirationRound;
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
        } catch (_e) {
            // Per-entry last resort (e.g. clearExpirationEffects throwing
            // mid-clear): log loud, retain the entry for the next seam, and
            // keep processing siblings — this is what used to escape to the
            // caller's outer catch and starve the whole pass.
            console.error('[expirationQueue] entry processing failed — retained for next seam', { targetOwner, campaignName }, _e);
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
