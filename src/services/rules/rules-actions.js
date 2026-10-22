import { uniqBy } from 'lodash';
import { is2024 } from './rules-helpers.js';
import { getSubModules } from './rules-core.js';
import { categorizeFeatures } from '../character/featureCategorizationUtils.js';

/**
 * Shared boundary guard (#1435): action channels must be arrays. Both ruleset
 * arms enforce the SAME contract — loud at the seam, never garbage downstream.
 * Local guard-helper idiom per effects/turnStartEffects.js:19 ensureArray;
 * message bytes are byte-identical to the pinned 5e guards (rules.helpers.test.js:197-220).
 */
function requireArray(playerStats, field) {
    const value = playerStats[field];
    if (!Array.isArray(value)) {
        console.error(`rules: expected ${field} to be an array for`, playerStats.name);
        throw new Error(`Missing array: ${field} for ${playerStats.name}`);
    }
    return value;
}

/**
 * Shared row canonicalizer (#1455(a)): joins the fix#115 string-normalization
 * family (:73-75 player actions, :101-103 specialActions). uniqBy('name') keys
 * EVERY raw string row to undefined, so the 2nd+ distinct string in a channel
 * silently dropped with zero console output (pre-fix pinned quirk: bonusActions
 * ['Alpha','Bravo'] -> ['Alpha']). Strings are LAWFUL input here — the house
 * law `typeof row === 'string' ? row : row.name` guards ~20 consumers
 * (CharSpecialActions.jsx:263, healingHandler.js:71, cunningStrikeUtils.js:16) —
 * so canonicalize into the house row shape { name, description: '', details: null }
 * (bytes identical to the :74/:102 coercion) and dedupe on real names; the sort's
 * localeCompare becomes total. Rows with no usable name are garbage: loud
 * console.error per drop (no-silent-drop law) instead of collapsing to one
 * undefined key. Object rows pass through by identity — untouched.
 */
function normalizeActionRows(rows, field, playerStats) {
    const normalized = [];
    for (const row of rows) {
        const name = typeof row === 'string' ? row : row?.name;
        if (typeof name === 'string' && name) {
            normalized.push(typeof row === 'string'
                ? { name: row, description: '', details: null }
                : row);
        } else {
            console.error(`rules: dropping ${field} row without a name for`, playerStats.name, row);
        }
    }
    return normalized;
}

/**
 * Get actions for a character (ruleset-specific).
 */
export function getActions(playerStats, playerSummary) {
    const { classRules: cr, raceRules: rr } = getSubModules(playerStats, playerSummary);
    const features = cr.getFeatures(playerStats);
    const traits = rr.getTraits(playerStats);

    // Process character-level features array (e.g., Deflect Attacks from character JSON)
    const characterFeatures = playerSummary?.features && Array.isArray(playerSummary.features)
        ? categorizeFeatures(playerSummary.features, cr.featureCategories || {})
        : { actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] };

    if (is2024(playerStats, playerSummary)) {
        return getActions2024(playerStats, features, traits, characterFeatures);
    }

    return getActions5e(playerStats, features, traits, characterFeatures);
}

function getActions2024(playerStats, features, traits, characterFeatures = {}) {
    // 2024: normalize string actions, include magic/utilize/craft actions
    const playerActions = requireArray(playerStats, 'actions');
    const playerActionsMapped = playerActions.map(action =>
        typeof action === 'string' ? { name: action, description: '', details: null } : action
    );

    const actions = uniqBy(normalizeActionRows([
         ...playerActionsMapped,
         ...features.actions,
         ...characterFeatures.actions,
         ...traits.actions,
         ...(playerStats.magicActions ? playerStats.magicActions : []),
         ...(playerStats.utilizeActions ? playerStats.utilizeActions : []),
         ...(playerStats.craftActions ? playerStats.craftActions : [])
     ], 'actions', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));

    const bonusActions = uniqBy(normalizeActionRows([
         ...requireArray(playerStats, 'bonusActions'),
         ...features.bonusActions,
         ...characterFeatures.bonusActions,
         ...traits.bonusActions
     ], 'bonusActions', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));

    const reactions = uniqBy(normalizeActionRows([
         ...requireArray(playerStats, 'reactions'),
         ...features.reactions,
         ...characterFeatures.reactions,
         ...traits.reactions
     ], 'reactions', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));

    const playerSpecialActionsMapped = requireArray(playerStats, 'specialActions').map(action =>
        typeof action === 'string' ? { name: action, description: '', details: null } : action
    );

     // Player row first — parity with the actions channel above (:49-:50) and the 5e
     // twin (:101-:104): uniqBy first-wins keeps the player-owned row (#1435(b)).
     const specialActions = uniqBy(normalizeActionRows([
           ...playerSpecialActionsMapped,
           ...features.specialActions,
           ...characterFeatures.specialActions,
           ...traits.specialActions,
          ...(playerStats.magicSpecialActions ? playerStats.magicSpecialActions : []),
          ...(playerStats.utilizeSpecialActions ? playerStats.utilizeSpecialActions : []),
          ...(playerStats.craftSpecialActions ? playerStats.craftSpecialActions : [])
     ], 'specialActions', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));

    const characterAdvancement = uniqBy(normalizeActionRows([...features.characterAdvancement, ...characterFeatures.characterAdvancement, ...traits.characterAdvancement], 'characterAdvancement', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));

    return [actions, bonusActions, reactions, specialActions, characterAdvancement];
}

function getActions5e(playerStats, features, traits, characterFeatures = {}) {
    // 5e: original action handling — the strict-Array boundary law both arms
    // now share via requireArray (#1435); short-circuit order preserved.
    const actions = requireArray(playerStats, 'actions');
    const bonusActions = requireArray(playerStats, 'bonusActions');
    const reactions = requireArray(playerStats, 'reactions');
    const specialActions = requireArray(playerStats, 'specialActions');
    const actionsResult = uniqBy(normalizeActionRows([...actions, ...features.actions, ...characterFeatures.actions, ...traits.actions], 'actions', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));
    const bonusActionsResult = uniqBy(normalizeActionRows([...bonusActions, ...features.bonusActions, ...characterFeatures.bonusActions, ...traits.bonusActions], 'bonusActions', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));
    const reactionsResult = uniqBy(normalizeActionRows([...reactions, ...features.reactions, ...characterFeatures.reactions, ...traits.reactions], 'reactions', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));
    const specialActionsResult = uniqBy(normalizeActionRows([...specialActions, ...features.specialActions, ...characterFeatures.specialActions, ...traits.specialActions], 'specialActions', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));
    const characterAdvancement = uniqBy(normalizeActionRows([...features.characterAdvancement, ...characterFeatures.characterAdvancement, ...traits.characterAdvancement], 'characterAdvancement', playerStats), 'name').sort((a, b) => a.name.localeCompare(b.name));

    return [actionsResult, bonusActionsResult, reactionsResult, specialActionsResult, characterAdvancement];
}
