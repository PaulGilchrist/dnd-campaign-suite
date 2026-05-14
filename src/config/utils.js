import { REQUIRED_FIELDS } from './constants.js';
import { loadValidationRules as loadValidationRulesFromService } from '../services/data-loader.js';

/**
 * Load validation rules from JSON file (uses centralized data-loader)
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<object>} - Validation rules object
 */
async function loadValidationRules(ruleset = '5e') {
  return loadValidationRulesFromService(ruleset);
}

/**
 * Get point buy costs (async, loads from JSON)
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<object>} - Point buy costs object
 */
export async function getPointBuyCosts(ruleset = '5e') {
  const rules = await loadValidationRules(ruleset);
  return rules.point_buy?.costs || {};
}

/**
 * Calculate point buy cost for a score
 * @param {number} baseScore - The base ability score
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<number>} - Point buy cost
 */
export async function calculatePointBuyCost(baseScore, ruleset = '5e') {
  const costs = await getPointBuyCosts(ruleset);
  const score = parseInt(baseScore) || 8;
  return costs[score] || 0;
}

/**
 * Calculate total score for an ability
 * @param {object} ability - Ability object with baseScore, abilityImprovements, miscBonus
 * @returns {number} - Total score
 */
export const calculateTotalScore = (ability) => {
  const base = parseInt(ability.baseScore) || 8;
  const improvements = parseInt(ability.abilityImprovements) || 0;
  const misc = parseInt(ability.miscBonus) || 0;
  return base + improvements + misc;
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
  if (parseInt(ability.abilityImprovements) < 0) {
    errors.abilityImprovements = 'Improvements must be 0 or above';
  }
  if (parseInt(ability.miscBonus) < 0) {
    errors.miscBonus = 'Misc bonus must be 0 or above';
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

/**
 * Get feat availability rules (async, loads from JSON)
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<object>} - Feat rules object
 */
export async function getFeatRules(ruleset = '5e') {
  const rules = await loadValidationRules(ruleset);
  return rules.feats || {};
}

/**
 * Get background language rules (async, loads from JSON)
 * @param {string} ruleset - '5e' or '2024'
 * @returns {Promise<number>} - Number of background languages
 */
export async function getBackgroundLanguageCount(ruleset = '5e') {
  const rules = await loadValidationRules(ruleset);
  return rules.background_languages ?? 2;
}

/**
 * Get all skills from ability-scores.json
 * @param {string} ruleset - '5e' or '2024' (currently skills are the same for both)
 * @returns {Promise<string[]>} - Array of skill names
 */
export async function getSkillsFromAbilityScores() {
  try {
    const path = '/data/ability-scores.json';
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ability-scores.json`);
      }
    const data = await response.json();
     // Extract all skills from ability scores
    const skills = new Set();
    data.forEach(ability => {
      if (ability.skills) {
        ability.skills.forEach(skill => skills.add(skill));
         }
       });
    return Array.from(skills);
    } catch (error) {
    console.error('Error loading ability-scores.json:', error);
     // Fallback to default skills if JSON fails to load
    return [
      'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
      'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
      'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
      'Sleight of Hand', 'Stealth', 'Survival'
      ];
    }
}

/**
 * Get ability score names from ability-scores.json
 * @returns {Promise<string[]>} - Array of ability score full names
 */
export async function getAbilityNamesFromJson() {
  try {
    const path = '/data/ability-scores.json';
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ability-scores.json`);
      }
    const data = await response.json();
    return data.map(ability => ability.full_name);
    } catch (error) {
    console.error('Error loading ability-scores.json:', error);
     // Fallback to default ability names
    return ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
    }
}
