/**
 * Canonical recognition of TOP-LEVEL change-data keys (backlog 2026-11-17 CD:
 * Admin-panel census for phantom keys). The wildcard lane
 * (campaigns-changedata.js POST /:campaign/:key) accepts ANY key blindly
 * (keyValidators.js pass-through by design), which is how retired-lane shadow
 * writes land silently as phantom top-level buckets. This module is the ONE
 * server-side place that says which top-level keys the app actually recognizes;
 * the Admin census lane (campaigns-admin.js) reports everything else.
 *
 * Recognized families — each entry verified against a current code consumer:
 *
 *  1. Character/creature BUCKET keys: the top-level key is a character's (or a
 *     joined creature's) name; nested keys live inside the bucket
 *     (`data['<Name>'].<key>`). Recognized via the campaign's roster JSON
 *     files and the combatSummary board, not this list.
 *  2. STATIC campaign keys below (SPECIAL_TOP_LEVEL_KEYS).
 *  3. PREFIX FAMILIES below (TOP_LEVEL_KEY_PREFIXES).
 *  4. INTERNAL FLAG convention: any key starting with `_`. Every dynamic
 *     campaign-scoped automation flag the client writes follows this
 *     underscore convention — `_activeInvisibility_<Name>` /
 *     `_activeFriends_<Name>` / `_activeGreaterInvisibility_<Name>`
 *     (useInitiativeEffects.js, friendsHandler.js; the isDynamicCampaignKey
 *     family in changeData.js), `_<Mastery>_appliedTarget`
 *     (weaponKindMasteryHandler), `_cover_shot` (coverService.js),
 *     `_fleshToStone_<Name>` / `_prismaticSprayIndigo_<Name>` /
 *     `_prismaticSprayViolet_<Name>` (saveResultHandlers.js),
 *     `_<Name>_Soulstitch_Spells_active`, and the `__campaign__` / `__map__`
 *     context stamps (MapContextSync.jsx, maps.js).
 */

// Every real value written by setRuntimeValue('campaign', '<key>', …) /
// useSyncedState('campaign', …), the server write routes below, the L5
// per-key validators (keyValidators.js), the reserved buckets
// (changeData.js CAMPAIGN_DATA_KEYS + removeChangeDataKey), and the named
// campaign-scope service keys listed beside each entry.
export const SPECIAL_TOP_LEVEL_KEYS = new Set([
    // changeData.js reserved campaign buckets (removeChangeDataKey + CAMPAIGN_DATA_KEYS)
    'combatSummary',
    'activeCreatureId',
    'log',
    'positioning',
    'targetEffects',
    'pendingSavePrompts',
    'coverRefresh',
    'warCasterReactions',
    'quivering_palm',
    'pendingSaveListenerPrompts',
    // Server write lanes outside the wildcard: POST /:campaign/music
    // (campaigns-changedata.js), the active-map pointer (maps.js), the
    // presence stamp (MapContextSync.jsx), the reserved legacy overlay key
    // (keyValidators.js 'spell-overlay' guard).
    'music',
    '__map__',
    '__campaign__',
    'spell-overlay',
    // L5 validator keys (keyValidators.js)
    'enforcement',
    'turnState',
    'activeConditions',
    'sessionState',
    'aiConfig',
    'activeCreatureName',
    'lastAppliedTurnStartCreature',
    // Campaign-scope client runtime keys (grep: setRuntimeValue/useSyncedState/
    // useRuntimeValue('campaign', '<key>'))
    'lastAttack',
    'lastCombatResult',          // createCreatureHandlers.js
    'pendingOAs',                // pendingOpportunityAttacks.js PENDING_OA_KEY
    'cleavePending',             // CharActions.jsx
    'cleaveSecondTargets',       // CharActions.jsx
    'tacticalMasterPending',     // CharActions.jsx
    'pendingStarryChaliceHeal',  // postCastHealService.js
    'loot-draft',                // useLootHandlers.js LOOT_DRAFT_KEY
    'leadingEvasionSelections',  // evasionUtils.js LEADING_EVASION_KEY
]);

// Dynamic campaign-scope families that carry a per-instance suffix.
export const TOP_LEVEL_KEY_PREFIXES = [
    'travel-',            // useTravelManagement.js / travelSession.js (travel-mode, …)
    'pipeline-',          // useCharActionModals.js client key 'pipeline-pause'
    'savePrompt-',        // savePromptService.js (savePrompt-<Target>[-<id>])
    'deathSavePrompt-',   // savePromptService.js
    'concentrationPrompt-', // concentrationService.js
    'fleshToStonePrompt-',  // fleshToStonePrompt lane (CreatureCard.jsx)
];

/**
 * Bucket-key normalization: the on-disk filename recipe (characterName.js
 * characterFileName — every non-alphanumeric becomes '_') applied
 * case-insensitively. Change-data bucket keys carry the DISPLAY name
 * ("War Cleric"), roster files carry the slug filename ("War_Cleric.json");
 * slugging both sides makes them agree without reading any file body.
 */
export function bucketKeySlug(key) {
    return String(key).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

/**
 * Classify one top-level change-data key.
 * @param {string} key
 * @param {{ characterFileSlugs?: Set<string>, creatureSlugs?: Set<string> }} known
 *   characterFileSlugs: bucketKeySlug() of every character JSON file stem in
 *   the campaign folder; creatureSlugs: bucketKeySlug() of every name on the
 *   combatSummary board (joined monsters write legitimate runtime buckets too —
 *   setRuntimeValue(creatureName, …)).
 * @returns {string|null} recognition label ('character' | 'creature' |
 *   'special' | 'internal-flag') or null when the key is UNRECOGNIZED.
 */
export function classifyTopLevelKey(key, known = {}) {
    if (SPECIAL_TOP_LEVEL_KEYS.has(key)) return 'special';
    if (TOP_LEVEL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return 'special';
    if (key.startsWith('_')) return 'internal-flag';
    const slug = bucketKeySlug(key);
    if (known.characterFileSlugs?.has(slug)) return 'character';
    if (known.creatureSlugs?.has(slug)) return 'creature';
    return null;
}

function describeValue(value) {
    if (value === null) return { type: 'null', summary: 'null' };
    if (Array.isArray(value)) return { type: 'array', summary: `array, ${value.length} entr${value.length === 1 ? 'y' : 'ies'}` };
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        const preview = keys.slice(0, 5).join(', ');
        const rest = keys.length > 5 ? `, +${keys.length - 5} more` : '';
        return { type: 'object', summary: `${keys.length} key${keys.length === 1 ? '' : 's'}: ${preview}${rest}` };
    }
    if (typeof value === 'string') {
        const preview = value.length > 60 ? `${value.slice(0, 60)}…` : value;
        return { type: 'string', summary: `"${preview}"` };
    }
    return { type: typeof value, summary: String(value) };
}

/**
 * Build the Admin census payload for one campaign's change-data store.
 * @param {object} data the in-memory change-data object ({}) when absent
 * @param {{ characterFileSlugs?: Set<string>, creatureSlugs?: Set<string> }} known
 * @returns {{ totalKeys: number, unknownKeys: Array<{key,type,summary}> }}
 */
export function censusChangeDataKeys(data, known = {}) {
    const entries = data && typeof data === 'object' ? Object.entries(data) : [];
    const unknownKeys = [];
    for (const [key, value] of entries) {
        if (classifyTopLevelKey(key, known)) continue;
        const { type, summary } = describeValue(value);
        unknownKeys.push({ key, type, summary });
    }
    unknownKeys.sort((a, b) => a.key.localeCompare(b.key));
    return { totalKeys: entries.length, unknownKeys };
}
