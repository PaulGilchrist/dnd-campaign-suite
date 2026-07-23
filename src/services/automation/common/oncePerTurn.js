import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Centralized once-per-turn check for combat features.
 *
 * D&D 5e "once per turn" / "once per round" mean the same thing:
 * usable again after this character's next turn starts.
 *
 * We store the round number + creature name when the feature is used.
 * The feature becomes available again when round > storedRound AND
 * activeCreature === storedActiveCreature — i.e., one full round has
 * passed and this character's turn has come around again.
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
    const currentCreature = cs?.activeCreatureName || null;
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

    // New format: stored is { round, activeCreature }
    const storedRound = stored?.round;
    const storedCreature = stored?.activeCreature;

    if ((currentRound === storedRound + 1 && currentCreature === storedCreature) || currentRound > storedRound + 1) {
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
    const currentCreature = cs?.activeCreatureName || null;
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
            // New format: stored is { round, activeCreature }
            const storedRound = stored?.round;
            const storedCreature = stored?.activeCreature;
            if (!((currentRound === storedRound + 1 && currentCreature === storedCreature) || currentRound > storedRound + 1)) {
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
            // New format: skipped is { round, activeCreature }
            const skippedRound = skipped?.round;
            const skippedCreature = skipped?.activeCreature;
            if (!(currentRound > skippedRound && currentCreature === skippedCreature)) {
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
 * Mark a feature as used. Stores the current round + active creature.
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
    const currentCreature = cs?.activeCreatureName || playerStats.name;
    const stored = { round: currentRound, activeCreature: currentCreature };
    await setRuntimeValue(playerStats.name, usedKey, stored, campaignName);
    return stored;
}

/**
 * Set the skip flag for features that support user cancellation.
 */
export async function setSkipFlag(skipKey, playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    const currentRound = cs?.round || 1;
    const currentCreature = cs?.activeCreatureName || playerStats.name;
    const stored = { round: currentRound, activeCreature: currentCreature };
    await setRuntimeValue(playerStats.name, skipKey, stored, campaignName);
    return stored;
}

/**
 * Clear the skip flag after a feature is applied.
 */
export async function clearSkipFlag(skipKey, playerStats, campaignName) {
    await setRuntimeValue(playerStats.name, skipKey, null, campaignName);
}
