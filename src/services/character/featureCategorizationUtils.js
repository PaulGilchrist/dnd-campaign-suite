import { normalizeCastingTime } from '../shared/castingTimeUtils.js';

/**
 * Shared utility for categorizing features/traits into their respective categories.
 * This logic is common across both 5e and 2024 rule sets.
 */

/**
 * Categorize a list of features/traits into actions, bonusActions, reactions, specialActions, and characterAdvancement.
 *
 * @param {Array} items - Array of feature/trait objects to categorize
 * @param {Object} categories - Category definitions from feature-categories file
 * @param {Object} options - Optional configuration
 * @param {string} options.descriptionField - Field name for description ('description' or 'desc')
 * @param {boolean} options.reverseOrder - If true, process items from highest to lowest level (for class features)
 * @returns {Object} Categorized features with actions, bonusActions, reactions, specialActions, characterAdvancement arrays
 */
const CASTING_TIME_CATEGORY = {
  '1 action': 'actions',
  '1 bonus action': 'bonusActions',
  '1 reaction': 'reactions'
};

const buildItemSummary = (item, descriptionField) => ({
  name: item.name,
  level: item.level ?? null,
  description: item[descriptionField],
  details: item.details,
  automation: item.automation
});

// Resolve the effective casting time for an item plus whether any of its
// automation entries is a reaction.
const resolveCastingTime = (item) => {
  let castingTime = item.casting_time || item.automation?.casting_time;
  const automation = Array.isArray(item.automation) && item.automation.length > 0 ? item.automation : null;
  if (automation && !castingTime) {
    // CLA-218: multi-automation features may declare 'passive' first
    // (e.g. Mage Hand Legerdemain: [passive_rule, conditional_advantage,
    // mage_hand_control/'1 bonus action']). Prefer the first ACTIONABLE
    // casting time over a leading 'passive' so the row lands in the
    // section where clicking it dispatches — mirrors the hasReaction
    // multi-entry scan below (CLA-192 .some/multi-entry family).
    const actionableAuto = automation.find(a => {
      const ct = normalizeCastingTime(a?.casting_time || '');
      return ct && ct !== 'passive';
    });
    const firstAuto = actionableAuto || automation.find(a => a?.casting_time);
    if (firstAuto) {
      castingTime = firstAuto.casting_time;
    }
  }
  // Check if any automation entry is a reaction (takes priority over passive)
  const hasReaction = automation ? automation.some(a => normalizeCastingTime(a?.casting_time || '') === '1 reaction') : false;
  return { castingTime, hasReaction };
};

const pushUnique = (list, itemSummary) => {
  if (!list.some(f => f.name === itemSummary.name)) {
    list.push(itemSummary);
    return true;
  }
  return false;
};

// Tried in rule order; each target is skipped if it already holds the item,
// cascading to the next target exactly like the original if/else chain.
const buildCastingTimeTargets = (ct, hasReaction, itemName, characterAdvancement) => {
  const targets = [];
  const mappedCategory = CASTING_TIME_CATEGORY[ct];
  if (mappedCategory) targets.push(mappedCategory);
  if (hasReaction) targets.push('reactions');
  if (ct === 'passive' && characterAdvancement.includes(itemName)) targets.push('characterAdvancement');
  targets.push('specialActions');
  return targets;
};

const categorizeByCastingTime = (categorized, item, itemSummary, characterAdvancement) => {
  const { castingTime, hasReaction } = resolveCastingTime(item);
  if (!castingTime) return false;
  const ct = normalizeCastingTime(castingTime);
  const targets = buildCastingTimeTargets(ct, hasReaction, item.name, characterAdvancement);
  for (const target of targets) {
    if (pushUnique(categorized[target], itemSummary)) return true;
  }
  return true;
};

// Fallback: Categorize based on category definitions (name-based, for features without automation)
const categorizeByCategoryDefinitions = (categorized, item, itemSummary, defs) => {
  const { actions, bonusActions, reactions, characterAdvancement } = defs;
  const targets = [];
  if (characterAdvancement.includes(item.name)) targets.push('characterAdvancement');
  if (actions.includes(item.name)) targets.push('actions');
  if (bonusActions.includes(item.name)) targets.push('bonusActions');
  if (reactions.includes(item.name)) targets.push('reactions');
  targets.push('specialActions');
  for (const target of targets) {
    if (pushUnique(categorized[target], itemSummary)) return;
  }
};

export const categorizeFeatures = (items, categories, options = {}) => {
  const {
    descriptionField = 'description',
    reverseOrder = false
  } = options;

  const {
    actions = [],
    bonusActions = [],
    reactions = [],
    characterAdvancement = []
  } = categories || {};

  const categorized = {
    actions: [],
    bonusActions: [],
    reactions: [],
    specialActions: [],
    characterAdvancement: []
  };

   // Guard against null/undefined items
  if (!items || !Array.isArray(items)) {
  return categorized;
  }

  // If reverseOrder is true, process from last to first (highest level first)
  const itemsToProcess = reverseOrder ? [...items].reverse() : items;

  const categoryDefs = { actions, bonusActions, reactions, characterAdvancement };

  itemsToProcess.forEach(item => {
    if (!item) return;

    const itemSummary = buildItemSummary(item, descriptionField);

    // Categorize by casting_time for features that have automations with casting_time
    if (categorizeByCastingTime(categorized, item, itemSummary, characterAdvancement)) return;

    categorizeByCategoryDefinitions(categorized, item, itemSummary, categoryDefs);
  });

  return categorized;
};

/**
 * Categorize features from class levels into the defined categories.
 * Flattens features from all levels up to the given max level,
 * maintaining reverse order (highest level first).
 *
 * @param {Array} levels - Array of level objects with optional `features` arrays
 * @param {Object} categories - Category definitions from feature-categories file
 * @param {Object} options - Optional configuration passed to categorizeFeatures
 * @returns {Object} Categorized features
 */
export const addFeatures = (levels, categories, options = {}) => {
  const allFeatures = [];
  for (let i = levels.length - 1; i >= 0; i--) {
    allFeatures.push(...(levels[i].features || []));
  }
  return categorizeFeatures(allFeatures, categories, options);
};

/**
 * Merge two categorized feature objects, deduplicating by name in each category.
 *
 * @param {Object} base - Base categorized features
 * @param {Object} additional - Additional categorized features to merge
 * @returns {Object} Merged categorized features
 */
export const mergeCategorizedFeatures = (base, additional) => {
  const uniqBy = (arr, key) => {
    const seen = new Set();
    return arr.filter(item => {
      const value = item[key];
      return seen.has(value) ? false : seen.add(value);
    });
  };

  return {
    actions: uniqBy([...base.actions, ...additional.actions], 'name'),
    bonusActions: uniqBy([...base.bonusActions, ...additional.bonusActions], 'name'),
    reactions: uniqBy([...base.reactions, ...additional.reactions], 'name'),
    specialActions: uniqBy([...base.specialActions, ...additional.specialActions], 'name'),
    characterAdvancement: uniqBy([...base.characterAdvancement, ...additional.characterAdvancement], 'name')
};
};
