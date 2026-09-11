/**
 * Languages and Fighting Styles validation service for character creation wizard
 * Provides non-blocking warnings about language and fighting style selections
 * Supports both 5e and 2024 rulesets
 */

import { loadFeatData, fetchClassData, fetchRaceData, fetchBackgroundData, fetchSubraceData } from '../ui/dataLoader.js';

function fightingStyleFeatureCount(f) {
    return f.feature_specific?.fighting_style?.count || 1;
}

function isFightingStyleName(name) {
    return name?.includes('Fighting Style') || false;
}

function isAdditionalFightingStyleName(name) {
    return name?.includes('Additional Fighting Style') || (isFightingStyleName(name) && name !== 'Fighting Style');
}

// 2024: class_levels grants Fighting Style plus any additional style features
function countFightingStylesFrom2024ClassLevels(classLevels, level) {
    let allowed = 0;
    for (const classLevel of classLevels) {
        if (classLevel.level > level || !classLevel.features) {
            continue;
        }
        const fightingStyleFeature = classLevel.features.find(f =>
            f.name === 'Fighting Style' || isFightingStyleName(f.name)
        );
        if (fightingStyleFeature) {
            allowed += fightingStyleFeatureCount(fightingStyleFeature);
        }
        allowed += classLevel.features.filter(f => isAdditionalFightingStyleName(f.name)).length;
    }
    return allowed;
}

// 2024: top-level class features (in case some classes have them)
function countFightingStylesFromTopLevelFeatures(features, level) {
    const fightingStyleFeature = features.find(f => f.name === 'Fighting Style' && f.level <= level);
    let allowed = fightingStyleFeature ? fightingStyleFeatureCount(fightingStyleFeature) : 0;
    allowed += features.filter(f => isAdditionalFightingStyleName(f.name) && f.level <= level).length;
    return allowed;
}

// 2024: subclass/major features granting additional fighting styles
function countFightingStylesFromMajors(majors, subclass, level) {
    const subclassData = majors.find(s => s.name === subclass);
    if (!subclassData?.features) {
        return 0;
    }
    return subclassData.features.filter(f => isFightingStyleName(f.name) && f.level <= level).length;
}

// 2024: pre-select fighting style feats the character has already chosen
async function collectFightingStyleFeatSelections(selectedFeats, ruleset) {
    const preSelected = [];
    if (selectedFeats.length === 0) {
        return preSelected;
    }
    const feats = await loadFeatData(ruleset);
    const fightingStyleFeats = feats.filter(f =>
        f.prerequisites && f.prerequisites.feature === 'Fighting Style'
    );
    selectedFeats.forEach(featName => {
        if (fightingStyleFeats.some(f => f.name === featName) && !preSelected.includes(featName)) {
            preSelected.push(featName);
        }
    });
    return preSelected;
}

async function getFightingStyleLimits2024(formData, classData) {
    const className = formData.class?.name || '';
    const level = formData.level || 1;
    const subclass = formData.class?.subclass?.name || '';

    let allowed = classData.class_levels
        ? countFightingStylesFrom2024ClassLevels(classData.class_levels, level)
        : 0;
    if (classData.features) {
        allowed += countFightingStylesFromTopLevelFeatures(classData.features, level);
    }
    if (classData.majors && subclass) {
        allowed += countFightingStylesFromMajors(classData.majors, subclass, level);
    }

    const preSelected = await collectFightingStyleFeatSelections(formData.feats || [], '2024');

    const details = `In 2024 rules, ${className}${className ? ' ' : ''}characters may get fighting styles from class features or feats.`;
    return { allowed, preSelected, details };
}

// 5e: class_levels Fighting Style feature
function countFightingStylesFrom5eClassLevels(classLevels, level) {
    let allowed = 0;
    for (const classLevel of classLevels) {
        if (classLevel.level > level || !classLevel.features) {
            continue;
        }
        const fightingStyleFeature = classLevel.features.find(f => f.name === 'Fighting Style');
        if (fightingStyleFeature) {
            allowed += fightingStyleFeatureCount(fightingStyleFeature);
        }
    }
    return allowed;
}

// 5e: subclass class_levels and top-level features granting additional styles
function countFightingStylesFrom5eSubclass(subclassData, level) {
    let allowed = 0;
    if (subclassData.class_levels) {
        for (const classLevel of subclassData.class_levels) {
            if (classLevel.level <= level && classLevel.features?.find(f => f.name === 'Additional Fighting Style')) {
                allowed += 1;
            }
        }
    }
    if (subclassData.features) {
        allowed += subclassData.features.filter(f => isAdditionalFightingStyleName(f.name) && f.level <= level).length;
    }
    return allowed;
}

async function getFightingStyleLimits5e(formData, classData) {
    const className = formData.class?.name || '';
    const level = formData.level || 1;
    const subclass = formData.class?.subclass?.name || '';

    let allowed = classData.class_levels
        ? countFightingStylesFrom5eClassLevels(classData.class_levels, level)
        : 0;

    if (subclass && classData.subclasses) {
        const subclassData = classData.subclasses.find(s => s.name === subclass);
        if (subclassData) {
            allowed += countFightingStylesFrom5eSubclass(subclassData, level);
        }
    }

    const details = `${className} may get fighting styles from class features. ${subclass ? `${subclass} ` : ''}may grant additional styles at higher levels.`;
    return { allowed, preSelected: [], details };
}

/**
 * Determines fighting styles allowed based on class features from JSON
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { allowed: number, preSelected: string[], details: string }
 */
export async function getFightingStyleLimits(formData) {
    const ruleset = formData.rules || '5e';
    const className = formData.class?.name || '';

    const classData = className ? await fetchClassData(className, ruleset) : null;

    if (!classData) {
        return { allowed: 0, preSelected: [], details: 'No class selected' };
    }

    return ruleset === '2024'
        ? getFightingStyleLimits2024(formData, classData)
        : getFightingStyleLimits5e(formData, classData);
}

/**
 * Determines languages allowed based on race, class, and background from JSON
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { allowed: number, preSelected: string[], details: string }
 */
const LANGUAGE_NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function countLanguagesFrom2024Feature(feature) {
    // Try to match digit first, then spelled-out numbers
    const match = feature.description.match(/(?:know|gain|learn)\s+(\d+)\s+language/i)
        || feature.description.match(/(?:know|gain|learn)\s+(one|two|three|four|five)\s+language/i);
    if (!match) {
        return 0;
    }
    const count = parseInt(match[1], 10);
    if (!isNaN(count)) {
        return count;
    }
    return LANGUAGE_NUMBER_WORDS[match[1].toLowerCase()] || 0;
}

function countLanguagesFrom5eClassLevelFeature(feature) {
    if (feature.name?.includes('Language') || feature.name === 'Extra Language') {
        // Parse description for language count
        const match = feature.description?.match(/(?:gain|learn)\s+(\d+)\s+language/i);
        return match ? parseInt(match[1], 10) : 0;
    }
    // Also check feature descriptions for language grants (e.g., Ranger "Deft Explorer")
    if (feature.description?.match(/\blanguages?\b/i) && feature.description.match(/(?:know|gain|learn)\s+(\d+)\s+language/i)) {
        return parseInt(feature.description.match(/(?:know|gain|learn)\s+(\d+)\s+language/i)[1], 10);
    }
    return 0;
}

function addLanguageSource(preSelected, langs) {
    preSelected.push(...langs);
    return langs.length;
}

function countLanguagesFromClassLevels(classLevels, level, countFeature) {
    let allowed = 0;
    for (const classLevel of classLevels) {
        if (classLevel.level <= level && classLevel.features) {
            for (const feature of classLevel.features) {
                allowed += countFeature(feature);
            }
        }
    }
    return allowed;
}

async function addSubraceLanguageGrants(subraceName, ruleset, preSelected) {
    const subraceData = await fetchSubraceData(subraceName, ruleset);
    if (!subraceData) {
        return 0;
    }
    if (subraceData.languages && subraceData.languages.length > 0) {
        preSelected.push(...subraceData.languages);
        // Don't add to allowed count if already counted in race
    }
    return subraceData.language_options?.choose || 0;
}

async function getLanguageLimits2024(formData) {
    const className = formData.class?.name || '';
    const raceName = formData.race?.name || '';
    const backgroundName = formData.background || '';
    const level = formData.level || 1;

    const raceData = raceName ? await fetchRaceData(raceName, '2024') : null;
    const classData = className ? await fetchClassData(className, '2024') : null;
    const backgroundData = backgroundName ? await fetchBackgroundData(backgroundName, '2024') : null;

    let allowed = 0;
    const preSelected = [];

    // Race languages
    if (raceData) {
        allowed += addLanguageSource(preSelected, raceData.languages || []);
    }

    // Class languages
    if (classData) {
        allowed += addLanguageSource(preSelected, classData.languages || []);
    }

    // Background languages (2024: from background JSON)
    if (backgroundData) {
        allowed += addLanguageSource(preSelected, backgroundData.languages || []);
    } else {
        // Default background languages for 2024
        allowed += 2;
    }

    // Also check class_levels for language features (e.g., Ranger "Deft Explorer")
    if (classData?.class_levels) {
        allowed += countLanguagesFromClassLevels(classData.class_levels, level, feature =>
            feature.description?.match(/\blanguages?\b/i) ? countLanguagesFrom2024Feature(feature) : 0
        );
    }

    return { allowed, preSelected, details: `In 2024 rules, languages come from your race, class, and background.` };
}

async function getLanguageLimits5e(formData) {
    const ruleset = formData.rules || '5e';
    const className = formData.class?.name || '';
    const raceName = formData.race?.name || '';
    const subraceName = formData.race?.subrace?.name || '';
    const level = formData.level || 1;

    const raceData = raceName ? await fetchRaceData(raceName, '5e') : null;
    const classData = className ? await fetchClassData(className, '5e') : null;

    let allowed = 0;
    const preSelected = [];

    // Race languages and racial language bonuses from JSON
    if (raceData) {
        allowed += addLanguageSource(preSelected, raceData.languages || []);
        if (raceData.language_options) {
            allowed += raceData.language_options.choose || 1;
        }
    }

    // Subrace languages
    if (subraceName) {
        allowed += await addSubraceLanguageGrants(subraceName, ruleset, preSelected);
    }

    // Class languages from JSON, plus class_levels language features
    if (classData) {
        allowed += addLanguageSource(preSelected, classData.languages || []);
        if (classData.class_levels) {
            allowed += countLanguagesFromClassLevels(classData.class_levels, level, countLanguagesFrom5eClassLevelFeature);
        }
    }

    // Background languages (5e: typically 2 from backstory)
    allowed += 2;

    return { allowed, preSelected, details: `In 5e rules, languages come from your race, class, and background (2 additional from backstory).` };
}

export async function getLanguageLimits(formData) {
    const ruleset = formData.rules || '5e';

    const limits = ruleset === '2024'
        ? await getLanguageLimits2024(formData)
        : await getLanguageLimits5e(formData);

    // Remove duplicates from preSelected
    limits.preSelected = [...new Set(limits.preSelected)];

    return limits;
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

