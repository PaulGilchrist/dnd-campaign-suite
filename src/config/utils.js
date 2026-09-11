import { REQUIRED_FIELDS } from './constants.js';
import { loadValidationRules, getCachedPointBuyCosts } from '../services/ui/dataLoader.js';

/**
 * Get point buy costs synchronously from the cached JSON data.
 * Falls back to the standard 5e costs if the cache hasn't been populated yet.
 */
const DEFAULT_POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function getPointBuyCostsSync(ruleset = '5e') {
  const cached = getCachedPointBuyCosts(ruleset);
  return cached || DEFAULT_POINT_BUY_COSTS;
}

/**
 * Get point buy costs (async, loads from JSON)
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<object>} - Point buy costs object
 */
export async function getPointBuyCosts(ruleset = '5e') {
  const rules = await loadValidationRules(ruleset);
  return rules.point_buy?.costs || DEFAULT_POINT_BUY_COSTS;
}

/**
 * Calculate total score for an ability
 * @param {object} ability - Ability object with baseScore, featIncrease, backgroundIncrease, miscIncrease
 * @returns {number} - Total score
 */
const calculateTotalScore = (ability) => {
  const base = parseInt(ability.baseScore) || 8;
  const feat = parseInt(ability.featIncrease) || 0;
  const bg = parseInt(ability.backgroundIncrease) || 0;
  const misc = parseInt(ability.miscIncrease) || 0;
  return base + feat + bg + misc;
};

/**
 * Validate ability scores (async, loads rules from JSON)
 * @param {object} ability - Ability object
 * @param {number} index - Index of the ability
 * @param {string} ruleset - '5e' or '2024'
 * @param {number} level - Character level
 * @returns {Promise<object>} - Errors object
 */
export async function validateAbility(ability, index, ruleset = '5e', level = 1) {
  const rules = await loadValidationRules(ruleset);
  const errors = {};
  const baseScore = parseInt(ability.baseScore) || 8;
  const totalScore = calculateTotalScore(ability);
  
  const minBase = rules.point_buy?.min_base_score ?? 8;
  const maxBase = rules.point_buy?.max_base_score ?? 15;
  const maxTotal = level >= 20 
    ? (rules.ability_score_max?.level_20 ?? 24)
    : (rules.point_buy?.max_total_score ?? 20);

  if (baseScore < minBase) {
    errors.baseScore = `Base score must be at least ${minBase}`;
  }
  if (baseScore > maxBase) {
    errors.baseScore = `Base score cannot exceed ${maxBase} (point buy max)`;
  }
  if (totalScore > maxTotal) {
    errors.totalScore = `Total score (base + improvements + misc) cannot exceed ${maxTotal}`;
  }
  if (parseInt(ability.miscIncrease) < 0) {
    errors.miscIncrease = 'Misc bonus must be 0 or above';
  }

  return errors;
}

/**
 * Validate level range (async, loads rules from JSON)
 * @param {number} level - Character level
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<object>} - Errors object
 */
export async function validateLevel(level, ruleset = '5e') {
  const rules = await loadValidationRules(ruleset);
  const errors = {};
  const { min, max } = rules.level_range || { min: 1, max: 20 };
  
  if (!level || level < min || level > max) {
    errors.level = `Level must be between ${min} and ${max}`;
  }
  
  return errors;
}

const validateBasicsStep = async (formData, context) => {
  const newErrors = {};
  if (!formData.name?.trim()) {
    newErrors.name = 'Character name is required';
  }

  const levelErrors = await validateLevel(formData.level, context.ruleset);
  Object.assign(newErrors, levelErrors);

  if (!formData.alignment) {
    newErrors.alignment = 'Alignment is required';
  }
  return newErrors;
};

const validateRaceStep = (formData) => {
  const newErrors = {};
  if (!formData.race?.name) {
    newErrors.race = 'Race is required';
  }
  return newErrors;
};

const validateSubraceStep = (formData, context) => {
  const newErrors = {};
  if (!formData.race?.name) return newErrors;
  const availableSubraces = context.racesData.find(race => race.name === formData.race.name)?.subraces || [];
  if (availableSubraces.length > 0 && !formData.race.subrace?.name) {
    newErrors.subrace = 'Subrace is required';
  }
  return newErrors;
};

const validateBackgroundStep = (formData, context) => {
  const newErrors = {};
  if (context.ruleset === '2024' && !formData.background) {
    newErrors.background = 'Background is required';
  }
  return newErrors;
};

const validateClassStep = (formData) => {
  const newErrors = {};
  if (!formData.class?.name) {
    newErrors.class = 'Class is required';
  }
  return newErrors;
};

const validateSubclassStep = (formData, context) => {
  const newErrors = {};
  if (!formData.class?.name) return newErrors;
  const availableSubclasses = context.classSubtypes.find(cs => cs.className === formData.class.name)?.subtypes || [];
  if (availableSubclasses.length > 0 && !formData.class.subclass?.name) {
    newErrors.subclass = 'Subclass is required';
  }
  return newErrors;
};

const stepValidators = {
  2: validateBasicsStep,
  3: validateRaceStep,
  4: validateSubraceStep,
  5: validateBackgroundStep,
  6: validateClassStep,
  7: validateSubclassStep,
};

/**
 * Validate step data (async version that loads rules from JSON)
 * @param {number} step - Current step number
 * @param {object} formData - Form data
 * @param {object} errors - Existing errors
 * @param {array} racesData - Races data
 * @param {array} classSubtypes - Class subtypes data
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<object>} - New errors object
 */
export async function validateStep(step, formData, errors, racesData = [], classSubtypes = [], ruleset) {
  const validator = stepValidators[step];
  if (!validator) return {};
  return validator(formData, { racesData, classSubtypes, ruleset });
}

/**
 * Validate final form data
 * @param {object} formData - Form data
 * @returns {object} - Final errors object
 */
export const validateFinalFormData = (formData) => {
  const finalErrors = {};
  if (!formData) return finalErrors;
  REQUIRED_FIELDS.forEach(field => {
    if (field === 'abilities' || field === 'inventory' || field === 'skillProficiencies') {
      return;
    }
    if (!formData[field] || (typeof formData[field] === 'string' && !formData[field].trim())) {
      finalErrors[field] = `${field} is required`;
    }
  });
  return finalErrors;
};

