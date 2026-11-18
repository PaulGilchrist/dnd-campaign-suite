import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue, getRuntimeKeysByPrefix } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

/**
 * Centralized once-per-turn check for combat features.
 *
 * D&D 5e "once per turn" / "once per round" mean the same thing:
 * usable again after this character's next turn starts.
 *
 * We store the round number + holder name when the feature is used.
 * The feature becomes available again when round > storedRound — i.e., a
 * new round has started (the earliest point the holder's next turn can
 * begin, matching the round-wrap latch convention in navigationHandlers).
 *
 * FT-082: the cs.activeCreatureName mirror goes stale mid-combat (pitfall
 * 30 / FT-074 family), so re-arm must NEVER depend on it. The used-flag is
 * stored under the holder's own store (playerStats.name), which already
 * scopes the latch to the holder — the mirror comparison only ever caused
 * false refusals on the holder's own next turn.
 *
 * IMPORTANT: Always pass characterName (not null) as the 3rd argument so
 * checkOncePerTurn reads from the same store that markOncePerTurn writes to.
 *
 * @param {string} featureName — for display in popup messages
 * @param {string} usedKey — runtime key (e.g. '_CunningStrike_usedRound')
 * @param {string} characterName — the character whose store to read from
 * @param {string} campaignName
 * @returns {Promise<object|null>} null if usable, popup response if already used
 */
export async function checkOncePerTurn(featureName, usedKey, characterName, campaignName) {
    const cs = await getCombatContext(campaignName);
    const currentRound = cs?.round || 1;
    const stored = getRuntimeValue(characterName, usedKey);

    if (!stored) return null;

    // Legacy format: stored is just a number (old round-only tracking)
    if (typeof stored === 'number') {
        if (stored === currentRound) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} can only be used once per turn.`,
                },
            };
        }
        return null;
    }

    // New format: stored is { round, activeCreature }. FT-082: availability
    // is round-scoped off the holder's own store — never off the (stale)
    // cs.activeCreatureName mirror.
    const storedRound = stored?.round;

    if (currentRound > storedRound) {
        return null;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName} can only be used once per turn.`,
        },
    };
}

/**
 * Check once-per-turn AND skip flag for features that support user cancellation.
 *
 * @param {string} featureName
 * @param {string} usedKey
 * @param {string} skipKey
 * @param {object} playerStats
 * @param {string} campaignName
 * @returns {Promise<object|null>}
 */
export async function checkOncePerTurnWithSkip(featureName, usedKey, skipKey, playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    const currentRound = cs?.round || 1;
    const stored = getRuntimeValue(playerStats.name, usedKey, campaignName);
    const skipped = getRuntimeValue(playerStats.name, skipKey, campaignName);

    if (stored) {
        // Legacy format: stored is just a number
        if (typeof stored === 'number') {
            if (stored === currentRound) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${featureName} can only be used once per turn.`,
                    },
                };
            }
        } else {
            // New format: stored is { round, activeCreature }. FT-082:
            // round-scoped re-arm off the holder's store only — the
            // cs.activeCreatureName mirror is stale mid-combat (pitfall 30).
            const storedRound = stored?.round;
            if (!(currentRound > storedRound)) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${featureName} can only be used once per turn.`,
                    },
                };
            }
        }
    }

    if (skipped) {
        // Legacy format: skipped is just a number
        if (typeof skipped === 'number') {
            if (skipped === currentRound) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${featureName} was not used this turn.`,
                    },
                };
            }
        } else {
            // New format: skipped is { round, activeCreature } — round-scoped.
            const skippedRound = skipped?.round;
            if (!(currentRound > skippedRound)) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${featureName} was not used this turn.`,
                    },
                };
            }
        }
    }

    return null;
}

/**
 * Mark a feature as used. Stores the current round + the HOLDER's name.
 *
 * FT-082 / FT-074 (pitfall 30): never stamp cs.activeCreatureName from the
 * combatSummary mirror — it goes stale mid-combat and corrupts re-arm.
 *
 * @param {string} featureName
 * @param {string} usedKey
 * @param {object} playerStats
 * @param {string} campaignName
 * @returns {Promise<object>} the stored { round, activeCreature }
 */
export async function markOncePerTurn(featureName, usedKey, playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    const currentRound = cs?.round || 1;
    const stored = { round: currentRound, activeCreature: playerStats.name };
    await setRuntimeValue(playerStats.name, usedKey, stored, campaignName);
    return stored;
}

/**
 * Set the skip flag for features that support user cancellation.
 * Stamps the holder's name (FT-074 recipe), never the cs mirror.
 */
export async function setSkipFlag(skipKey, playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    const currentRound = cs?.round || 1;
    const stored = { round: currentRound, activeCreature: playerStats.name };
    await setRuntimeValue(playerStats.name, skipKey, stored, campaignName);
    return stored;
}

/**
 * Clear the skip flag after a feature is applied.
 */
export async function clearSkipFlag(skipKey, playerStats, campaignName) {
    await setRuntimeValue(playerStats.name, skipKey, null, campaignName);
}

/**
 * New-combat seam eviction (CLA-100: Initiative "Clear" restarts combat — the
 * board-wide clear, NOT a per-creature initiative roll; owner ruling 2026-11-10).
 *
 * Every latch in this family stamps the BARE combatSummary.round number
 * (`_<Feat>_usedRound` / `_<Feat>_skippedRound`, both holder-side and
 * monster-side), and the round-wrap re-arm only ever expires a stamp via the
 * `currentRound > stamp.round` comparison — the stamp itself survives the wrap.
 * A board Clear RESETS the round to 1, so a surviving `{round:1}` stamp ALIASES
 * the new combat's first round and checkOncePerTurn / checkOncePerTurnWithSkip
 * silently drop the rider (no prompt, no chooser, no log row — the round-reuse
 * after Clear bug). The comparison lanes cannot distinguish "this round" from
 * "a reused round number", so the eviction must happen at the seam itself —
 * exactly why handleClear resets the Dread Ambush once-per-combat latch.
 *
 * Eviction is pattern-based over each creature's own runtime store: any key
 * ending in "round" (case-insensitive) holds a round stamp — the static family
 * (`_Shield_Bash_usedRound`, `_Cleave_UsedRound`, `_cunningStrikeSkippedRound`),
 * the dynamically named rider keys (`_<Action>_usedRound` / `_<Action>_skippedRound`
 * built from feature names, players AND monsters alike), and the named round
 * counters (`actionSurgeUsedThisRound`, `relentlessUsedRound`,
 * `_PsychicBlade_attack_round`, …). A missed key would silently rules-skip like
 * the bug itself, so the store's own key census is authoritative over any
 * hand-maintained list. Keys that hold booleans or attack-instance markers
 * (never a round number) cannot alias via round reuse and are left alone.
 *
 * Returns the number of latch keys evicted (0 ⇒ zero writes, byte-identical).
 */
export function clearCombatLatches(campaignName, creatureNames) {
    if (!campaignName || !Array.isArray(creatureNames)) return 0;
    let cleared = 0;
    for (const creatureName of creatureNames) {
        if (!creatureName) continue;
        for (const key of getRuntimeKeysByPrefix(creatureName, '')) {
            if (/round$/i.test(key)) {
                setRuntimeValue(creatureName, key, null, campaignName);
                cleared += 1;
            }
        }
    }
    // Fail-loud audit trail (mirrors the zone sweep's board-clear row): the GM
    // sees which stale latches were evicted so a re-armed rider is explainable.
    if (cleared > 0) {
        addEntry(campaignName, {
            type: 'automation',
            automationType: 'new_combat_latch_reset',
            characterName: 'Campaign',
            description: `Combat board cleared: ${cleared} once-per-turn latch${cleared === 1 ? '' : 'es'} from the previous combat evicted.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[oncePerTurn:new-combat-latch-log]', e); });
    }
    return cleared;
}
