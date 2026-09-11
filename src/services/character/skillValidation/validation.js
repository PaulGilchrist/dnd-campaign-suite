import { fetchClassData, fetchRaceData, fetchBackgroundData } from '../../ui/dataLoader.js';
import { parseSkillProficiencies } from './parse-skills.js';

/**
 * Validates skill selections and returns warnings (not blocking errors)
 * @param {object} formData - The character form data
 * @param {Array} allFeats - Array of all feat data objects
 * @returns {Promise<Array<{message: string, type: 'warning'|'info'}>>}
 */
export async function validateSkills(formData, allFeats) {
  const { getSkillLimits, getExpertiseLimits } = await import('./index.js');

  const warnings = [];
  const selectedSkills = formData.skillProficiencies || [];
  const expertSkills = formData.expertSkills || [];
  const _ruleset = formData.rules || '5e';
  void _ruleset;

  // Get skill limits
  const limits = await getSkillLimits(formData, allFeats);
  const expertiseLimits = await getExpertiseLimits(formData, allFeats);

  // Validate skill selections against allowed pools
  if (limits.skillChoiceSources && limits.skillChoiceSources.length > 0) {
    const skillSourceMap = buildSkillSourceMap(limits.skillChoiceSources);

    warnSkillsOutsidePools(warnings, selectedSkills, skillSourceMap, limits);

    // Count how many selected skills come from each source
    // For overlapping skills, assign them to the source that needs them most
    const { sourceCounts, assignedSkills } = assignSkillsToSources(selectedSkills, limits.skillChoiceSources, skillSourceMap);

    warnSourceOverSelection(warnings, sourceCounts, selectedSkills, assignedSkills, limits);
  }

  // Check if too many skills selected
  if (selectedSkills.length > limits.allowed) {
    warnings.push({
      message: `Rules allow ${limits.allowed} skill proficiency/ies. You have selected ${selectedSkills.length}. (${limits.details})`,
      type: 'warning'
    });
  }

  // Check if too few skills selected (info, not warning)
  if (selectedSkills.length < limits.allowed && selectedSkills.length > 0) {
    warnings.push({
      message: `You can select up to ${limits.allowed} skill proficiencies. You have selected ${selectedSkills.length}.`,
      type: 'info'
    });
  }

  // Check expertise validity
  if (expertSkills.length > 0) {
    // Check if expertise is allowed for this class
    if (!expertiseLimits.allowed) {
      warnings.push({
        message: `Expertise is not available for ${formData.class?.name || 'this class'}. Expertise is typically a Bard or Rogue feature.`,
        type: 'warning'
      });
    }

    // Check if too many expertise selections
    if (expertSkills.length > expertiseLimits.count) {
      warnings.push({
        message: `You can have expertise in ${expertiseLimits.count} skill(s). You have selected ${expertSkills.length}. (${expertiseLimits.details})`,
        type: 'warning'
      });
    }

    // Check if all expert skills are also proficient
    const nonProficientExperts = expertSkills.filter(skill => !selectedSkills.includes(skill));
    if (nonProficientExperts.length > 0) {
      warnings.push({
        message: `Expertise requires proficiency first. These skills are not proficient: ${nonProficientExperts.join(', ')}`,
        type: 'warning'
      });
    }

    warnFeatRestrictedExpertise(warnings, expertSkills, expertiseLimits);
    warnClassRestrictedExpertise(warnings, expertSkills, expertiseLimits);
  }

  // Check for duplicate skills in selection
  const uniqueSkills = new Set(selectedSkills);
  if (uniqueSkills.size < selectedSkills.length) {
    warnings.push({
      message: `Some skills are selected multiple times. Each skill should only be selected once.`,
      type: 'warning'
    });
  }

  return warnings;
}

// Build a map of which sources each skill belongs to
function buildSkillSourceMap(skillChoiceSources) {
  const skillSourceMap = new Map();
  skillChoiceSources.forEach(source => {
    source.skills.forEach(skill => {
      if (!skillSourceMap.has(skill)) {
        skillSourceMap.set(skill, []);
      }
      skillSourceMap.get(skill).push(source);
    });
  });
  return skillSourceMap;
}

// Check each selected skill belongs to at least one allowed pool
// Skills outside pools are OK if Skilled can cover them
function warnSkillsOutsidePools(warnings, selectedSkills, skillSourceMap, limits) {
  const skilledUsesForOutsideCheck = limits.skilledUsesAvailable || 0;
  const skillsOutsidePools = selectedSkills.filter(skill => {
    const sources = skillSourceMap.get(skill);
    return !sources || sources.length === 0;
  });
  if (skillsOutsidePools.length <= skilledUsesForOutsideCheck) {
    return;
  }
  const excess = skillsOutsidePools.length - skilledUsesForOutsideCheck;
  const outsideMsg = skillsOutsidePools.length === excess
    ? `The following skills are not available from your class/race/feat choices: ${skillsOutsidePools.join(', ')}. Only select from allowed skill pools.`
    : `The following skills are not available from your class/race/feat choices and exceed Skilled uses: ${skillsOutsidePools.join(', ')}.`;
  warnings.push({
    message: outsideMsg,
    type: 'warning'
  });
}

const sourceKey = source => source.source + '_' + (source.featName || '0');

function assignSkillsToSources(selectedSkills, skillChoiceSources, skillSourceMap) {
  const sourceCounts = {};
  skillChoiceSources.forEach(source => {
    sourceCounts[sourceKey(source)] = {
      source: source,
      count: 0,
    };
  });

  // Track which selected skills have been assigned
  const assignedSkills = new Set();

  // First pass: assign skills that only belong to one source
  skillChoiceSources.forEach(source => {
    const key = sourceKey(source);
    const sourceSkillSet = new Set(source.skills);
    selectedSkills.forEach(skill => {
      if (assignedSkills.has(skill)) return;
      const sourcesForSkill = skillSourceMap.get(skill) || [];
      const isOnlySource = sourcesForSkill.length === 1 && sourcesForSkill[0].source === source.source && sourcesForSkill[0].featName === source.featName;
      if (sourceSkillSet.has(skill) && isOnlySource) {
        sourceCounts[key].count++;
        assignedSkills.add(skill);
      }
    });
  });

  // Second pass: assign remaining skills to any source that contains them
  selectedSkills.forEach(skill => {
    if (assignedSkills.has(skill)) return;
    const sourcesForSkill = skillSourceMap.get(skill) || [];
    sourcesForSkill.forEach(source => {
      const key = sourceKey(source);
      if (sourceCounts[key] && sourceCounts[key].count < source.count) {
        sourceCounts[key].count++;
        assignedSkills.add(skill);
      }
    });
  });

  return { sourceCounts, assignedSkills };
}

// Check for over-selection from any source, but allow Skilled to cover overflow
function warnSourceOverSelection(warnings, sourceCounts, selectedSkills, assignedSkills, limits) {
  // Calculate how many skills are covered by Skilled
  const skilledUsesAvailable = limits.skilledUsesAvailable || 0;
  const unassignedCount = selectedSkills.length - assignedSkills.size;
  let skilledCanCover = Math.min(unassignedCount, skilledUsesAvailable);

  const overSelectionWarnings = [];
  Object.values(sourceCounts).forEach(({ source, count }) => {
    if (count > source.count) {
      const excess = count - source.count;
      if (skilledCanCover >= excess) {
        skilledCanCover -= excess;
      } else {
        const label = source.featName || source.source;
        overSelectionWarnings.push(`Too many from ${label}: ${count} selected, only ${source.count} allowed`);
      }
    }
  });
  if (overSelectionWarnings.length > 0) {
    warnings.push({
      message: overSelectionWarnings.join('. '),
      type: 'warning'
    });
  }
}

// Check that feat-restricted expertise skills are from the allowed lists
function warnFeatRestrictedExpertise(warnings, expertSkills, expertiseLimits) {
  if (!expertiseLimits?.featExpertiseSkillLists) {
    return;
  }
  const allFeatSkills = new Set(expertiseLimits.featExpertiseSkillLists.flat().map(s => s.trim()));
  const featExpertSkills = expertSkills.filter(skill => allFeatSkills.has(skill));
  const classExpertSkills = expertSkills.filter(skill => !allFeatSkills.has(skill));

  const featSlotsUsed = Math.min(featExpertSkills.length, expertiseLimits.featCount || 0);
  const classSlotsUsed = classExpertSkills.length;
  const totalExpertiseUsed = featSlotsUsed + classSlotsUsed;
  if (totalExpertiseUsed > expertiseLimits.count) {
    warnings.push({
      message: `You have selected ${expertSkills.length} skill(s) for expertise but only have ${expertiseLimits.count} slot(s) available. (${expertiseLimits.details})`,
      type: 'warning'
    });
  }
}

// Check that class-restricted expertise skills (e.g., Scholar's six skills) are from the allowed lists
function warnClassRestrictedExpertise(warnings, expertSkills, expertiseLimits) {
  if (!expertiseLimits?.classExpertiseSkillLists) {
    return;
  }
  const allClassSkills = new Set(expertiseLimits.classExpertiseSkillLists.flat().map(s => s.trim()));
  const allFeatSkills = new Set((expertiseLimits.featExpertiseSkillLists || []).flat().map(s => s.trim()));
  const hasFreeFeatSlots = (expertiseLimits.featCount || 0) > (expertSkills.filter(skill => allFeatSkills.has(skill)).length);
  const invalidClassExperts = expertSkills.filter(skill => !allClassSkills.has(skill) && !allFeatSkills.has(skill));
  if (invalidClassExperts.length > 0 && !hasFreeFeatSlots) {
    warnings.push({
      message: `Class expertise is limited to: ${[...allClassSkills].join(', ')}. Not eligible: ${invalidClassExperts.join(', ')}`,
      type: 'warning'
    });
  } else if (invalidClassExperts.length > 0) {
    warnings.push({
      message: `${invalidClassExperts.join(', ')} is not in your class expertise list (${[...allClassSkills].join(', ')}); it can only use a feat expertise slot.`,
      type: 'warning'
    });
  }
}

/**
 * Gets skill proficiency information for display
 * @param {string} skillName - Name of the skill
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { isAllowed: boolean, source: string, isPreSelected: boolean }
 */
export async function getSkillInfo(skillName, formData) {
  const ruleset = formData.rules || '5e';
  const sources = [];
  let isPreSelected = false;

  // Check if skill comes from class
  if (formData.class?.name) {
    const classData = await fetchClassData(formData.class.name, ruleset);
    const classSkills = parseSkillProficiencies(classData, ruleset);
    if (classSkills.skills.includes(skillName)) {
      sources.push('Class');
      if (!classSkills.isChoice) {
        isPreSelected = true;
      }
    }
  }

  // Check if skill comes from race
  if (formData.race?.name) {
    const raceData = await fetchRaceData(formData.race.name, ruleset);
    const raceSkills = parseSkillProficiencies(raceData, ruleset);
    if (raceSkills.skills.includes(skillName)) {
      sources.push('Race');
      if (!raceSkills.isChoice) {
        isPreSelected = true;
      }
    }
  }

  // Check if skill comes from background (2024 only)
  if (formData.background && ruleset === '2024') {
    const backgroundData = await fetchBackgroundData(formData.background, '2024');
    const bgSkills = parseSkillProficiencies(backgroundData, '2024');
    if (bgSkills.skills.includes(skillName)) {
      sources.push('Background');
      if (!bgSkills.isChoice) {
        isPreSelected = true;
      }
    }
  }

  return {
    isAllowed: sources.length > 0,
    source: sources.join(', '),
    isPreSelected
  };
}
