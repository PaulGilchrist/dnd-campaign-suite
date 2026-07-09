/**
 * Skill validation service for character creation wizard
 * Provides non-blocking warnings about skill proficiency selections
 * Supports both 5e and 2024 rulesets
 */

import { fetchClassData, fetchRaceData, fetchBackgroundData } from '../ui/dataLoader.js';

/**
 * Parses skill proficiencies from a class/race/background data object
 * Handles both "Choose X from..." format and direct skill lists
 * @param {object} data - The class/race/background data object
 * @returns {object} - { count: number, skills: string[], isChoice: boolean }
 */
function parseSkillProficiencies(data, ruleset = '5e') {
  if (!data) {
    return { count: 0, skills: [], isChoice: false };
  }

  // 2024: Check trait descriptions for skill proficiency grants
  if (ruleset === '2024' && data.traits) {
    const skills = [];
    let choiceCount = 0;
    data.traits.forEach(trait => {
      if (trait.proficiency_choices) {
        const pc = trait.proficiency_choices;
        if (pc.from && pc.from.length > 0 && pc.from[0].startsWith('Skill: ')) {
          choiceCount += pc.choose || 0;
        }
        return;
      }
      if (trait.description) {
        const match = trait.description.match(/proficiency in the ([A-Z][a-z]+(?:,|[,\s]and[,\s]|[,\s]or[,\s]|,?)[A-Za-z,\s]+?)\s*skill/i);
        if (match) {
          const skillsStr = match[1]
            .replace(/\s+and\s+/g, ',')
            .replace(/\s+or\s+/g, ',')
            .replace(/,\s*,/g, ',')
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          skillsStr.forEach(s => {
            if (!skills.includes(s)) {
              skills.push(s);
            }
          });
        }
      }
    });
    return { count: skills.length + choiceCount, skills, isChoice: choiceCount > 0 };
  }

  const skillField = data.skill_proficiencies || data.skill_proficiency_choices;
  if (!skillField) {
    return { count: 0, skills: [], isChoice: false };
  }

  // Check if it's a "Choose X from..." format
  const chooseMatch = skillField.match(/Choose\s+(\d+)/i);
  if (chooseMatch) {
    const count = parseInt(chooseMatch[1], 10);
    
    // Extract the list of available skills
    const fromMatch = skillField.match(/from\s+(.+)$/i);
    if (fromMatch) {
      const skillsString = fromMatch[1];
      // Parse skills, handling "or" before the last skill
      const skills = skillsString
         .replace(/ or ,?$/, '')
         .split(',')
         .map(s => s.trim())
         .filter(s => s.length > 0);
      
      return { count, skills, isChoice: true };
    }
    
    return { count, skills: [], isChoice: true };
  }

  // Direct skill list (e.g., "Insight and Religion" for backgrounds)
  const skills = skillField
     .replace(/ and /g, ',')
     .split(',')
     .map(s => s.trim())
     .filter(s => s.length > 0);

  return { count: skills.length, skills, isChoice: false };
}

/**
 * Gets the number of skill proficiencies allowed based on ruleset, class, race, and background
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { allowed: number, fromClass: object, fromRace: object, fromBackground: object, details: string }
 */
export async function getSkillLimits(formData) {
  const ruleset = formData.rules || '5e';
  const className = formData.class?.name || '';
  const raceName = formData.race?.name || '';
  const backgroundName = formData.background || '';

  let fromClass = { count: 0, skills: [], isChoice: true };
  let fromRace = { count: 0, skills: [], isChoice: false };
  let fromBackground = { count: 0, skills: [], isChoice: false };

  if (ruleset === '2024') {
    // 2024 rules: Class gives choice, Race gives automatic, Background gives 2 skills
    if (className) {
      const classData = await fetchClassData(className, '2024');
      fromClass = parseSkillProficiencies(classData, '2024');
    }

    if (raceName) {
      const raceData = await fetchRaceData(raceName, '2024');
      fromRace = parseSkillProficiencies(raceData, '2024');
    }

    if (backgroundName) {
      const backgroundData = await fetchBackgroundData(backgroundName);
      fromBackground = parseSkillProficiencies(backgroundData, '2024');
    }

    const totalAllowed = fromClass.count + fromRace.count + fromBackground.count;

    return {
      allowed: totalAllowed,
      fromClass,
      fromRace,
      fromBackground,
      details: `In 2024 rules, you get ${fromClass.count} skill choice(s) from your class, ${fromRace.count} from your race, and ${fromBackground.count} from your background (${totalAllowed} total)`
     };
   }

  // 5e rules: Class gives choice, Race gives automatic or choice, Background gives 2 skills
  if (className) {
    const classData = await fetchClassData(className, '5e');
    fromClass = parseSkillProficiencies(classData, '5e');
  }

  if (raceName) {
    const raceData = await fetchRaceData(raceName, '5e');
    fromRace = parseSkillProficiencies(raceData, '5e');
  }

   // 5e backgrounds typically give 2 skills but data structure may differ
   // Load from rules-validation.json for background language count
  const backgroundLangCount = 2; // Default for 5e
  fromBackground = { count: backgroundLangCount, skills: [], isChoice: true };

  const totalAllowed = fromClass.count + fromRace.count + fromBackground.count;

  return {
    allowed: totalAllowed,
    fromClass,
    fromRace,
    fromBackground,
    details: `In 5e rules, you get ${fromClass.count} skill choice(s) from your class, ${fromRace.count} from your race, and ${fromBackground.count} from your background (${totalAllowed} total)`
   };
}

/**
 * Determines which skills are pre-selected (automatically granted) from race/class/background
 * @param {object} formData - The character form data
 * @returns {Promise<string[]>} - Array of skill names that are automatically granted
 */
export async function getPreSelectedSkills(formData) {
  const ruleset = formData.rules || '5e';
  const preSelected = new Set();

  // Race skills (automatic, not choices)
  if (formData.race?.name) {
    const raceData = await fetchRaceData(formData.race.name, ruleset);
    const raceSkills = parseSkillProficiencies(raceData, ruleset);
    if (!raceSkills.isChoice) {
      raceSkills.skills.forEach(skill => preSelected.add(skill));
  }
   }

  // Background skills (automatic, not choices)
  if (formData.background) {
    if (ruleset === '2024') {
      const backgroundData = await fetchBackgroundData(formData.background);
      const bgSkills = parseSkillProficiencies(backgroundData, '2024');
      if (!bgSkills.isChoice) {
        bgSkills.skills.forEach(skill => preSelected.add(skill));
  }
     }
     // 5e backgrounds typically let you choose, so no pre-selection
   }

  // Class skills that are automatic (not choices)
  if (formData.class?.name) {
    const classData = await fetchClassData(formData.class.name, ruleset);
    const classSkills = parseSkillProficiencies(classData, ruleset);
    if (!classSkills.isChoice) {
      classSkills.skills.forEach(skill => preSelected.add(skill));
  }
   }

  return Array.from(preSelected);
}

/**
 * Determines if expertise is allowed and how many expertise slots are available
 * Reads from class JSON data instead of hardcoded rules
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { allowed: boolean, count: number, details: string }
 */
export async function getExpertiseLimits(formData) {
  const ruleset = formData.rules || '5e';
  const className = formData.class?.name || '';
  const level = formData.level || 1;

  if (!className) {
    return {
      allowed: false,
      count: 0,
      details: 'No class selected'
     };
   }

   // Load class data from JSON
  const classData = await fetchClassData(className, ruleset);
  if (!classData || !classData.class_levels) {
    return {
      allowed: false,
      count: 0,
      details: `Expertise is not available for ${className}`
     };
   }

    // Search through class levels for expertise features
   let totalCount = 0;
   for (const classLevel of classData.class_levels) {
     if (classLevel.level > level) {
       break;
      }
     
     // Check features in this level
    const features = classLevel.features || [];
    for (const feature of features) {
       // Check for expertise in feature_specific
       if (feature.feature_specific?.expertise) {
         totalCount += feature.feature_specific.expertise.count || 0;
        }
         // Also check if the feature name contains "Expertise"
        else if (feature.name && feature.name.includes('Expertise')) {
           // Parse the description for count
          const match = feature.description?.match(/choose\s+(\d+)/i);
          if (match) {
            totalCount += parseInt(match[1], 10);
           } else {
            // Default to 2 if not specified
            totalCount += 2;
           }
         }
         // Check for Scholar feature (Wizard 2024) which grants 1 expertise
        else if (feature.name === 'Scholar' && feature.description?.includes('Expertise')) {
          totalCount += 1;
         }
         // Also check feature descriptions for expertise grants (e.g., Ranger "Deft Explorer")
        else if (feature.description?.match(/\bexpertise\b/i)) {
           // Check for "choose X" pattern
          const chooseMatch = feature.description.match(/choose\s+(\d+)/i);
          if (chooseMatch) {
            totalCount += parseInt(chooseMatch[1], 10);
           }
           // Check for "gain expertise" pattern (1 expertise)
          else if (feature.description.match(/\bgain\s+expertise\b/i)) {
            totalCount += 1;
           }
           // Default to 1 if description mentions expertise but no count
           else {
            totalCount += 1;
           }
         }
      }
   }

    // Also check subclass/majors features for 2024
   if (ruleset === '2024' && classData.majors) {
     const subclass = formData.class?.subclass?.name;
     if (subclass) {
       const subclassData = classData.majors.find(m => m.name === subclass);
       if (subclassData?.features) {
         for (const feature of subclassData.features) {
           if (feature.level <= level) {
             if (feature.name?.includes('Expertise')) {
               const match = feature.description?.match(/choose\s+(\d+)/i);
               if (match) {
                 totalCount += parseInt(match[1], 10);
                }
              } else if (feature.name === 'Scholar' && feature.description?.includes('Expertise')) {
               totalCount += 1;
              }
              // Also check feature descriptions for expertise grants
              else if (feature.description?.match(/\bexpertise\b/i)) {
                const chooseMatch = feature.description.match(/choose\s+(\d+)/i);
                if (chooseMatch) {
                  totalCount += parseInt(chooseMatch[1], 10);
                 }
                else if (feature.description.match(/\bgain\s+expertise\b/i)) {
                  totalCount += 1;
                 }
                else {
                  totalCount += 1;
                 }
              }
            }
          }
        }
      }
    }

    // For 5e, also check subclasses
   if (ruleset === '5e' && classData.subclasses) {
     const subclass = formData.class?.subclass?.name;
     if (subclass) {
       const subclassData = classData.subclasses.find(s => s.name === subclass);
       if (subclassData?.class_levels) {
         for (const classLevel of subclassData.class_levels) {
           if (classLevel.level <= level) {
             const features = classLevel.features || [];
             for (const feature of features) {
               if (feature.name?.includes('Expertise')) {
                 const match = feature.description?.match(/choose\s+(\d+)/i);
                 if (match) {
                   totalCount += parseInt(match[1], 10);
                  }
                } else if (feature.name === 'Scholar' && feature.description?.includes('Expertise')) {
                 totalCount += 1;
                }
                // Also check feature descriptions for expertise grants
                else if (feature.description?.match(/\bexpertise\b/i)) {
                  const chooseMatch = feature.description.match(/choose\s+(\d+)/i);
                  if (chooseMatch) {
                    totalCount += parseInt(chooseMatch[1], 10);
                   }
                  else if (feature.description.match(/\bgain\s+expertise\b/i)) {
                    totalCount += 1;
                   }
                  else {
                    totalCount += 1;
                   }
                }
              }
            }
          }
       }
     }
   }

  return {
    allowed: totalCount > 0,
    count: totalCount,
    details: `${className} can have expertise in ${totalCount} skill(s) at level ${level}`
   };
}

/**
 * Validates skill selections and returns warnings (not blocking errors)
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - Array of warning objects { message: string, type: 'warning'|'info' }
 */
export async function validateSkills(formData) {
  const warnings = [];
  const selectedSkills = formData.skillProficiencies || [];
  const expertSkills = formData.expertSkills || [];
  const _ruleset = formData.rules || '5e';
  void _ruleset;

  // Get skill limits
  const limits = await getSkillLimits(formData);
  const expertiseLimits = await getExpertiseLimits(formData);

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
    const backgroundData = await fetchBackgroundData(formData.background);
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

