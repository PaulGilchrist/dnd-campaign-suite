/**
 * Languages and Fighting Styles validation service for character creation wizard
 * Provides non-blocking warnings about language and fighting style selections
 * Supports both 5e and 2024 rulesets
 */

import { loadFeatData, fetchClassData, fetchRaceData, fetchBackgroundData, fetchSubraceData } from './data-loader.js';

export { fetchClassData, fetchRaceData, fetchBackgroundData, fetchSubraceData };
/**
 * Gets the class data for a specific class name
 * @param {string} className - The name of the class
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object|null>} - The class data or null
 */
async function getClassByName(className, version = '5e') {
    if (!className) return null;
    return fetchClassData(className, version);
    }

/**
 * Gets the race data for a specific race name
 * @param {string} raceName - The name of the race
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object|null>} - The race data or null
 */
async function getRaceByName(raceName, version = '5e') {
    if (!raceName) return null;
    return fetchRaceData(raceName, version);
    }

async function getSubraceByName(subraceName, version = '5e') {
    if (!subraceName) return null;
    return fetchSubraceData(subraceName, version);
    }
/**
 * Gets the background data for a specific background name (2024 only)
 * @param {string} backgroundName - The name of the background
 * @returns {Promise<object|null>} - The background data or null
 */
async function getBackgroundByName(backgroundName) {
    if (!backgroundName) return null;
    return fetchBackgroundData(backgroundName, '2024');
    }

/**
 * Determines fighting styles allowed based on class features from JSON
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { allowed: number, preSelected: string[], details: string }
 */
export async function getFightingStyleLimits(formData) {
    const ruleset = formData.rules || '5e';
    const className = formData.class?.name || '';
    const level = formData.level || 1;
    const subclass = formData.class?.subclass?.name || '';
    
    const classData = await getClassByName(className, ruleset);
    
    let allowed = 0;
    let preSelected = [];
    let details = '';
    
    if (!classData) {
        return { allowed: 0, preSelected: [], details: 'No class selected' };
        }
    
    if (ruleset === '2024') {
           // 2024 rules: Fighting styles can be chosen as feats or from class features
            // Check if class grants fighting style from class_levels
        if (classData.class_levels) {
            for (const classLevel of classData.class_levels) {
                if (classLevel.level <= level && classLevel.features) {
                    const fightingStyleFeature = classLevel.features.find(f =>
                        f.name === 'Fighting Style' || f.name?.includes('Fighting Style')
                 );
            if (fightingStyleFeature) {
                // Check for count in feature_specific or default to 1
                allowed += fightingStyleFeature.feature_specific?.fighting_style?.count || 1;
                 }
          
                     // Check for additional fighting styles at higher levels in class_levels
                    const additionalFeatures = classLevel.features.filter(f =>
                        f.name?.includes('Additional Fighting Style') || (f.name?.includes('Fighting Style') && f.name !== 'Fighting Style')
             );
        allowed += additionalFeatures.length;
          }
               }
           }
  
           // Also check top-level class features (in case some classes have them)
        if (classData.features) {
            const fightingStyleFeature = classData.features.find(f =>
                f.name === 'Fighting Style' && f.level <= level
            );
            if (fightingStyleFeature) {
                allowed += fightingStyleFeature.feature_specific?.fighting_style?.count || 1;
            }

            const additionalFeatures = classData.features.filter(f =>
                                f.name?.includes('Fighting Style') && f.name !== 'Fighting Style' && f.level <= level
                               );
            allowed += additionalFeatures.length;
                         }

           // Check subclass/major features for additional fighting styles
        if (classData.majors && subclass) {
            const subclassData = classData.majors.find(s => s.name === subclass);
            if (subclassData && subclassData.features) {
                const subclassAdditionalFeatures = subclassData.features.filter(f =>
                    f.name?.includes('Fighting Style') && f.level <= level
             );
                allowed += subclassAdditionalFeatures.length;
          }
           }
      
          // Check for fighting style feats already selected
        const selectedFeats = formData.feats || [];
        if (selectedFeats.length > 0) {
            const feats = await loadFeatData(ruleset);
            const fightingStyleFeats = feats.filter(f =>
                f.prerequisites && f.prerequisites.feature === 'Fighting Style'
              );

            selectedFeats.forEach(featName => {
                const feat = fightingStyleFeats.find(f => f.name === featName);
                if (feat && !preSelected.includes(featName)) {
                    preSelected.push(featName);
          }
               });
           }
  
        details = `In 2024 rules, ${className}${className ? ' ' : ''}characters may get fighting styles from class features or feats.`;
              } else {
           // 5e rules - read from class JSON data
        if (classData.class_levels) {
            for (const classLevel of classData.class_levels) {
                if (classLevel.level <= level && classLevel.features) {
                    const fightingStyleFeature = classLevel.features.find(f =>
                        f.name === 'Fighting Style'
                 );
            if (fightingStyleFeature) {
                allowed += fightingStyleFeature.feature_specific?.fighting_style?.count || 1;
          }
               }
             }
           }
  
           // Check subclass features for additional fighting styles
        if (subclass && classData.subclasses) {
            const subclassData = classData.subclasses.find(s => s.name === subclass);
            if (subclassData) {
                  // Check class_levels for Additional Fighting Style feature
                if (subclassData.class_levels) {
                    for (const classLevel of subclassData.class_levels) {
                        if (classLevel.level <= level) {
                            const additionalStyleFeature = classLevel.features?.find(f =>
                                f.name === 'Additional Fighting Style'
                               );
                            if (additionalStyleFeature) {
                allowed += 1;
              }
                                    }
                                }
                            }
                            // Also check top-level subclass features
                        if (subclassData.features) {
                            const subclassAdditionalFeatures = subclassData.features.filter(f =>
                                f.name?.includes('Fighting Style') && f.name !== 'Fighting Style' && f.level <= level
                               );
                            allowed += subclassAdditionalFeatures.length;
                   }
          }
                    }
  
        details = `${className} may get fighting styles from class features. ${subclass ? `${subclass} ` : ''}may grant additional styles at higher levels.`;
         }

    return { allowed, preSelected, details };
   }

/**
 * Determines languages allowed based on race, class, and background from JSON
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { allowed: number, preSelected: string[], details: string }
 */
export async function getLanguageLimits(formData) {
    const ruleset = formData.rules || '5e';
    const className = formData.class?.name || '';
    const raceName = formData.race?.name || '';
    const subraceName = formData.race?.subrace?.name || '';
    const backgroundName = formData.background || '';
    const level = formData.level || 1;
    
    let allowed = 0;
    let preSelected = [];
    let details = '';
    
    if (ruleset === '2024') {
        // 2024 rules: Languages come from race, class, and background
        const raceData = await getRaceByName(raceName, '2024');
        const classData = await getClassByName(className, '2024');
        const backgroundData = await getBackgroundByName(backgroundName);
        // Race languages
        if (raceData) {
            const raceLangs = raceData.languages || [];
            preSelected.push(...raceLangs);
            allowed += raceLangs.length;
            }

         // Class languages
        if (classData) {
            const classLangs = classData.languages || [];
            preSelected.push(...classLangs);
            allowed += classLangs.length;
            }

          // Background languages (2024: from background JSON)
        if (backgroundData) {
            const bgLangs = backgroundData.languages || [];
            preSelected.push(...bgLangs);
            allowed += bgLangs.length;
               } else {
                // Default background languages for 2024
            allowed += 2;
            }

        details = `In 2024 rules, languages come from your race, class, and background.`;
           } else {
            // 5e rules
        const raceData = await getRaceByName(raceName, '5e');
        const classData = await getClassByName(className, '5e');

         // Race languages
        if (raceData) {
            const raceLangs = raceData.languages || [];
            preSelected.push(...raceLangs);
            allowed += raceLangs.length;
            }

          // Racial language bonuses from JSON
        if (raceData?.language_options) {
            const chooseCount = raceData.language_options.choose || 1;
            allowed += chooseCount;
             }

          // Subrace languages
        if (subraceName) {
           const subraceData = await getSubraceByName(subraceName, ruleset);
            if (subraceData && subraceData.languages && subraceData.languages.length > 0) {
                const subraceLangs = subraceData.languages;
                preSelected.push(...subraceLangs);
                   // Don't add to allowed count if already counted in race
             }
            if (subraceData?.language_options) {
                allowed += subraceData.language_options.choose || 0;
             }
              }

          // Class languages from JSON
        if (classData) {
            const classLangs = classData.languages || [];
            preSelected.push(...classLangs);
            allowed += classLangs.length;
             }
  
           // Check class_levels for language features
        if (classData?.class_levels) {
            for (const classLevel of classData.class_levels) {
                if (classLevel.level <= level && classLevel.features) {
                    for (const feature of classLevel.features) {
                        if (feature.name?.includes('Language') || feature.name === 'Extra Language') {
                            // Parse description for language count
                             const match = feature.description?.match(/(?:gain|learn)\s+(\d+)\s+language/i);
                            if (match) {
                                allowed += parseInt(match[1], 10);
            }
                             }
                         }
                     }
                 }
             }
         
          // Background languages (5e: typically 2 from backstory)
        allowed += 2;
        
        details = `In 5e rules, languages come from your race, class, and background (2 additional from backstory).`;
        }

     // Remove duplicates from preSelected
    preSelected = [...new Set(preSelected)];
    
    return { allowed, preSelected, details };
   }

/**
 * Validates language and fighting style selections and returns warnings
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - Array of warning objects { message: string, type: 'warning'|'info' }
 */
export async function validateLanguagesAndFightingStyles(formData) {
    const warnings = [];
    const selectedLanguages = formData.languages || [];
    const selectedFightingStyles = formData.class?.fightingStyles || [];
    
    try {
        // Validate languages
        const langLimits = await getLanguageLimits(formData);
        
        if (selectedLanguages.length > langLimits.allowed) {
            warnings.push({
                message: `Rules allow ${langLimits.allowed} language(s). You have selected ${selectedLanguages.length}. (${langLimits.details})`,
                type: 'warning'
                 });
             }
        
        if (selectedLanguages.length === 0 && langLimits.preSelected.length > 0) {
            warnings.push({
                message: `Your race, class, and background grant you these languages: ${langLimits.preSelected.join(', ')}. Consider selecting them.`,
                type: 'info'
                 });
             }
        
        // Validate fighting styles
        const styleLimits = await getFightingStyleLimits(formData);
        
        if (selectedFightingStyles.length > styleLimits.allowed) {
            warnings.push({
                message: `Rules allow ${styleLimits.allowed} fighting style(s). You have selected ${selectedFightingStyles.length}. (${styleLimits.details})`,
                type: 'warning'
                 });
             }
        
        if (selectedFightingStyles.length === 0 && styleLimits.allowed > 0) {
            warnings.push({
                message: `Your class allows ${styleLimits.allowed} fighting style(s). Consider selecting one.`,
                type: 'info'
                 });
             }
        
        // Check for fighting style feats in 2024 rules
        if (formData.rules === '2024' && styleLimits.preSelected.length > 0) {
            const missingStyles = styleLimits.preSelected.filter(s => !selectedFightingStyles.includes(s));
            if (missingStyles.length > 0) {
                warnings.push({
                    message: `You have selected fighting style feats: ${missingStyles.join(', ')}. These should be pre-selected.`,
                    type: 'info'
                     });
                 }
             }
        
         } catch (error) {
            console.error('Error validating languages and fighting styles:', error);
         }
    
        return warnings;
    }

