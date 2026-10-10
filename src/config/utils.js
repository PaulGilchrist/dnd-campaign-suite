import { get } from 'lodash';
import { REQUIRED_FIELDS } from './constants.js';
import { loadValidationRules, getCachedPointBuyCosts } from '../services/ui/dataLoader.js';
import { computeRaceBuffs } from '../services/character/raceBuffService.js';

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
const getBaseScore = (ability) => parseInt(ability.baseScore) || 8;

const calculateTotalScore = (ability) => {
  const base = getBaseScore(ability);
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
const resolveAbilityThresholds = (rules, level) => {
  const maxTotalRule = level >= 20
    ? { path: 'ability_score_max.level_20', fallback: 24 }
    : { path: 'point_buy.max_total_score', fallback: 20 };
  return {
    minBase: get(rules, 'point_buy.min_base_score') ?? 8,
    maxBase: get(rules, 'point_buy.max_base_score') ?? 15,
    maxTotal: get(rules, maxTotalRule.path) ?? maxTotalRule.fallback,
  };
};

const abilityScoreChecks = (ability, baseScore, totalScore, thresholds) => [
  { key: 'baseScore', failed: baseScore < thresholds.minBase, message: `Base score must be at least ${thresholds.minBase}` },
  { key: 'baseScore', failed: baseScore > thresholds.maxBase, message: `Base score cannot exceed ${thresholds.maxBase} (point buy max)` },
  { key: 'totalScore', failed: totalScore > thresholds.maxTotal, message: `Total score (base + improvements + misc) cannot exceed ${thresholds.maxTotal}` },
  { key: 'miscIncrease', failed: parseInt(ability.miscIncrease) < 0, message: 'Misc bonus must be 0 or above' },
];

const computeAbilityTotalCap = (rules, level, allFeats, selectedFeats, ruleset) => {
  let cap = get(rules, level >= 20 ? 'ability_score_max.level_20' : 'point_buy.max_total_score') ?? (level >= 20 ? 24 : 20);
  const selectedNames = (selectedFeats || []).map(f => (typeof f === 'string' ? f : f?.name));
  (allFeats || []).forEach(feat => {
    if (!selectedNames.includes(feat.name)) return;
    const maxValue = feat.ability_score_increase?.max_value;
    if (ruleset === '2024' && typeof maxValue === 'number' && maxValue > cap) {
      cap = maxValue;
    } else if (ruleset === '5e' && typeof feat.description === 'string' && /maximum of 30/i.test(feat.description)) {
      cap = 30;
    }
  });
  return cap;
};

const computeRacialIncreases = (formData, racesData, ruleset) => {
  const racialIncreases = {};
  if (ruleset !== '5e' || !formData?.race?.name) return racialIncreases;
  const fullRace = (racesData || []).find(r => r.name === formData.race.name);
  if (!fullRace) return racialIncreases;
  const raceBuffs = computeRaceBuffs(fullRace, { race: { name: fullRace.name, subrace: formData.race.subrace || null }, rules: ruleset }, '5e');
  raceBuffs.abilityScoreIncreases.forEach(b => { racialIncreases[b.name] = (racialIncreases[b.name] || 0) + b.amount; });
  if (formData.race.subrace?.name) {
    const subraceBuffs = computeRaceBuffs(fullRace, { race: { subrace: { name: formData.race.subrace.name } } }, '5e');
    subraceBuffs.abilityScoreIncreases.forEach(b => { racialIncreases[b.name] = (racialIncreases[b.name] || 0) + b.amount; });
  }
  return racialIncreases;
};

/**
 * Gate total ability scores against the effective cap (base + feat + background + misc + racial).
 * Blocks wizard Save/Next while any allocation would exceed the cap (FT-001).
 */
export async function validateAbilityTotals(formData, { allFeats = [], racesData = [], ruleset } = {}) {
  const errors = {};
  const abilities = formData?.abilities || [];
  if (abilities.length === 0) return errors;
  const rs = ruleset || formData.rules || '5e';
  const rules = await loadValidationRules(rs);
  const cap = computeAbilityTotalCap(rules, formData.level || 1, allFeats, formData.feats, rs);
  const racialIncreases = computeRacialIncreases(formData, racesData, rs);
  abilities.forEach((ability, index) => {
    const totalScore = calculateTotalScore(ability) + (racialIncreases[ability.name] || 0);
    if (totalScore > cap) {
      errors[`ability_${index}_totalScore`] = `${ability.name} total ${totalScore} exceeds the maximum of ${cap}`;
    }
  });
  return errors;
}

export async function validateAbility(ability, index, ruleset = '5e', level = 1) {
  const rules = await loadValidationRules(ruleset);
  const errors = {};
  const baseScore = getBaseScore(ability);
  const totalScore = calculateTotalScore(ability);
  const thresholds = resolveAbilityThresholds(rules, level);

  for (const check of abilityScoreChecks(ability, baseScore, totalScore, thresholds)) {
    if (check.failed) {
      errors[check.key] = check.message;
    }
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

export const DUPLICATE_CHARACTER_NAME_ERROR = 'A character with that name already exists';

/**
 * Case-insensitive duplicate-name lookup over existing character names
 * (mirrors the NPCs/Quests/Factions duplicate guards).
 * @param {string} name - Proposed character name
 * @param {Array<string>} existingNames - Names of characters already in the campaign
 * @returns {boolean} true when the name collides with an existing character
 */
export function hasDuplicateCharacterName(name, existingNames = []) {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return existingNames.some(n => (n || '').trim().toLowerCase() === lower);
}

const validateBasicsStep = async (formData, context) => {
  const newErrors = {};
  if (!formData.name?.trim()) {
    newErrors.name = 'Character name is required';
  } else if (hasDuplicateCharacterName(formData.name, context.existingNames)) {
    newErrors.name = DUPLICATE_CHARACTER_NAME_ERROR;
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

const validateAbilitiesStep = (formData, context) => validateAbilityTotals(formData, context);

const stepValidators = {
  2: validateBasicsStep,
  3: validateRaceStep,
  4: validateSubraceStep,
  5: validateBackgroundStep,
  6: validateClassStep,
  7: validateSubclassStep,
  9: validateAbilitiesStep,
};

/**
 * Validate step data (async version that loads rules from JSON)
 * @param {number} step - Current step number
 * @param {object} formData - Form data
 * @param {object} context - Validation context
 * @param {array} context.racesData - Races data
 * @param {array} context.classSubtypes - Class subtypes data
 * @param {string} context.ruleset - '5e' or '2024'
 * @param {array} context.existingNames - Names of existing characters (duplicate guard)
 * @returns {Promise<object>} - New errors object
 */
export async function validateStep(step, formData, { racesData = [], classSubtypes = [], ruleset, existingNames = [] } = {}) {
  const validator = stepValidators[step];
  if (!validator) return {};
  return validator(formData, { racesData, classSubtypes, ruleset, existingNames });
}

/**
 * Validate final form data
 * @param {object} formData - Form data
 * @param {array} existingNames - Names of existing characters (duplicate guard)
 * @returns {object} - Final errors object
 */
export const validateFinalFormData = (formData, existingNames = []) => {
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
  if (!finalErrors.name && hasDuplicateCharacterName(formData.name, existingNames)) {
    finalErrors.name = DUPLICATE_CHARACTER_NAME_ERROR;
  }
  return finalErrors;
};

