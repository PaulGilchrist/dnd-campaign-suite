import { REQUIRED_FIELDS } from './constants.js';
import { loadValidationRules } from '../services/ui/dataLoader.js';

/**
 * Synchronous point buy costs lookup (5e)
 * These are the standard D&D 5e point buy costs.
 */
const POINT_BUY_COSTS_5E = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

/**
 * Synchronous point buy costs lookup (2024)
 */
const POINT_BUY_COSTS_2024 = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 6, 14: 7, 15: 9 };

/**
 * Get point buy costs synchronously
 * @param {string} ruleset - '5e' or '2024'
 * @returns {object} - Point buy costs object
 */
export function getPointBuyCostsSync(ruleset = '5e') {
  return ruleset === '2024' ? POINT_BUY_COSTS_2024 : POINT_BUY_COSTS_5E;
}

/**
 * Get point buy costs (async, loads from JSON)
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<object>} - Point buy costs object
 */
export async function getPointBuyCosts(ruleset = '5e') {
  const rules = await loadValidationRules(ruleset);
  return rules.point_buy?.costs || POINT_BUY_COSTS_5E;
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
  const newErrors = {};
  
  // Step 2: Basic Information - validate name, level, alignment, and background (2024)
  if (step === 2) {
    if (!formData.name?.trim()) {
      newErrors.name = 'Character name is required';
    }
    
    // Validate level using rules from JSON
    const levelErrors = await validateLevel(formData.level, ruleset);
    Object.assign(newErrors, levelErrors);
    
    if (!formData.alignment) {
      newErrors.alignment = 'Alignment is required';
      }
    if (ruleset === '2024' && !formData.background) {
      newErrors.background = 'Background is required';
    }
  }
  
  // Step 3: Race & Class - validate race, class, subrace and subclass
  if (step === 3) {
    if (!formData.race || !formData.race.name) {
      newErrors.race = 'Race is required';
    }
    if (!formData.class || !formData.class.name) {
      newErrors.class = 'Class is required';
    }
    
    // Check if subrace is required (when race has subraces)
    if (formData.race?.name) {
      const selectedRace = racesData.find(race => race.name === formData.race.name);
      const availableSubraces = selectedRace?.subraces || [];
      if (availableSubraces.length > 0) {
        if (!formData.race.subrace || !formData.race.subrace.name) {
          newErrors.subrace = 'Subrace is required';
        }
      }
    }
    
    // Check if subclass is required (when class has subclasses)
    if (formData.class?.name) {
      const selectedClass = classSubtypes.find(cs => cs.className === formData.class.name);
      const availableSubclasses = selectedClass?.subtypes || [];
      if (availableSubclasses.length > 0) {
        if (!formData.class.subclass || !formData.class.subclass.name) {
          newErrors.subclass = 'Subclass is required';
        }
      }
    }
  }
  
    // Steps 4+ (Feats, Abilities, Skills, etc.) should NOT block progression
  // Validation warnings for these steps are informational only, not blocking
  // The Next button should only be disabled for steps 1-3 which have required fields
  
  return newErrors;
}

/**
 * Validate final form data
 * @param {object} formData - Form data
 * @returns {object} - Final errors object
 */
export const validateFinalFormData = (formData) => {
  const finalErrors = {};
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

