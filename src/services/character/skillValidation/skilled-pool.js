import { loadEquipment, fetchBackgroundData, fetchClassData, loadFeatData } from '../../ui/dataLoader.js';
import { parseToolChoiceString } from '../toolValidation.js';

/**
 * Computes how many total skill proficiency selections are not covered by restrictive sources.
 * These uncovered selections are assumed to come from Skilled.
 * Used by both skill and tool limits to coordinate shared Skilled pool.
 * @param {Array} skillChoiceSources - The skillChoiceSources array from getSkillLimits
 * @param {Array} selectedSkills - Array of selected skill names
 * @returns {number} Number of selected skills allocated from Skilled
 */
export function computeSkilledSkillUsage(skillChoiceSources, selectedSkills) {
  if (!skillChoiceSources || skillChoiceSources.length === 0 || !selectedSkills || selectedSkills.length === 0) {
    return 0;
  }

  const assignedSkills = new Set();
  const sourceAssignments = {};
  skillChoiceSources.forEach(s => {
    const key = s.source + '_' + (s.featName || '0');
    sourceAssignments[key] = 0;
  });

  const remainingSkills = [...selectedSkills];

  while (remainingSkills.length > 0) {
    let bestSource = null;
    let bestSize = Infinity;

    skillChoiceSources.forEach(source => {
      const key = source.source + '_' + (source.featName || '0');
      const remainingCapacity = source.count - sourceAssignments[key];
      if (remainingCapacity <= 0) return;
      const unassignedInPool = remainingSkills.filter(s =>
        source.skills.includes(s) && !assignedSkills.has(s)
      );
      if (unassignedInPool.length > 0 && source.skills.length < bestSize) {
        bestSource = source;
        bestSize = source.skills.length;
      }
    });

    if (!bestSource) break;

    const assigned = remainingSkills.find(s =>
      bestSource.skills.includes(s) && !assignedSkills.has(s)
    );
    if (!assigned) break;

    const key = bestSource.source + '_' + (bestSource.featName || '0');
    sourceAssignments[key]++;
    assignedSkills.add(assigned);
    const idx = remainingSkills.indexOf(assigned);
    remainingSkills.splice(idx, 1);
  }

  return selectedSkills.length - assignedSkills.size;
}

/**
 * Computes total Skilled usage across both skills and tools.
 * Skills: count of skillProficiencies not covered by restrictive sources
 * Tools: count of toolProficiencies not covered by category limits
 * @param {object} formData - The character form data
 * @param {Array} skillChoiceSources - The skillChoiceSources array from getSkillLimits
 * @returns {Promise<number>} Total Skilled uses consumed (skills + tools)
 */
export async function computeTotalSkilledUsage(formData, skillChoiceSources) {
  const skilledSkillUsage = computeSkilledSkillUsage(
    skillChoiceSources,
    formData.skillProficiencies || []
  );

  const skilledToolUsage = await computeSkilledToolUsageOnly(formData);

  return skilledSkillUsage + skilledToolUsage;
}

function buildToolsByCategory(equipment) {
  const toolCategories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];
  const toolsByCategory = {};
  toolCategories.forEach(cat => {
    toolsByCategory[cat] = new Set(
      equipment.filter(e =>
        e.equipment_category === 'Tools' &&
        e.tool_category === cat
      ).map(e => e.name)
    );
  });
  return toolsByCategory;
}

function applyToolProficiencySource(proficiencyString, categoryLimits, preSelectedTools) {
  const parsed = parseToolChoiceString?.(proficiencyString);
  if (parsed?.isChoice) {
    for (const cat of parsed.categories) {
      categoryLimits.set(cat, (categoryLimits.get(cat) || 0) + parsed.count);
    }
  } else {
    preSelectedTools.add(proficiencyString);
  }
}

// Feats (e.g., Chef grants Cook's Utensils)
async function collectFeatGrantedTools(selectedFeats, preSelectedTools) {
  const allFeats = await loadFeatData('2024');
  for (const featName of selectedFeats) {
    const feat = allFeats.find(f => f.name === featName || f.index === featName.toLowerCase());
    if (!feat) continue;
    const chefBenefit = feat.benefits.find(b =>
      b.type === 'proficiency' &&
      b.description &&
      /cook['\u2019]?\w*\s*utensil/i.test(b.description)
    );
    if (chefBenefit) {
      preSelectedTools.add("Cook's Utensils");
    }
  }
}

/**
 * Computes how many tool proficiency selections are not covered by category limits (i.e., from Skilled)
 * @param {object} formData - The character form data
 * @returns {Promise<number>} Number of selected tools allocated from Skilled
 */
export async function computeSkilledToolUsageOnly(formData) {
  const isPlaceholder = (t) => /^(\d+) from: (.+)$/.test(t);
  const allTools = (formData.toolProficiencies || []);

  // Load tool data and class/background limits to categorize
  const equipment = await loadEquipment();
  const ruleset = formData.rules || '5e';
  const className = formData.class?.name || '';
  const backgroundName = formData.background || '';

  if (ruleset !== '2024') {
    // Tools only exist in 2024 ruleset
    return 0;
  }

  const toolsByCategory = buildToolsByCategory(equipment);

  // Build category limits and pre-selected tools from class and background
  const categoryLimits = new Map();
  const preSelectedTools = new Set();

  if (backgroundName) {
    const bgData = await fetchBackgroundData(backgroundName, '2024');
    if (bgData?.tool_proficiencies) {
      applyToolProficiencySource(bgData.tool_proficiencies, categoryLimits, preSelectedTools);
    }
  }

  if (className) {
    const classData = await fetchClassData(className, '2024');
    if (classData?.tool_proficiencies) {
      applyToolProficiencySource(classData.tool_proficiencies, categoryLimits, preSelectedTools);
    }
  }

  if (formData.feats && formData.feats.length > 0) {
    await collectFeatGrantedTools(formData.feats, preSelectedTools);
  }

  // Filter out pre-selected and placeholder tools
  const userSelectedTools = allTools.filter(t => !preSelectedTools.has(t) && !isPlaceholder(t));

  if (userSelectedTools.length === 0) {
    return 0;
  }

  let categoryCovered = 0;
  for (const [category, limit] of categoryLimits) {
    const selectedInCategory = userSelectedTools.filter(t =>
      toolsByCategory[category]?.has(t)
    ).length;
    categoryCovered += Math.min(selectedInCategory, limit);
  }

  const result = Math.max(0, userSelectedTools.length - categoryCovered);

  return result;
}
