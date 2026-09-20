/**
 * Set of static campaign-level runtime keys.
 * These keys are stored at the campaign level (characterKey = 'campaign')
 * rather than under a character name or the campaign name.
 */
export const CAMPAIGN_KEYS = new Set([
    'targetEffects',
    'pendingSavePrompts',
    'coverRefresh',
    'warCasterReactions',
    'quivering_palm',
    'pendingSaveListenerPrompts',
    'encounter-viewingMonster',
    'map-viewingMonster',
    'combat-ui-viewingMonster',
    'combat-ui-viewingMonsterCreatureName',
    'cleavePending',
    'cleaveSecondTargets',
    'pipeline-pause',
    'travel-mode',
    'travel-pace',
    'travel-destination',
    'travel-path',
    'travel-pathIndex',
    'travel-accruedCost',
    'travel-dailyBudget',
    'travel-dayExhausted',
    'travel-forcedMarchHours',
    'travel-log',
    'travel-lastMessage',
    'travel-pendingEvent',
    'travel-eventFrequency',
    'travel-rerollsRemaining',
    'travel-horseback',
]);

/**
 * Check if a key is a campaign-level key (static or dynamic).
 * @param {string} key - The runtime key to check
 * @returns {boolean}
 */
export function isCampaignKey(key) {
    if (CAMPAIGN_KEYS.has(key)) return true;
    if (key.startsWith('_activeInvisibility_')) return true;
    if (key.startsWith('_activeFriends_')) return true;
    if (/^_.*_appliedTarget$/.test(key)) return true;
    return false;
}
