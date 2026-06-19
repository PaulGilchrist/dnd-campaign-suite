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
export const categorizeFeatures = (items, categories, options = {}) => {
  const {
    descriptionField = 'description',
    reverseOrder = false
  } = options;

  const {
    actions,
    bonusActions,
    reactions,
    characterAdvancement
  } = categories;

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

  itemsToProcess.forEach(item => {
    if (!item) return;

    const itemSummary = {
      name: item.name,
      description: item[descriptionField],
      details: item.details,
      automation: item.automation
    };

    // Categorize by casting_time for features that have automations with casting_time
    let castingTime = item.automation?.casting_time;
    if (!castingTime && Array.isArray(item.automation) && item.automation.length > 0) {
      const firstAuto = item.automation.find(a => a?.casting_time);
      if (firstAuto) {
        castingTime = firstAuto.casting_time;
      }
    }
    if (castingTime) {
      const ct = castingTime.toLowerCase().trim();
      if ((ct === '1 action' || ct === 'action') && !categorized.actions.some(f => f.name === item.name)) {
        categorized.actions.push(itemSummary);
      } else if ((ct === '1 bonus action' || ct === 'bonus action') && !categorized.bonusActions.some(f => f.name === item.name)) {
        categorized.bonusActions.push(itemSummary);
      } else if ((ct === '1 reaction' || ct === 'reaction') && !categorized.reactions.some(f => f.name === item.name)) {
        categorized.reactions.push(itemSummary);
      } else if (ct === 'passive' && !categorized.characterAdvancement.some(f => f.name === item.name)) {
        categorized.characterAdvancement.push(itemSummary);
      } else if (!categorized.specialActions.some(f => f.name === item.name)) {
        categorized.specialActions.push(itemSummary);
      }
      return;
    }

    // Fallback: Categorize based on category definitions (name-based, for features without automation)
    if (characterAdvancement.includes(item.name) && !categorized.characterAdvancement.some(f => f.name === item.name)) {
      categorized.characterAdvancement.push(itemSummary);
    } else if (actions.includes(item.name) && !categorized.actions.some(action => action.name === item.name)) {
      categorized.actions.push(itemSummary);
    } else if (bonusActions.includes(item.name) && !categorized.bonusActions.some(bonusAction => bonusAction.name === item.name)) {
      categorized.bonusActions.push(itemSummary);
    } else if (reactions.includes(item.name) && !categorized.reactions.some(reaction => reaction.name === item.name)) {
      categorized.reactions.push(itemSummary);
    } else if (!categorized.specialActions.some(specialAction => specialAction.name === item.name)) {
      categorized.specialActions.push(itemSummary);
     }
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
