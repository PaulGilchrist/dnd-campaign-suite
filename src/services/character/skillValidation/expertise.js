import { fetchClassData } from '../../ui/dataLoader.js';
import { countFeatExpertiseSlots, getFeatExpertiseSkillLists, formatFeatExpertiseDetails } from './feat-helpers.js';

/**
 * Determines if expertise is allowed and how many expertise slots are available
 * Reads from class JSON data instead of hardcoded rules
 * @param {object} formData - The character form data
 * @param {Array} allFeats - Array of all feat data objects (may be empty during initial load)
 * @returns {Promise<object>} - { allowed: boolean, count: number, details: string }
 */
export async function getExpertiseLimits(formData, allFeats) {
  const ruleset = formData.rules || '5e';
  const className = formData.class?.name || '';
  const level = formData.level || 1;

  if (!className) {
    return getExpertiseLimitsNoClass(formData, allFeats);
  }

  // Load class data from JSON
  const classData = await fetchClassData(className, ruleset);
  if (!classData || !classData.class_levels) {
    return getExpertiseLimitsNoClassData(formData, allFeats, className);
  }

  const { totalCount, restrictedLists } = collectClassExpertise(classData, formData, ruleset, level);

  return buildExpertiseResult(formData, allFeats, totalCount, restrictedLists);
}

/**
 * Searches class levels (and 2024 majors / 5e subclass levels) for
 * expertise features granted up to the given level.
 * @returns {{ totalCount: number, restrictedLists: Array<Array<string>>|null }}
 */
function collectClassExpertise(classData, formData, ruleset, level) {
  let totalCount = 0;
  const classExpertiseSkillLists = [];
  let hasUnrestrictedClassSource = false;

  const consumeExpertiseFeature = (feature) => {
    const featureCount = countExpertiseFromFeature(feature);
    if (featureCount <= 0) return;
    totalCount += featureCount;
    const restrictedList = parseClassExpertiseSkillList(feature);
    if (restrictedList) {
      classExpertiseSkillLists.push(restrictedList);
    } else {
      hasUnrestrictedClassSource = true;
    }
  };

  for (const classLevel of classData.class_levels) {
    if (classLevel.level > level) {
      break;
    }

    // Check features in this level
    const features = classLevel.features || [];
    for (const feature of features) {
      consumeExpertiseFeature(feature);
    }
  }

  const subclass = formData.class?.subclass?.name;
  // Also check subclass/majors features for 2024
  if (ruleset === '2024' && classData.majors && subclass) {
    consumeExpertiseFromMajors(classData.majors, subclass, level, consumeExpertiseFeature);
  }
  // For 5e, also check subclasses
  if (ruleset === '5e' && classData.subclasses && subclass) {
    consumeExpertiseFromSubclasses(classData.subclasses, subclass, level, consumeExpertiseFeature);
  }

  const restrictedLists = (!hasUnrestrictedClassSource && classExpertiseSkillLists.length > 0)
    ? classExpertiseSkillLists
    : null;

  return { totalCount, restrictedLists };
}

function consumeExpertiseFromMajors(majors, subclass, level, consumeExpertiseFeature) {
  const subclassData = majors.find(m => m.name === subclass);
  if (!subclassData?.features) {
    return;
  }
  for (const feature of subclassData.features) {
    if (feature.level <= level) {
      consumeExpertiseFeature(feature);
    }
  }
}

function consumeExpertiseFromSubclasses(subclasses, subclass, level, consumeExpertiseFeature) {
  const subclassData = subclasses.find(s => s.name === subclass);
  if (!subclassData?.class_levels) {
    return;
  }
  for (const classLevel of subclassData.class_levels) {
    if (classLevel.level <= level) {
      const features = classLevel.features || [];
      for (const feature of features) {
        consumeExpertiseFeature(feature);
      }
    }
  }
}

/**
 * Parses a restricted skill list from a class feature description that grants
 * expertise from an enumerated set (e.g., Wizard 2024 Scholar: "Choose one of
 * the following skills in which you have proficiency: Arcana, History, ...")
 * @param {object} feature - The feature data object
 * @returns {Array<string>|null} Restricted skill names, or null if unrestricted
 */
export function parseClassExpertiseSkillList(feature) {
  const explicitList = feature?.feature_specific?.expertise?.skills;
  if (Array.isArray(explicitList) && explicitList.length > 0) {
    return explicitList.map(s => String(s).trim()).filter(s => s.length > 0);
  }

  const desc = feature?.description || '';
  if (!/\bexpertise\b/i.test(desc)) return null;

  const match = desc.match(/choose\s+(?:one|two|three|\d+)\s+of\s+the\s+following\s+skills[^:]*:\s*(.+?)\./i);
  if (!match) return null;

  const skills = match[1]
    .split(/,\s*(?:(?:and|or)\s+)?|(?:\s+and\s+|\s+or\s+)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return skills.length > 0 ? skills : null;
}

/**
 * Counts expertise from a single feature object
 * @param {object} feature - The feature data object
 * @returns {number} Expertise count from this feature
 */
function countExpertiseFromFeature(feature) {
  // Check for expertise in feature_specific
  if (feature.feature_specific?.expertise) {
    return feature.feature_specific.expertise.count || 0;
  }

  // Also check if the feature name contains "Expertise"
  if (feature.name && feature.name.includes('Expertise')) {
    // Parse the description for count
    const match = feature.description?.match(/choose\s+(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    // Default to 2 if not specified
    return 2;
  }

  // Check for Scholar feature (Wizard 2024) which grants 1 expertise
  if (feature.name === 'Scholar' && feature.description?.includes('Expertise')) {
    return 1;
  }

  // Also check feature descriptions for expertise grants (e.g., Ranger "Deft Explorer")
  if (feature.description?.match(/\bexpertise\b/i)) {
    // Check for "choose X" pattern
    const chooseMatch = feature.description.match(/choose\s+(\d+)/i);
    if (chooseMatch) {
      return parseInt(chooseMatch[1], 10);
    }
    // Check for "gain expertise" pattern (1 expertise)
    if (feature.description.match(/\bgain\s+expertise\b/i)) {
      return 1;
    }
    // Default to 1 if description mentions expertise but no count
    return 1;
  }

  return 0;
}

/**
 * Handles expertise limits when no class is selected
 */
async function getExpertiseLimitsNoClass(formData, allFeats) {
  const featSlots = await countFeatExpertiseSlots(formData, allFeats);
  const featExpertiseSkillLists = await getFeatExpertiseSkillLists(formData, allFeats);
  if (featSlots > 0) {
    let details = `Feats grant ${featSlots} expertise slot(s)`;
    if (featExpertiseSkillLists) {
      const featDetails = formatFeatExpertiseDetails(formData.feats || [], allFeats);
      if (featDetails) {
        details += `. ${featDetails}`;
      }
    }
    return {
      allowed: true,
      count: featSlots,
      classCount: 0,
      featCount: featSlots,
      classExpertiseSkillLists: null,
      featExpertiseSkillLists,
      details,
    };
  }
  return {
    allowed: false,
    count: 0,
    classCount: 0,
    featCount: 0,
    classExpertiseSkillLists: null,
    featExpertiseSkillLists: null,
    details: 'No class selected'
  };
}

/**
 * Handles expertise limits when class data has no class_levels
 */
async function getExpertiseLimitsNoClassData(formData, allFeats, className) {
  const featSlots = await countFeatExpertiseSlots(formData, allFeats);
  const featExpertiseSkillLists = await getFeatExpertiseSkillLists(formData, allFeats);
  if (featSlots > 0) {
    let details = `Feats grant ${featSlots} expertise slot(s)`;
    if (featExpertiseSkillLists) {
      const featDetails = formatFeatExpertiseDetails(formData.feats || [], allFeats);
      if (featDetails) {
        details += `. ${featDetails}`;
      }
    }
    return {
      allowed: true,
      count: featSlots,
      classCount: 0,
      featCount: featSlots,
      classExpertiseSkillLists: null,
      featExpertiseSkillLists,
      details,
    };
  }
  return {
    allowed: false,
    count: 0,
    classCount: 0,
    featCount: 0,
    classExpertiseSkillLists: null,
    featExpertiseSkillLists: null,
    details: `Expertise is not available for ${className}`
  };
}

/**
 * Builds the final expertise result object
 */
async function buildExpertiseResult(formData, allFeats, totalCount, classExpertiseSkillLists) {
  const className = formData.class?.name || '';
  const level = formData.level || 1;
  const featSlots = await countFeatExpertiseSlots(formData, allFeats);
  const featExpertiseSkillLists = await getFeatExpertiseSkillLists(formData, allFeats);

  // Build details string with feat-specific skill lists
  let details = `${className} can have expertise in ${totalCount} skill(s) at level ${level}`;
  if (featSlots > 0) {
    details += ` + ${featSlots} from feats`;
  }
  if (classExpertiseSkillLists) {
    details += `. Class expertise is limited to: ${classExpertiseSkillLists.flat().join(', ')}`;
  }
  if (featExpertiseSkillLists) {
    const featDetails = formatFeatExpertiseDetails(formData.feats || [], allFeats);
    if (featDetails) {
      details += `. ${featDetails}`;
    }
  }

  return {
    allowed: totalCount > 0 || featSlots > 0,
    count: totalCount + featSlots,
    classCount: totalCount,
    featCount: featSlots,
    classExpertiseSkillLists: classExpertiseSkillLists || null,
    featExpertiseSkillLists: featExpertiseSkillLists,
    details
  };
}
